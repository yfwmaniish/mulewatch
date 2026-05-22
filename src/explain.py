"""
Phase 6 — SHAP explainability.

Global SHAP summary on the primary LightGBM, top-N feature plots, and per-account
force-plot data for the highest-scoring test accounts (used by the analyst UI).

Inputs:
  models/registry.json  (locates primary LightGBM)
  data/processed/X_train.parquet, X_test.parquet, y_test.parquet

Outputs:
  reports/figures/shap_summary.png
  reports/figures/shap_bar_top20.png
  data/processed/shap_global_top20.json     (top-20 features by mean |SHAP|)
  data/processed/account_explanations.json  (top-K test accounts with reasons)
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

import shap

TOP_N_GLOBAL = 20
TOP_K_EXPLAIN = 25
TOP_REASONS_PER_ACCOUNT = 5


def find_primary_model(models_dir: Path) -> dict:
    """Find the uncalibrated LightGBM-stable model from registry.json."""
    reg = json.loads((models_dir / "registry.json").read_text())
    for h, info in reg.items():
        name = info.get("name", "")
        if "stable features" in name.lower() and "calibrated" not in name.lower():
            return {"hash": h, "info": info}
    # Fallback: first non-calibrated entry
    for h, info in reg.items():
        if "calibrated" not in info.get("name", "").lower():
            return {"hash": h, "info": info}
    raise FileNotFoundError("Primary LightGBM not found in models/registry.json")


def run(processed_dir: Path, models_dir: Path, reports_dir: Path) -> dict:
    primary = find_primary_model(models_dir)
    bundle = joblib.load(models_dir / f"{primary['hash']}.pkl")
    model = bundle["model"]
    feats = bundle["features"]

    X_test = pd.read_parquet(processed_dir / "X_test.parquet")[feats]
    y_test = pd.read_parquet(processed_dir / "y_test.parquet").iloc[:, 0].to_numpy()

    print(f"Computing SHAP for {len(feats)} features × {len(X_test)} test rows ...")
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_test)
    # LightGBM binary returns either (n, p) for positive class or [neg, pos] list
    if isinstance(shap_values, list):
        sv = shap_values[1]
    else:
        sv = shap_values

    mean_abs = np.abs(sv).mean(axis=0)
    order = np.argsort(-mean_abs)
    top_idx = order[:TOP_N_GLOBAL]
    top_features = [feats[i] for i in top_idx]
    top_mean_abs = [float(mean_abs[i]) for i in top_idx]
    top_mean_signed = [float(sv[:, i].mean()) for i in top_idx]

    figs = reports_dir / "figures"
    figs.mkdir(parents=True, exist_ok=True)

    # Beeswarm summary (top 20)
    plt.figure()
    shap.summary_plot(sv, X_test, feature_names=feats, max_display=TOP_N_GLOBAL, show=False)
    plt.tight_layout()
    plt.savefig(figs / "shap_summary.png", dpi=110, bbox_inches="tight")
    plt.close()

    # Bar plot
    plt.figure(figsize=(8, 6))
    plt.barh(range(len(top_features))[::-1], top_mean_abs, color="steelblue")
    plt.yticks(range(len(top_features))[::-1], top_features)
    plt.xlabel("Mean |SHAP value|")
    plt.title(f"Top {TOP_N_GLOBAL} features by mean |SHAP| (LightGBM on stable set)")
    plt.tight_layout()
    plt.savefig(figs / "shap_bar_top20.png", dpi=110)
    plt.close()

    # Global JSON
    global_top = [
        {
            "rank": i + 1,
            "feature": top_features[i],
            "mean_abs_shap": top_mean_abs[i],
            "mean_signed_shap": top_mean_signed[i],
            "direction": "high → mule" if top_mean_signed[i] > 0 else "low → mule",
        }
        for i in range(len(top_features))
    ]
    (processed_dir / "shap_global_top20.json").write_text(json.dumps(global_top, indent=2))

    # Per-account explanations: top-K highest-scoring test rows
    proba = model.predict_proba(X_test)[:, 1]
    rank = np.argsort(-proba)[:TOP_K_EXPLAIN]
    accounts = []
    for rank_idx, row_idx in enumerate(rank, 1):
        contribs = sv[row_idx]
        abs_order = np.argsort(-np.abs(contribs))[:TOP_REASONS_PER_ACCOUNT]
        reasons = [
            {
                "feature": feats[i],
                "value": (None if pd.isna(X_test.iloc[row_idx, i])
                          else float(X_test.iloc[row_idx, i])),
                "shap": float(contribs[i]),
                "direction": "pushes toward mule" if contribs[i] > 0 else "pushes toward legit",
            }
            for i in abs_order
        ]
        accounts.append({
            "rank": rank_idx,
            "test_row_index": int(X_test.index[row_idx]),
            "score": float(proba[row_idx]),
            "actual_label": int(y_test[row_idx]),
            "top_reasons": reasons,
        })
    (processed_dir / "account_explanations.json").write_text(json.dumps(accounts, indent=2))

    return {
        "primary_model_hash": primary["hash"],
        "n_features": len(feats),
        "n_test_rows": len(X_test),
        "top_global_features": global_top,
        "top_account_score": accounts[0]["score"] if accounts else None,
        "top_account_correct": (accounts[0]["actual_label"] == 1) if accounts else None,
        "figures": [
            str(figs / "shap_summary.png"),
            str(figs / "shap_bar_top20.png"),
        ],
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--processed", default="data/processed")
    ap.add_argument("--models", default="models")
    ap.add_argument("--reports", default="reports")
    args = ap.parse_args()
    out = run(Path(args.processed), Path(args.models), Path(args.reports))
    print(json.dumps({
        "primary_model_hash": out["primary_model_hash"],
        "top_global_features": out["top_global_features"][:10],
        "top_account_score": out["top_account_score"],
        "top_account_correct": out["top_account_correct"],
    }, indent=2))


if __name__ == "__main__":
    main()
