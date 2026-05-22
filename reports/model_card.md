# Model Card — Mule Account Classifier

Aligned with RBI FREE-AI framework (2024 draft) expectations for ML in customer-impacting financial decisions.

## 1. Intended use

**Primary use:** rank bank accounts by likelihood of being a mule, surfaced to fraud analysts as a daily High/Medium/Low risk queue. The model **augments** analyst capacity by prioritizing review; it does not autonomously freeze, restrict, or close accounts. Hard actions (account freeze, STR filing) require a separate decision-engine rule firing on top of the model score plus a regulatory feed match (I4C / CFCFRMS).

**Operating point:** Precision @ top-1% alerts. The threshold corresponds to the analyst team's daily review capacity. At deployment time, the calibrated probability ≥ 0.70 maps to the **High** risk band; ≥ 0.30 to **Medium**; below to **Low**.

**Out of scope:**
- Transaction-level real-time blocking (this model is account-level).
- Standalone evidence for STR / suspicious-activity reporting — score is one input among several.
- Generalization to accounts outside the bank's deployment portfolio.

## 2. Model details

| Field | Value |
|---|---|
| Architecture | LightGBM (gradient-boosted decision trees) |
| Calibration | Isotonic regression, 5-fold internal CV |
| Hyperparameters | n_estimators=500, learning_rate=0.05, num_leaves=15, min_data_in_leaf=20, reg_alpha=0.1, reg_lambda=0.1 |
| Feature count | 385 (bootstrap-selected from 2,248 deduped candidates; 18 bank-hinted included where stable) |
| Class-imbalance handling | `scale_pos_weight = neg/pos` (≈102 at training time) |
| Random seed | 42 |
| Versioning | sha256(train_data_hash + sorted feature list + hyperparams + git_sha + calibration_tag)[:16] |
| Tracked in | `models/registry.json` |

## 3. Training data

| Property | Value |
|---|---|
| Raw rows | 9,082 |
| After zero-variance / >80% null / duplicate removal | 2,250 columns |
| After F2230-collinearity sweep | 2,248 columns |
| Supervised pool (after dropping zero-positive windows L7D/L14D/L90D) | 8,402 rows |
| Class prevalence | 0.96% positive |
| Train / test split | Stratified 70/30 on target |
| Train rows / positives | 5,881 / 57 |
| Test rows / positives | 2,521 / 24 |
| Anomaly pool (unsupervised side-channel) | 680 rows / 0 positives |

**Feature provenance.** Originally 3,924 anonymized features. 1,675 dropped by the pipeline (zero-variance, >80% null, exact duplicates, F2230-collinear). Bank provided 18 hinted features (F115, F321, F527, F531, F670, F1692, F2082, F2122, F2582, F2678, F2737, F2956, F3043, F3836, F3887, F3889, F3891, F3894); 16 survived bootstrap stability. Two failed: **F670** (13/50 bootstraps) and **F2082** (1/50) — bank hints the data does not corroborate. Documented in `reports/feature_selection.md`.

**Known data property — F2230 leakage.** Snapshot month `F2230 ≡ target` in the raw data (every non-Oct25 row is positive). This is a labeling-process artifact (retroactive ground-truth appends). Mitigated by hard exclusion of F2230 from features + collinearity sweep against the `non_oct25` indicator. Full audit in `reports/data_audit.md`.

## 4. Performance

**Headline (30% target-stratified test holdout, 24 positives):**

| Metric | Calibrated value |
|---|---:|
| **Precision @ top-1% alerts** | **0.80** |
| PR-AUC | 0.87 (bootstrap 95% CI: [0.74, 0.97]) |
| ROC-AUC | 0.96 |
| Brier score | 0.0024 |

**5-fold CV × 3 seeds on train pool:** PR-AUC 0.781 ± 0.087, Precision@top-1% 0.694 ± 0.090.

**Risk-band breakdown on test:**

| Band | Probability range | Accounts | Positives | Precision in band |
|---|---|---:|---:|---:|
| High | ≥ 0.70 | 15 | 15 | 1.00 |
| Medium | [0.30, 0.70) | 3 | 3 | 1.00 |
| Low | < 0.30 | 2,503 | 6 | 0.0024 |

18 of 24 test positives (75%) land in High+Medium; 6 false negatives slip into Low. The 6 missed positives are the recall gap.

**Leakage audit:** like-for-like LightGBM-on-seed-18 vs LightGBM-on-full PR-AUC gap = +0.539, fired above 0.15 threshold. Investigation (two-stage: top-10 feature `corr` with `non_oct25` < 0.06; monotonic gradient 0.330 → 0.624 → 0.869 across seed-18 → top-20-by-AUC → stable-385) **cleared** the audit. Full investigation in `reports/model_results.md` §2.

## 5. Disparate-impact slicing

Performance breakdown across the demographic dimensions in the data. Tested on the supervised pool (anomaly windows excluded).

