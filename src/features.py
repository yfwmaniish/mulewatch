"""
Phase 3 — Feature selection.

Three-stage pipeline:
  1. Resolve bank-hinted seed-18 features against the dedupe map. Some seed
     features may have been duplicates of another column; map them to the
     surviving keeper.
  2. Univariate filter — mutual information + ROC-AUC vs target. Keep top 500.
  3. Bootstrap stability selection — 50 resamples at 80% with replacement;
     fit LightGBM on the top-500; keep features with non-zero gain in
     >= 30 of 50 bootstraps. More stable than k-fold inclusion at this N.

Inputs (from src.preprocess):
  data/processed/X_train.parquet, y_train.parquet
  data/processed/dup_map.json

Outputs:
  data/processed/features_seed18.json    bank-hinted, resolved against dup_map
  data/processed/features_top500.json    univariate filter survivors
  data/processed/features_stable.json    bootstrap-stable survivors (final set)
  data/processed/feature_selection_report.json
  reports/feature_selection.md
"""
from __future__ import annotations

import argparse
import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_selection import mutual_info_classif
from sklearn.metrics import roc_auc_score

import lightgbm as lgb

BANK_HINTED = [
    "F115", "F321", "F527", "F531", "F670", "F1692", "F2082", "F2122",
    "F2582", "F2678", "F2737", "F2956", "F3043", "F3836", "F3887",
    "F3889", "F3891", "F3894",
]
TOP_K_FILTER = 500
N_BOOTSTRAP = 50
BOOTSTRAP_FRAC = 0.80
STABILITY_THRESHOLD = 30
SEED = 42


def resolve_seed_features(
    requested: list[str], available: list[str], dup_map: dict[str, list[str]]
) -> tuple[list[str], dict[str, str], list[str]]:
    """
    For each requested feature, find its surviving column name.
    Returns (resolved_names, mapping_notes, missing).
    """
    # Invert dup_map: dropped_name -> keeper
    inverted: dict[str, str] = {}
    for keeper, dropped in dup_map.items():
        for d in dropped:
            inverted[d] = keeper

    available_set = set(available)
    resolved: list[str] = []
    mapping: dict[str, str] = {}
    missing: list[str] = []
    for col in requested:
        if col in available_set:
            resolved.append(col)
            mapping[col] = col
        elif col in inverted and inverted[col] in available_set:
            resolved.append(inverted[col])
            mapping[col] = f"{col} -> {inverted[col]} (dedupe alias)"
        else:
            missing.append(col)
            mapping[col] = "MISSING (dropped during preprocess)"
    # de-duplicate while preserving order
    seen = set()
    deduped = []
    for c in resolved:
        if c not in seen:
            deduped.append(c)
            seen.add(c)
    return deduped, mapping, missing


def univariate_scores(X: pd.DataFrame, y: pd.Series) -> pd.DataFrame:
    """
    Compute (MI, AUC) for each numeric column against y.
    Median-impute for the AUC computation only (MI handles NaN via sklearn).
    """
    X = X.select_dtypes(include=[np.number]).copy()
    medians = X.median()
    X_imputed = X.fillna(medians)

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        mi = mutual_info_classif(X_imputed, y, random_state=SEED, discrete_features=False)

    aucs = np.zeros(X.shape[1], dtype="float32")
    y_arr = y.to_numpy()
    for i, col in enumerate(X.columns):
        try:
            auc = roc_auc_score(y_arr, X_imputed[col].to_numpy())
            aucs[i] = max(auc, 1 - auc)  # direction-agnostic
        except Exception:
            aucs[i] = 0.5

    scores = pd.DataFrame({"feature": X.columns, "mi": mi, "auc": aucs})
    # rank by sum of normalized MI and AUC departure from 0.5
    scores["mi_rank"] = scores["mi"].rank(pct=True)
    scores["auc_rank"] = (scores["auc"] - 0.5).rank(pct=True)
    scores["combined"] = scores["mi_rank"] + scores["auc_rank"]
    return scores.sort_values("combined", ascending=False, ignore_index=True)


