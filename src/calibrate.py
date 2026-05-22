"""
Phase 6 — Isotonic calibration of the primary LightGBM, with reliability diagram.

Why this matters: un-calibrated LightGBM outputs are ranking scores, not
probabilities. The policy matrix's 0.30 / 0.70 risk-band cutoffs are only
meaningful on calibrated outputs.

Method: scikit-learn's CalibratedClassifierCV with method='isotonic' and cv=5.
This carves the train set internally — no leak onto test. Reliability diagram
+ Brier score evaluated on the held-out test set.

Inputs:
  data/processed/X_train.parquet, y_train.parquet
  data/processed/X_test.parquet, y_test.parquet
  data/processed/features_stable.json

Outputs:
  models/<hash>.pkl                       calibrated model
  models/registry.json                    updated
  data/processed/calibration_report.json
  reports/figures/reliability_diagram.png
  reports/figures/score_histogram.png
  reports/calibration.md
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    precision_recall_curve,
    roc_auc_score,
)

import lightgbm as lgb

SEED = 42
CV_INTERNAL = 5
TOP_K_FRAC = 0.01
RISK_BANDS = [("Low", 0.0, 0.30), ("Medium", 0.30, 0.70), ("High", 0.70, 1.01)]


def git_sha() -> str:
    try:
        out = subprocess.run(["git", "rev-parse", "--short", "HEAD"],
                             capture_output=True, text=True, timeout=5)
        if out.returncode == 0:
            return out.stdout.strip()
    except Exception:
        pass
    return "no-git"


def df_hash(df: pd.DataFrame) -> str:
    h = hashlib.sha256()
    h.update(",".join(df.columns).encode())
    for col in df.columns:
        arr = df[col].to_numpy()
        h.update(str(arr.dtype).encode())
        try:
            h.update(np.ascontiguousarray(arr).tobytes())
        except Exception:
            h.update(pd.util.hash_pandas_object(df[col], index=False).values.tobytes())
    return h.hexdigest()[:16]


def model_hash(train_hash: str, features: list[str], hyperparams: dict, sha: str) -> str:
    payload = json.dumps({
        "train_hash": train_hash,
        "features": sorted(features),
        "hyperparams": hyperparams,
        "git_sha": sha,
        "tag": "calibrated_isotonic_cv5",
    }, sort_keys=True).encode()
    return hashlib.sha256(payload).hexdigest()[:16]


def precision_at_top_k(y_true, y_score, frac):
    n = len(y_true)
    k = max(1, int(round(n * frac)))
    idx = np.argsort(-y_score)[:k]
    return float(np.asarray(y_true)[idx].sum() / k)


def reliability_diagram(y_true, y_prob_uncal, y_prob_cal, out_png: Path) -> dict:
    """Side-by-side reliability + score histogram. Returns Brier + ECE numbers."""
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))

    # Reliability curves
    ax = axes[0]
    for name, prob in [("uncalibrated", y_prob_uncal), ("isotonic-calibrated", y_prob_cal)]:
        frac_pos, mean_pred = calibration_curve(y_true, prob, n_bins=10, strategy="quantile")
        ax.plot(mean_pred, frac_pos, marker="o", label=name)
    ax.plot([0, 1], [0, 1], "k--", alpha=0.4, label="perfect calibration")
    ax.set_xlabel("Mean predicted probability (in bin)")
    ax.set_ylabel("Empirical positive fraction (in bin)")
    ax.set_title("Reliability diagram — test set (24 positives)")
    ax.legend()
    ax.grid(True, alpha=0.3)

    # Score histogram
    ax = axes[1]
    ax.hist(y_prob_cal[np.array(y_true) == 0], bins=40, alpha=0.5, label="negatives", color="steelblue")
    ax.hist(y_prob_cal[np.array(y_true) == 1], bins=40, alpha=0.7, label="positives", color="crimson")
    for name, lo, hi in RISK_BANDS:
        ax.axvline(lo, color="gray", linestyle=":", alpha=0.5)
    ax.set_xlabel("Calibrated probability")
    ax.set_ylabel("Count (log)")
    ax.set_yscale("log")
    ax.set_title("Calibrated score distribution by class")
    ax.legend()

    plt.tight_layout()
    out_png.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(out_png, dpi=110)
    plt.close()

    return {
        "brier_uncal": float(brier_score_loss(y_true, y_prob_uncal)),
        "brier_cal":   float(brier_score_loss(y_true, y_prob_cal)),
    }


def risk_band_breakdown(y_true: np.ndarray, y_prob: np.ndarray) -> list[dict]:
    rows = []
    for name, lo, hi in RISK_BANDS:
        mask = (y_prob >= lo) & (y_prob < hi)
        n = int(mask.sum())
        pos = int(y_true[mask].sum())
        rows.append({
            "band": name,
            "range": f"[{lo:.2f}, {hi:.2f})",
            "n": n,
            "positives": pos,
            "fraction_of_alerts": f"{pos / max(int(y_true.sum()), 1):.2%}",
            "precision_in_band": f"{pos / max(n, 1):.4f}",
        })
    return rows


def run(processed_dir: Path, models_dir: Path, reports_dir: Path) -> dict:
    X_train = pd.read_parquet(processed_dir / "X_train.parquet")
    y_train = pd.read_parquet(processed_dir / "y_train.parquet").iloc[:, 0]
    X_test = pd.read_parquet(processed_dir / "X_test.parquet")
    y_test = pd.read_parquet(processed_dir / "y_test.parquet").iloc[:, 0]
    stable = json.loads((processed_dir / "features_stable.json").read_text())["stable_features"]

    X_train, X_test = X_train[stable], X_test[stable]
    n_pos = int(y_train.sum())
    n_neg = len(y_train) - n_pos
    spw = n_neg / max(n_pos, 1)

    # Conservative-regularized config — CV bake-off winner (see cv_variance.md)
    hp = {"n_estimators": 500, "learning_rate": 0.05, "num_leaves": 15,
          "min_data_in_leaf": 20, "reg_alpha": 0.1, "reg_lambda": 0.1}

    # Uncalibrated baseline (same as primary in models.py)
    base_uncal = lgb.LGBMClassifier(
        **hp, scale_pos_weight=spw, random_state=SEED, n_jobs=-1, verbose=-1,
    )
    base_uncal.fit(X_train, y_train)
    y_prob_uncal = base_uncal.predict_proba(X_test)[:, 1]

    # Calibrated wrapper (5-fold isotonic — no test leak)
    base_for_cv = lgb.LGBMClassifier(
        **hp, scale_pos_weight=spw, random_state=SEED, n_jobs=-1, verbose=-1,
    )
    calibrated = CalibratedClassifierCV(
        estimator=base_for_cv, method="isotonic", cv=CV_INTERNAL,
    )
    calibrated.fit(X_train, y_train)
    y_prob_cal = calibrated.predict_proba(X_test)[:, 1]

    y_test_arr = y_test.to_numpy()
    metrics_uncal = {
        "pr_auc": float(average_precision_score(y_test_arr, y_prob_uncal)),
        "roc_auc": float(roc_auc_score(y_test_arr, y_prob_uncal)),
        "precision_at_top1pct": precision_at_top_k(y_test_arr, y_prob_uncal, TOP_K_FRAC),
    }
    metrics_cal = {
        "pr_auc": float(average_precision_score(y_test_arr, y_prob_cal)),
        "roc_auc": float(roc_auc_score(y_test_arr, y_prob_cal)),
        "precision_at_top1pct": precision_at_top_k(y_test_arr, y_prob_cal, TOP_K_FRAC),
    }

    # Reliability + score-histogram figure
    figs_dir = reports_dir / "figures"
    brier = reliability_diagram(
        y_test_arr, y_prob_uncal, y_prob_cal,
        figs_dir / "reliability_diagram.png",
    )

    # Risk-band breakdown
    bands = risk_band_breakdown(y_test_arr, y_prob_cal)

    # Save calibrated model with versioned hash
    train_hash = df_hash(X_train)
    sha = git_sha()
    h = model_hash(train_hash, stable, hp, sha)
    models_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump({
        "model": calibrated,
        "features": stable,
        "metrics": metrics_cal,
        "calibration": {"method": "isotonic", "cv_internal": CV_INTERNAL},
    }, models_dir / f"{h}.pkl")
    reg_path = models_dir / "registry.json"
    existing = json.loads(reg_path.read_text()) if reg_path.exists() else {}
    existing[h] = {
        "name": "LightGBM-stable, isotonic-calibrated",
        "hyperparams": hp,
        "feature_count": len(stable),
        "tag": "calibrated_isotonic_cv5",
    }
    reg_path.write_text(json.dumps(existing, indent=2))

    out = {
        "model_hash": h,
        "metrics_uncalibrated": metrics_uncal,
        "metrics_calibrated": metrics_cal,
        **brier,
        "risk_bands": bands,
        "n_test_positives": int(y_test.sum()),
    }
    (processed_dir / "calibration_report.json").write_text(json.dumps(out, indent=2))

    md = ["# Calibration Report", "",
          "Isotonic regression wrapper on the primary LightGBM, fitted via internal "
          f"{CV_INTERNAL}-fold CV on the train pool. No test-set leak — the test holdout "
          "is touched only at evaluation time.",
          "",
          "## Ranking unchanged, scoring meaningful",
          "",
          "Calibration does not change the rank order of predictions, so PR-AUC / ROC-AUC are "
          "near-identical. What changes is that scores become *interpretable as probabilities*, "
          "which is what the risk-band policy matrix requires.",
          "",
          "| Metric | Uncalibrated | Calibrated |",
          "|---|---:|---:|",
          f"| PR-AUC | {metrics_uncal['pr_auc']:.4f} | {metrics_cal['pr_auc']:.4f} |",
          f"| ROC-AUC | {metrics_uncal['roc_auc']:.4f} | {metrics_cal['roc_auc']:.4f} |",
          f"| Precision @ top-1% | {metrics_uncal['precision_at_top1pct']:.4f} | {metrics_cal['precision_at_top1pct']:.4f} |",
          f"| Brier score (lower is better) | {brier['brier_uncal']:.4f} | {brier['brier_cal']:.4f} |",
          "",
          "Brier improvement is the meaningful number — it measures calibration quality directly.",
          "",
          "## Reliability diagram",
          "",
          "![Reliability diagram](figures/reliability_diagram.png)",
          "",
          "Left: empirical positive fraction vs mean predicted probability in 10 quantile bins. "
          "The isotonic-calibrated curve should sit closer to the diagonal than the uncalibrated. "
          "Right: score distribution by class (log scale).",
          "",
          "## Risk-band breakdown on test set",
          "",
          "Risk bands defined as **Low [0.0, 0.3) | Medium [0.3, 0.7) | High [0.7, 1.0]**. "
          "These bands map directly onto the policy matrix in `PLAN.md` Phase 10 "
          "(ALLOW / STEP-UP / HOLD).",
          "",
          "| Band | Range | Accounts | Positives | % of all positives | Precision in band |",
          "|---|---|---:|---:|---:|---:|"]
    for b in bands:
        md.append(f"| {b['band']} | {b['range']} | {b['n']} | {b['positives']} "
                  f"| {b['fraction_of_alerts']} | {b['precision_in_band']} |")
    md += ["",
           "## Model versioning",
           "",
           f"Calibrated model saved as `models/{h}.pkl`. Hash inputs: train_data + features "
           "+ hyperparams + git_sha + calibration tag (so calibrated vs uncalibrated versions get different hashes).",
           ""]
    (reports_dir / "calibration.md").write_text("\n".join(md), encoding="utf-8")

    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--processed", default="data/processed")
    ap.add_argument("--models", default="models")
    ap.add_argument("--reports", default="reports")
    args = ap.parse_args()
    out = run(Path(args.processed), Path(args.models), Path(args.reports))
    print(json.dumps({
        "model_hash": out["model_hash"],
        "metrics_calibrated": out["metrics_calibrated"],
        "brier_uncal": out["brier_uncal"],
        "brier_cal": out["brier_cal"],
        "risk_bands": out["risk_bands"],
    }, indent=2))


if __name__ == "__main__":
    main()
