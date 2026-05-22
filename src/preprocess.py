"""
Phase 2 — Preprocessing.

Owns:
  - drop index col
  - drop zero-variance numeric cols
  - drop cols with >80% missing
  - duplicate-column audit + dedupe (persist mapping)
  - object-column handling (dates, freq encoding)
  - pre-split cross-tab against low-cardinality categoricals
    (cardinality-coincidence rule)
  - two-step leakage audit:
      (a) F2230-collinearity sweep — auto-drop  (|corr| with non_oct25 > 0.95)
      (b) target-collinearity sweep — flag for manual audit
          (|corr| with F3924 > 0.95)
  - filter zero-positive windows from supervised pool (route to anomaly stream)
  - stratified 70/30 holdout on target across the full supervised pool

Outputs to data/processed/:
  X_train.parquet, y_train.parquet         70%, target-stratified
  X_test.parquet,  y_test.parquet          30% holdout, target-stratified
  X_anomaly.parquet, y_anomaly.parquet     L7D/L14D/L90D rows
  dup_map.json                             keeper_col -> [dropped_cols]
  pre_split_crosstab.json                  target × low-card categoricals
  leakage_audit.json                       both F2230 and target sweeps
  preprocess_report.json                   counts at each stage
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

TARGET = "F3924"
WINDOW_COL = "F3889"
SNAPSHOT_COL = "F2230"
DATE_COL = "F3888"
OCT25 = "Oct25"
ZERO_POSITIVE_WINDOWS = {"L7D", "L14D", "L90D"}
OBJECT_LOW_CARD = ["F3886", "F3890", "F3891", "F3892", "F3893"]
LEAKAGE_CORR_THRESHOLD = 0.95
HOLDOUT_FRAC = 0.30
CROSSTAB_MAX_CARDINALITY = 30
SEED = 42


def column_hash(series: pd.Series) -> str:
    """Stable hash of a column's full values (NaN-aware)."""
    arr = series.to_numpy()
    if arr.dtype.kind in {"f", "i", "u", "b"}:
        payload = np.ascontiguousarray(arr).tobytes() + str(arr.dtype).encode()
    else:
        payload = pd.util.hash_pandas_object(series, index=False).values.tobytes()
    return hashlib.sha256(payload).hexdigest()


def find_duplicate_groups(df: pd.DataFrame) -> dict[str, list[str]]:
    """Return {keeper_col: [dropped_cols, ...]} for exact-duplicate columns."""
    by_hash: dict[str, list[str]] = defaultdict(list)
    for col in df.columns:
        by_hash[column_hash(df[col])].append(col)
    mapping: dict[str, list[str]] = {}
    for cols in by_hash.values():
        if len(cols) > 1:
            keeper, *dropped = cols
            mapping[keeper] = dropped
    return mapping


def parse_date_col(s: pd.Series) -> pd.Series:
    """F3888 looks like '8-1-2011' → unix-epoch days. Robust to mixed formats."""
    dt = pd.to_datetime(s, errors="coerce", dayfirst=False)
    if dt.isna().mean() > 0.5:
        dt = pd.to_datetime(s, errors="coerce", dayfirst=True)
    epoch = pd.Timestamp("1970-01-01")
    return (dt - epoch).dt.days.astype("Float32")


def frequency_encode(s: pd.Series) -> pd.Series:
    freq = s.value_counts(dropna=False, normalize=True)
    return s.map(freq).astype("Float32")


def pre_split_crosstab(
    raw_categorical: dict[str, pd.Series], y: pd.Series, max_card: int
) -> dict:
    """
    Target rate by category for every low-cardinality categorical column.

    The cardinality-coincidence rule: if positive count == category count,
    that category IS the label until proven otherwise.
    """
    out: dict = {"rule": "Cardinality-coincidence: positive_count == row_count of any rare category ⇒ identity assumed", "tables": {}}
    total_pos = int(y.sum())
    for col, s in raw_categorical.items():
        nunq = s.nunique(dropna=True)
        if nunq > max_card:
            out["tables"][col] = {"skipped": f"cardinality={nunq} > {max_card}"}
            continue
        ct = pd.crosstab(s, y, dropna=False)
        ct.columns = [f"target={c}" for c in ct.columns]
        rate = (ct.get("target=1", 0) / ct.sum(axis=1)).round(4)
        rows = []
        flags = []
        for cat, sub in ct.iterrows():
            n_pos = int(sub.get("target=1", 0))
            n_neg = int(sub.get("target=0", 0))
            n_tot = n_pos + n_neg
            row = {
                "category": str(cat),
                "rows": n_tot,
                "positives": n_pos,
                "negatives": n_neg,
                "target_rate": float(rate.get(cat, 0.0)),
            }
            if n_tot == total_pos and n_pos == total_pos:
                row["flag"] = "IDENTITY — category exactly matches positive set"
                flags.append(row["category"])
            if n_pos > 0 and n_neg == 0 and n_tot > 5:
                row["flag"] = row.get("flag", "PURE POSITIVE category")
                flags.append(row["category"])
            rows.append(row)
        out["tables"][col] = {"rows": rows, "identity_flags": flags}
    return out