def bootstrap_stability(
    X: pd.DataFrame, y: pd.Series, n_bootstrap: int, frac: float, threshold: int
) -> tuple[list[str], dict[str, int]]:
    """
    Fit LightGBM on n_bootstrap resamples; count how often each feature has
    non-zero gain. Return features with count >= threshold.
    """
    rng = np.random.default_rng(SEED)
    n = len(X)
    sample_size = int(n * frac)
    n_pos = int(y.sum())
    n_neg = n - n_pos
    spw = n_neg / max(n_pos, 1)

    counts: dict[str, int] = {col: 0 for col in X.columns}

    for b in range(n_bootstrap):
        idx = rng.choice(n, size=sample_size, replace=True)
        Xb = X.iloc[idx]
        yb = y.iloc[idx]
        # Skip degenerate samples with too few positives
        if yb.sum() < 5:
            continue
        model = lgb.LGBMClassifier(
            n_estimators=200,
            learning_rate=0.05,
            num_leaves=31,
            min_data_in_leaf=10,
            scale_pos_weight=spw,
            random_state=SEED + b,
            n_jobs=-1,
            verbose=-1,
        )
        model.fit(Xb, yb)
        gains = model.booster_.feature_importance(importance_type="gain")
        for col, g in zip(X.columns, gains):
            if g > 0:
                counts[col] += 1

    stable = [c for c, k in counts.items() if k >= threshold]
    return stable, counts


