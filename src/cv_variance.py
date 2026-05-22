"""
CV variance estimate + 2-config hyperparameter bake-off (NOT Optuna).

Rationale: tuning with Optuna on 65 training positives is theatre — the "best"
hyperparameters from one CV run won't transfer reliably. Better: pick a
conservative-regularized config alongside the current defaults, take 5-fold CV
×3 seeds on both, report mean ± std, choose the winner.

Inputs:
  data/processed/X_train.parquet, y_train.parquet
  data/processed/features_stable.json

Outputs:
  data/processed/cv_variance.json
  reports/cv_variance.md
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score
from sklearn.model_selection import StratifiedKFold

import lightgbm as lgb

K_FOLDS = 5
SEEDS = [42, 7, 1337]
TOP_K_FRAC = 0.01

CONFIG_DEFAULTS = {
    "name": "defaults (current primary)",
    "params": dict(
        n_estimators=400, learning_rate=0.05, num_leaves=31,
        min_data_in_leaf=10, n_jobs=-1, verbose=-1,
    ),
}
CONFIG_CONSERVATIVE = {
    "name": "conservative-regularized",
    "params": dict(
        n_estimators=500, learning_rate=0.05, num_leaves=15,
        min_data_in_leaf=20, reg_alpha=0.1, reg_lambda=0.1,
        n_jobs=-1, verbose=-1,
    ),
}


def precision_at_top_k(y_true: np.ndarray, y_score: np.ndarray, frac: float) -> float:
    n = len(y_true)
    k = max(1, int(round(n * frac)))
    idx = np.argsort(-y_score)[:k]
    return float(y_true[idx].sum() / k)


def cv_config(X: pd.DataFrame, y: pd.Series, params: dict, seeds: list[int]) -> dict:
    pr_aucs: list[float] = []
    p_at_k: list[float] = []
    y_arr = y.to_numpy()

    for seed in seeds:
        kf = StratifiedKFold(n_splits=K_FOLDS, shuffle=True, random_state=seed)
        for tr_idx, va_idx in kf.split(X, y):
            X_tr, X_va = X.iloc[tr_idx], X.iloc[va_idx]
            y_tr, y_va = y.iloc[tr_idx], y.iloc[va_idx]
            if y_tr.sum() == 0 or y_va.sum() == 0:
                continue
            n_pos = int(y_tr.sum())
            n_neg = len(y_tr) - n_pos
            model = lgb.LGBMClassifier(
                **params,
                scale_pos_weight=n_neg / max(n_pos, 1),
                random_state=seed,
            )
            model.fit(X_tr, y_tr)
            y_score = model.predict_proba(X_va)[:, 1]
            pr_aucs.append(average_precision_score(y_va, y_score))
            p_at_k.append(precision_at_top_k(y_va.to_numpy(), y_score, TOP_K_FRAC))

    pr_aucs = np.array(pr_aucs)
    p_at_k = np.array(p_at_k)
    return {
        "n_folds_evaluated": int(len(pr_aucs)),
        "pr_auc_mean": float(pr_aucs.mean()),
        "pr_auc_std": float(pr_aucs.std()),
        "precision_at_top1pct_mean": float(p_at_k.mean()),
        "precision_at_top1pct_std": float(p_at_k.std()),
    }


def run(processed_dir: Path, reports_dir: Path) -> dict:
    X_train = pd.read_parquet(processed_dir / "X_train.parquet")
    y_train = pd.read_parquet(processed_dir / "y_train.parquet").iloc[:, 0]
    stable = json.loads((processed_dir / "features_stable.json").read_text())["stable_features"]
    X = X_train[stable]

    results = []
    for cfg in (CONFIG_DEFAULTS, CONFIG_CONSERVATIVE):
        m = cv_config(X, y_train, cfg["params"], SEEDS)
        m["name"] = cfg["name"]
        m["params"] = cfg["params"]
        results.append(m)

    winner = max(results, key=lambda r: r["pr_auc_mean"])
    out = {
        "protocol": f"{K_FOLDS}-fold stratified CV × {len(SEEDS)} seeds = {K_FOLDS * len(SEEDS)} folds",
        "seeds": SEEDS,
        "results": results,
        "winner": winner["name"],
        "winner_pr_auc": winner["pr_auc_mean"],
    }
    (processed_dir / "cv_variance.json").write_text(json.dumps(out, indent=2))

    md = ["# CV Variance + Hyperparameter Bake-off", "",
          f"**Protocol:** {out['protocol']}. Feature set: {len(stable)} bootstrap-stable features.",
          "",
          "Tuning with Optuna on 65 training positives is theatre — the best config from one CV "
          "run won't transfer reliably. Better protocol: pick a conservative-regularized config alongside "
          "current defaults, CV both, report variance, choose winner.",
          "",
          "## Results",
          "",
          "| Config | PR-AUC (mean ± std) | Precision@top-1% (mean ± std) | Folds |",
          "|---|---|---|---:|"]
    for r in results:
        md.append(
            f"| {r['name']} | {r['pr_auc_mean']:.3f} ± {r['pr_auc_std']:.3f} "
            f"| {r['precision_at_top1pct_mean']:.3f} ± {r['precision_at_top1pct_std']:.3f} "
            f"| {r['n_folds_evaluated']} |"
        )
    md += ["", f"**Winner:** {out['winner']} ({out['winner_pr_auc']:.3f} mean PR-AUC).", ""]
    for r in results:
        md += [f"### {r['name']} hyperparameters", "```json", json.dumps(r["params"], indent=2), "```", ""]
    (reports_dir / "cv_variance.md").write_text("\n".join(md), encoding="utf-8")

    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--processed", default="data/processed")
    ap.add_argument("--reports", default="reports")
    args = ap.parse_args()
    out = run(Path(args.processed), Path(args.reports))
    print(json.dumps({k: v for k, v in out.items() if k != "results"}, indent=2))
    for r in out["results"]:
        print(f"  {r['name']}: PR-AUC {r['pr_auc_mean']:.3f}±{r['pr_auc_std']:.3f}, "
              f"P@1% {r['precision_at_top1pct_mean']:.3f}±{r['precision_at_top1pct_std']:.3f}")


if __name__ == "__main__":
    main()