def f2230_collinearity_sweep(
    df: pd.DataFrame, non_oct25: pd.Series, threshold: float
) -> tuple[list[str], dict[str, float]]:
    """Drop numeric columns with |Pearson corr| with non_oct25 binary > threshold."""
    numeric = df.select_dtypes(include=[np.number])
    target_arr = non_oct25.astype("float32").to_numpy()
    scores: dict[str, float] = {}
    for col in numeric.columns:
        x = numeric[col].to_numpy()
        mask = ~np.isnan(x)
        if mask.sum() < 30:
            continue
        x_, y_ = x[mask], target_arr[mask]
        if np.std(x_) == 0:
            continue
        corr = float(np.corrcoef(x_, y_)[0, 1])
        if not np.isnan(corr):
            scores[col] = corr
    dropped = [c for c, v in scores.items() if abs(v) > threshold]
    return dropped, scores


def target_collinearity_sweep(
    df: pd.DataFrame, y: pd.Series, threshold: float
) -> dict[str, float]:
    """
    Flag (do NOT drop) numeric columns with |Pearson corr| with target > threshold.
    Each flagged column requires a one-line justification in data_audit.md.
    """
    numeric = df.select_dtypes(include=[np.number])
    y_arr = y.astype("float32").to_numpy()
    flags: dict[str, float] = {}
    for col in numeric.columns:
        x = numeric[col].to_numpy()
        mask = ~np.isnan(x)
        if mask.sum() < 30:
            continue
        x_, y_ = x[mask], y_arr[mask]
        if np.std(x_) == 0:
            continue
        corr = float(np.corrcoef(x_, y_)[0, 1])
        if not np.isnan(corr) and abs(corr) > threshold:
            flags[col] = corr
    return flags