| Slice | Positive rate | Coverage |
|---|---:|---:|
| Account type (`F3886`) — Savings | 1.28% | 76 of 81 positives (94%) |
| Account type — Current | 0.20% | 4 of 81 positives |
| Customer segment (`F3893`) — RETAIL | 1.18% | 76 of 81 positives (94%) |
| Customer segment — CORPORATE | 0.19% | 5 of 81 positives |
| Region (`F3890`) — Rural | 1.44% | 29 of 81 |
| Region — Semi-Urban | 0.88% | 21 of 81 |
| Region — Metro | 0.62% | 18 of 81 |
| Region — Urban | 0.73% | 13 of 81 |
| Occupation (`F3891`) — Student | 1.94% | 23 of 81 |
| Occupation — Agriculture | 1.26% | 14 of 81 |
| Occupation — Salaried | 0.73% | 14 of 81 |
| Occupation — Self-employed | 0.66% | 26 of 81 |
| Gender (`F3892`) — Male | 1.26% | 63 of 81 (78%) |
| Gender — Female | 0.92% | 13 of 81 |

**Observations:** Mule concentration is in retail savings (94% of positives). Students and rural accounts show elevated baseline rates. **Implication for deployment:** these demographic slices should be monitored for differential precision/recall in production. If precision in any slice drops below the global rate by > 20%, retrain or recalibrate.

## 6. Known limitations

1. **Small absolute positive count** (81 total, 24 in test). Headline metrics carry ±0.09 PR-AUC sampling noise (see bootstrap CI). Hyperparameter tuning beyond the 2-config bake-off was not pursued — Optuna on 65 training positives is theatre.
2. **Anonymized features.** SHAP reasons in the analyst UI cite column names without semantic labels. Production deployment must map these to the bank's feature catalog before reasons are shown to customers or used in dispute responses. Plausibility hypotheses in `reports/feature_semantics.md`.
3. **No counterparty / transaction-edge data.** Graph layer in the production architecture is illustrative on this dataset (synthetic, built from cosine-similarity of feature vectors). Real deployment requires transfer-event ingest.
4. **No temporal generalization estimate.** F2230 was the natural temporal dimension; it turned out to be a label proxy. CV is random-stratified, not time-based. Production must run a 30/60/90-day rolling backtest before scoring confidence is real.
5. **Three time windows have zero positives** (L7D, L14D, L90D). These rows (680 accounts) cannot be scored by the supervised model and are routed to the unsupervised anomaly side-channel (Isolation Forest). Recall on those windows is **undefined**, not zero.
6. **Six false negatives in Low band on the test set.** Model misses 25% of positives at the 0.30 cutoff. **These accounts are behaviorally normal-looking**, not a feature-engineering miss:
   - Higher account balances than typical mules — F1863 medians 2–12× the typical-mule median (98K).
   - Larger lifetime transaction history — F3805 typically 192K for mules, false negatives at 357K–1.6M.
   - F2637 deviates far from the typical-mule centrality in **either direction** across all 6 cases (deltas −67 to +27 std), suggesting these accounts maintained a profile that doesn't fit the dominant mule pattern.
   - **Mitigation:** rules-based hard filters (I4C/CFCFRMS list match, dormancy-break + high-value debit, device-sharing across accounts) that don't depend on behavioral profiling. These are designed to catch the false negatives the model misses by construction.

## 7. Ethical considerations

- **Mule classification has consequences for the account holder.** False positives cause customer friction (step-up auth, holds); false negatives cause victim losses. Both error modes are real harms. The High-band action (HOLD outgoing leg) was chosen because it is reversible and time-bounded by the 15-min analyst SLA.
- **Demographic correlations are real but operationally suspect.** Rural and student categories have elevated positive rates in the training data. This may reflect (a) genuine higher mule recruitment in those populations, (b) sampling bias in the labeling process, or (c) confounding with account-type variables. Production should disable or down-weight demographic features if disparate-impact monitoring shows precision drift.
- **No customer-facing reason text without semantic mapping.** Current SHAP reasons cite anonymized feature IDs. These must be translated into customer-understandable explanations before any model output reaches a customer dispute response.

## 8. Retraining triggers

| Trigger | Action |
|---|---|
| Population Stability Index (PSI) on top-20 features > 0.2 vs training distribution | Off-cycle retrain |
| Precision in any demographic slice drops > 20% below global precision | Recalibrate (refit isotonic on recent slice) |
| Analyst confirmed-positive throughput drops > 30% week-over-week | Investigate drift, retrain if confirmed |
| Scheduled | Monthly retrain on rolling 12-month label window (Airflow DAG) |

## 9. Reproducibility

```powershell
python -m src.preprocess   --input DataSet.csv  --out data/processed
python -m src.data_audit   --processed data/processed --out reports/data_audit.md
python -m src.features     --processed data/processed --reports reports
python -m src.cv_variance  --processed data/processed --reports reports
python -m src.models       --processed data/processed --models models --reports reports
python -m src.calibrate    --processed data/processed --models models --reports reports
python -m src.explain      --processed data/processed --models models --reports reports
```

Random seed: 42. Train data hash logged with every saved model in `models/registry.json`.

## 10. Versioning

| Field | Value |
|---|---|
| Model card version | 1.0 |
| Code version (git SHA) | embedded in `models/registry.json` per model |
| Calibrated model hash | see `models/registry.json`, entry tagged `calibrated_isotonic_cv5` |
| Date generated | from preprocess timestamp |
