"""
Build a synthetic behavioral-similarity graph for the analyst console.

Why: the dataset has no counterparty / transaction-edge data, so we can't
draw a real money-flow graph. What we CAN draw is behavioral clustering —
which alert-queue accounts look like each other in the model's eyes.

Method:
  1. Pick the top-K highest-scoring test accounts (operational view).
  2. Restrict each account's vector to the top-N SHAP-importance features.
  3. Median-impute + standardize (cosine on raw NaN-heavy vectors is unstable).
  4. Compute pairwise cosine similarity; keep the top ~10% of edges by similarity.
  5. Run spring layout (NetworkX) so the UI can render fixed positions.
  6. Emit JSON: {nodes, edges, meta}.

The output is honest demo data: real accounts, real scores, real bands, real
feature vectors. Only the metaphor (edges = behavioral similarity, not money
flow) is synthetic.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

import networkx as nx

DEFAULTS = {
    "top_n_features": 20,    # how many top-SHAP features to use as the vector
    "top_k_accounts": 50,    # how many highest-score test accounts to include
    "edge_keep_frac": 0.10,  # fraction of all pairs kept as edges
    "min_similarity": 0.30,  # additional floor — drop weak edges
    "svg_width": 800,
    "svg_height": 540,
}


def synth_display_id(account_id: int) -> str:
    """Mirror the synthesizer in ui/src/lib/synthesize.ts."""
    h = 2166136261
    s = f"acct-{account_id}".encode()
    for b in s:
        h ^= b
        h = (h * 16777619) & 0xFFFFFFFF
    tail = f"{h:08X}"[:4]
    return f"MULE_AC_{account_id}_{tail}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--processed", default="data/processed")
    ap.add_argument("--models", default="models")
    ap.add_argument("--out", default="data/processed/mule_graph.json")
    ap.add_argument("--top-n-features", type=int, default=DEFAULTS["top_n_features"])
    ap.add_argument("--top-k-accounts", type=int, default=DEFAULTS["top_k_accounts"])
    ap.add_argument("--edge-keep-frac", type=float, default=DEFAULTS["edge_keep_frac"])
    ap.add_argument("--min-similarity", type=float, default=DEFAULTS["min_similarity"])
    args = ap.parse_args()

    processed = Path(args.processed)
    models_dir = Path(args.models)

    # ---- Load data ----
    X_test = pd.read_parquet(processed / "X_test.parquet")
    y_test = pd.read_parquet(processed / "y_test.parquet").iloc[:, 0]

    # ---- Locate the calibrated primary model for scores ----
    reg = json.loads((models_dir / "registry.json").read_text())
    cal_hash = next(h for h, info in reg.items() if "calibrated" in info.get("tag", "").lower())
    uncal_hash = next(
        h for h, info in reg.items()
        if "stable" in info.get("name", "").lower() and "calibrated" not in info.get("name", "").lower()
    )
    cal_bundle = joblib.load(models_dir / f"{cal_hash}.pkl")
    feats = cal_bundle["features"]

    # Score every test account using calibrated model
    proba = cal_bundle["model"].predict_proba(X_test[feats])[:, 1]
    scores = pd.Series(proba, index=X_test.index, name="score").sort_values(ascending=False)
    top_ids = scores.head(args.top_k_accounts).index.tolist()

    # ---- Pick the top-N SHAP-importance features ----
    shap_global = json.loads((processed / "shap_global_top20.json").read_text())
    top_features = [r["feature"] for r in shap_global[: args.top_n_features]]
    top_features = [f for f in top_features if f in X_test.columns]

    # ---- Build the vector matrix ----
    M = X_test.loc[top_ids, top_features].copy()
    M = M.fillna(M.median())          # median-impute
    # standardize (zero-mean, unit-variance) per feature
    means = M.mean()
    stds = M.std(ddof=0).replace(0, 1.0)
    M = (M - means) / stds
    arr = M.to_numpy(dtype=np.float64)

    # ---- Pairwise cosine ----
    sim = cosine_similarity(arr)
    n = len(top_ids)

    # Upper-triangle pairs only
    iu, ju = np.triu_indices(n, k=1)
    all_sims = sim[iu, ju]
    # Threshold: take top edge_keep_frac AND require >= min_similarity
    n_pairs = len(all_sims)
    keep_count = max(int(round(n_pairs * args.edge_keep_frac)), 1)
    cutoff_by_rank = np.sort(all_sims)[-keep_count]
    cutoff = max(cutoff_by_rank, args.min_similarity)

    edge_mask = all_sims >= cutoff
    e_src = iu[edge_mask]
    e_dst = ju[edge_mask]
    e_sim = all_sims[edge_mask]

    # ---- Layout via NetworkX spring ----
    g = nx.Graph()
    for i, acct in enumerate(top_ids):
        g.add_node(i, account_id=int(acct))
    for s, d, w in zip(e_src, e_dst, e_sim):
        g.add_edge(int(s), int(d), weight=float(w))

    # Spring layout; seed for determinism
    pos = nx.spring_layout(g, weight="weight", seed=42, iterations=120, k=1.2 / np.sqrt(n))

    # Normalize to SVG canvas
    xs = np.array([pos[i][0] for i in range(n)])
    ys = np.array([pos[i][1] for i in range(n)])
    def norm(a, lo, hi):
        a_min, a_max = a.min(), a.max()
        if a_max - a_min < 1e-9:
            return np.full_like(a, (lo + hi) / 2.0)
        return lo + (a - a_min) / (a_max - a_min) * (hi - lo)
    xs = norm(xs, 60, DEFAULTS["svg_width"] - 60)
    ys = norm(ys, 60, DEFAULTS["svg_height"] - 60)

    # Per-node band threshold
    def band(s: float) -> str:
        if s >= 0.70: return "HIGH"
        if s >= 0.30: return "MEDIUM"
        return "LOW"

    nodes = []
    for i, acct in enumerate(top_ids):
        s = float(scores.loc[acct])
        nodes.append({
            "id": i,
            "account_id": int(acct),
            "display_id": synth_display_id(int(acct)),
            "score": s,
            "band": band(s),
            "is_positive": bool(int(y_test.loc[acct])) if acct in y_test.index else False,
            "x": float(xs[i]),
            "y": float(ys[i]),
            "degree": int(g.degree(i)),
        })

    edges = [
        {"source": int(s), "target": int(d), "similarity": round(float(w), 4)}
        for s, d, w in zip(e_src, e_dst, e_sim)
    ]

    out = {
        "meta": {
            "method": "cosine similarity of top-20 SHAP feature vectors",
            "top_n_features": args.top_n_features,
            "top_k_accounts": args.top_k_accounts,
            "edge_keep_frac": args.edge_keep_frac,
            "min_similarity_floor": args.min_similarity,
            "applied_cutoff": float(cutoff),
            "n_nodes": len(nodes),
            "n_edges": len(edges),
            "n_positive_nodes": sum(1 for nd in nodes if nd["is_positive"]),
            "svg_width": DEFAULTS["svg_width"],
            "svg_height": DEFAULTS["svg_height"],
            "model_version": cal_hash,
            "uncalibrated_model": uncal_hash,
            "caveat": "Edges = behavioral similarity, not money flow. Dataset has no counterparty data. Production deployment uses real transfer edges.",
        },
        "nodes": nodes,
        "edges": edges,
    }

    Path(args.out).write_text(json.dumps(out, indent=2))
    print(json.dumps(out["meta"], indent=2))


if __name__ == "__main__":
    main()