def preprocess(input_csv: Path, out_dir: Path, missing_threshold: float = 0.80) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    report: dict = {"input": str(input_csv)}

    df = pd.read_csv(input_csv)
    report["raw_shape"] = list(df.shape)

    if "Unnamed: 0" in df.columns:
        df = df.drop(columns=["Unnamed: 0"])

    y = df[TARGET].astype("int8")
    df = df.drop(columns=[TARGET])

    # ---- 1. Drop zero-variance numeric cols ----
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    nunique = df[numeric_cols].nunique(dropna=True)
    zero_var_cols = nunique[nunique <= 1].index.tolist()
    df = df.drop(columns=zero_var_cols)
    report["dropped_zero_variance"] = len(zero_var_cols)

    # ---- 2. Drop cols >80% missing ----
    null_frac = df.isna().mean()
    high_null_cols = null_frac[null_frac > missing_threshold].index.tolist()
    df = df.drop(columns=high_null_cols)
    report["dropped_high_null"] = len(high_null_cols)
    report["missing_threshold"] = missing_threshold

    # ---- 3. Duplicate audit + dedupe ----
    dup_map = find_duplicate_groups(df)
    dropped_dups = [c for cols in dup_map.values() for c in cols]
    df = df.drop(columns=dropped_dups)
    report["duplicate_groups"] = len(dup_map)
    report["dropped_duplicates"] = len(dropped_dups)
    (out_dir / "dup_map.json").write_text(json.dumps(dup_map, indent=2))

    # ---- 4. Pre-split cross-tab (before object handling consumes raw values) ----
    raw_categorical = {}
    for col in [SNAPSHOT_COL, WINDOW_COL] + OBJECT_LOW_CARD:
        if col in df.columns:
            raw_categorical[col] = df[col].copy()
    crosstab = pre_split_crosstab(raw_categorical, y, CROSSTAB_MAX_CARDINALITY)
    (out_dir / "pre_split_crosstab.json").write_text(json.dumps(crosstab, indent=2))
    identity_flags = []
    for col, tbl in crosstab["tables"].items():
        for cat in tbl.get("identity_flags", []):
            identity_flags.append({"column": col, "category": cat})
    report["identity_flags"] = identity_flags

    # ---- 5. Object column handling ----
    object_handling: dict[str, str] = {}
    window_orig: pd.Series | None = None
    snapshot_orig: pd.Series | None = None

    if DATE_COL in df.columns:
        df[DATE_COL] = parse_date_col(df[DATE_COL])
        object_handling[DATE_COL] = "date_to_epoch_days"

    if WINDOW_COL in df.columns:
        window_orig = df[WINDOW_COL].copy()
        df[WINDOW_COL] = frequency_encode(df[WINDOW_COL])
        object_handling[WINDOW_COL] = "frequency_encoded (raw values kept in memory)"

    for col in OBJECT_LOW_CARD:
        if col in df.columns:
            df[col] = frequency_encode(df[col])
            object_handling[col] = "frequency_encoded"

    if SNAPSHOT_COL in df.columns:
        snapshot_orig = df[SNAPSHOT_COL].copy()
        df = df.drop(columns=[SNAPSHOT_COL])
        object_handling[SNAPSHOT_COL] = "split_key_only (dropped from features; raw values kept in memory)"

    report["object_handling"] = object_handling

    # ---- 6. Two-step leakage audit ----
    # (a) F2230-collinearity — auto-drop
    assert snapshot_orig is not None, f"{SNAPSHOT_COL} missing from input"
    non_oct25 = (snapshot_orig != OCT25).astype("int8").rename("non_oct25")
    f2230_dropped, f2230_scores = f2230_collinearity_sweep(
        df, non_oct25, LEAKAGE_CORR_THRESHOLD
    )
    df = df.drop(columns=f2230_dropped)
    report["leakage_f2230_dropped"] = len(f2230_dropped)

    # (b) Target-collinearity — flag only (manual audit)
    target_flags = target_collinearity_sweep(df, y, LEAKAGE_CORR_THRESHOLD)
    report["leakage_target_flagged"] = len(target_flags)

    leakage_audit = {
        "threshold": LEAKAGE_CORR_THRESHOLD,
        "step_a_f2230_collinear": {
            "policy": "auto-drop",
            "indicator": "binary non_oct25 (1 if F2230 != Oct25)",
            "dropped_columns": f2230_dropped,
            "dropped_count": len(f2230_dropped),
            "top_20_by_abs_corr": sorted(
                f2230_scores.items(), key=lambda kv: -abs(kv[1])
            )[:20],
        },
        "step_b_target_collinear": {
            "policy": "flag for manual review (NOT auto-dropped)",
            "indicator": "binary target F3924",
            "scanned_after": "step (a) drops applied",
            "flagged_columns": sorted(
                target_flags.items(), key=lambda kv: -abs(kv[1])
            ),
            "flagged_count": len(target_flags),
            "justifications": {
                col: "TODO: hand-audit and document keep/drop reason"
                for col in target_flags
            },
        },
    }
    (out_dir / "leakage_audit.json").write_text(json.dumps(leakage_audit, indent=2))

    # ---- 7. Filter anomaly-window rows out ----
    assert window_orig is not None, f"{WINDOW_COL} missing from input"
    anomaly_mask = window_orig.isin(ZERO_POSITIVE_WINDOWS)
    X_anomaly = df[anomaly_mask].copy()
    y_anomaly = y[anomaly_mask].copy()
    X_sup = df[~anomaly_mask].copy()
    y_sup = y[~anomaly_mask].copy()
    report["anomaly_rows"] = int(anomaly_mask.sum())
    report["anomaly_positives"] = int(y_anomaly.sum())
    report["supervised_rows"] = len(X_sup)
    report["supervised_positives"] = int(y_sup.sum())

    # ---- 8. Stratified 70/30 holdout on target ----
    X_train, X_test, y_train, y_test = train_test_split(
        X_sup, y_sup,
        test_size=HOLDOUT_FRAC, stratify=y_sup, random_state=SEED,
    )

    report["splits"] = {
        "train":   {"rows": len(X_train),   "positives": int(y_train.sum())},
        "test":    {"rows": len(X_test),    "positives": int(y_test.sum())},
        "anomaly": {"rows": len(X_anomaly), "positives": int(y_anomaly.sum())},
    }
    report["holdout_fraction"] = HOLDOUT_FRAC
    report["final_feature_count"] = X_train.shape[1]

    # ---- 9. Persist ----
    X_train.to_parquet(out_dir / "X_train.parquet")
    X_test.to_parquet(out_dir / "X_test.parquet")
    X_anomaly.to_parquet(out_dir / "X_anomaly.parquet")
    y_train.to_frame(TARGET).to_parquet(out_dir / "y_train.parquet")
    y_test.to_frame(TARGET).to_parquet(out_dir / "y_test.parquet")
    y_anomaly.to_frame(TARGET).to_parquet(out_dir / "y_anomaly.parquet")

    (out_dir / "preprocess_report.json").write_text(json.dumps(report, indent=2))
    return report


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="DataSet.csv", help="Path to raw CSV")
    ap.add_argument("--out", default="data/processed", help="Output directory")
    ap.add_argument("--missing-threshold", type=float, default=0.80)
    args = ap.parse_args()

    report = preprocess(Path(args.input), Path(args.out), args.missing_threshold)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