def run(processed_dir: Path, reports_dir: Path) -> dict:
    X_train = pd.read_parquet(processed_dir / "X_train.parquet")
    y_train = pd.read_parquet(processed_dir / "y_train.parquet").iloc[:, 0]
    dup_map = json.loads((processed_dir / "dup_map.json").read_text())

    report: dict = {}

    # ---- 1. Seed-18 resolution ----
    seed_resolved, seed_mapping, seed_missing = resolve_seed_features(
        BANK_HINTED, X_train.columns.tolist(), dup_map
    )
    (processed_dir / "features_seed18.json").write_text(json.dumps({
        "requested": BANK_HINTED,
        "resolved": seed_resolved,
        "mapping": seed_mapping,
        "missing": seed_missing,
    }, indent=2))
    report["seed18"] = {
        "requested": len(BANK_HINTED),
        "resolved": len(seed_resolved),
        "missing": seed_missing,
    }

    # ---- 2. Univariate filter (top 500) ----
    scores = univariate_scores(X_train, y_train)
    top500 = scores.head(TOP_K_FILTER)
    top500_features = top500["feature"].tolist()
    (processed_dir / "features_top500.json").write_text(json.dumps({
        "n_kept": len(top500_features),
        "features": top500_features,
        "head_with_scores": top500.head(30).to_dict(orient="records"),
    }, indent=2, default=float))
    report["filter"] = {
        "n_input": int(scores.shape[0]),
        "n_kept": len(top500_features),
        "best_auc": float(scores["auc"].max()),
        "best_mi": float(scores["mi"].max()),
    }

    # ---- 3. Bootstrap stability selection on top-500 ----
    # Ensure seed-18 are included in the candidate pool even if filter dropped them
    candidate_pool = sorted(set(top500_features) | set(seed_resolved))
    X_pool = X_train[candidate_pool]
    stable, counts = bootstrap_stability(
        X_pool, y_train, N_BOOTSTRAP, BOOTSTRAP_FRAC, STABILITY_THRESHOLD
    )

    counts_sorted = sorted(counts.items(), key=lambda kv: -kv[1])
    (processed_dir / "features_stable.json").write_text(json.dumps({
        "n_bootstrap": N_BOOTSTRAP,
        "bootstrap_frac": BOOTSTRAP_FRAC,
        "threshold": STABILITY_THRESHOLD,
        "n_candidate": len(candidate_pool),
        "n_stable": len(stable),
        "stable_features": stable,
        "counts_top_50": counts_sorted[:50],
    }, indent=2))
    report["stability"] = {
        "n_candidate": len(candidate_pool),
        "n_stable": len(stable),
        "threshold": f"{STABILITY_THRESHOLD}/{N_BOOTSTRAP} bootstraps with non-zero gain",
        "seed18_survival": {col: counts.get(col, 0) for col in seed_resolved},
    }

    # ---- 4. Markdown report ----
    md_lines = [
        "# Feature Selection Report",
        "",
        "Generated by `src/features.py` from `data/processed/X_train.parquet`.",
        "",
        "## 1. Seed-18 (bank-hinted features)",
        "",
        f"Requested: **{len(BANK_HINTED)}** features. Resolved against `dup_map.json`: **{len(seed_resolved)}** found. Missing: **{len(seed_missing)}** (`{', '.join(seed_missing) or '—'}`).",
        "",
        "| Bank-hinted | Resolved name | Note |",
        "|---|---|---|",
    ]
    for col in BANK_HINTED:
        note = seed_mapping[col]
        resolved = (
            note.split(" -> ")[1].split(" ")[0]
            if " -> " in note
            else (col if col not in seed_missing else "—")
        )
        md_lines.append(f"| `{col}` | `{resolved}` | {note} |")
    md_lines += [
        "",
        "## 2. Univariate filter",
        "",
        f"Scored **{report['filter']['n_input']}** numeric columns by mutual information and ROC-AUC vs target. Best AUC: **{report['filter']['best_auc']:.4f}**. Best MI: **{report['filter']['best_mi']:.4f}**.",
        "",
        f"Kept top **{report['filter']['n_kept']}**.",
        "",
        "### Top 20 by combined rank",
        "",
        "| Feature | MI | AUC |",
        "|---|---:|---:|",
    ]
    for r in top500.head(20).to_dict(orient="records"):
        md_lines.append(f"| `{r['feature']}` | {r['mi']:.4f} | {r['auc']:.4f} |")
    md_lines += [
        "",
        "## 3. Bootstrap stability selection",
        "",
        f"**{N_BOOTSTRAP}** bootstrap resamples at {int(BOOTSTRAP_FRAC*100)}% with replacement. LightGBM fit on each. Feature kept if it has non-zero gain in **>= {STABILITY_THRESHOLD}** of {N_BOOTSTRAP} bootstraps.",
        "",
        f"Candidate pool: **{report['stability']['n_candidate']}** features (top-500 union seed-18). Survivors: **{report['stability']['n_stable']}**.",
        "",
        "### Seed-18 stability counts",
        "",
        "| Feature | bootstraps with non-zero gain |",
        "|---|---:|",
    ]
    for col in seed_resolved:
        md_lines.append(f"| `{col}` | {counts.get(col, 0)} / {N_BOOTSTRAP} |")
    md_lines += [
        "",
        "### Top 30 most stable features (any source)",
        "",
        "| Feature | bootstraps with non-zero gain |",
        "|---|---:|",
    ]
    for col, k in counts_sorted[:30]:
        md_lines.append(f"| `{col}` | {k} / {N_BOOTSTRAP} |")
    md_lines += [
        "",
        "## How to reproduce",
        "",
        "```powershell",
        "python -m src.features --processed data/processed --reports reports",
        "```",
    ]
    (reports_dir / "feature_selection.md").write_text("\n".join(md_lines), encoding="utf-8")

    (processed_dir / "feature_selection_report.json").write_text(json.dumps(report, indent=2))
    return report


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--processed", default="data/processed")
    ap.add_argument("--reports", default="reports")
    args = ap.parse_args()
    Path(args.reports).mkdir(parents=True, exist_ok=True)
    report = run(Path(args.processed), Path(args.reports))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
