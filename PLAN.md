# Mule Account Detection — Consolidated Project Plan

**Problem:** Build an AI/ML system that classifies suspicious / mule bank accounts from a per-account feature dataset, and surrounds it with a production-shaped solution that ingests transactions, regulatory feeds (I4C/CFCFRMS), and TMS/FMS alerts in real time to prevent fraudulent fund circulation.

**Source data:** [DataSet.csv](DataSet.csv) (9,082 rows × 3,925 columns), [Topic.pdf](Topic.pdf).

---

## 1. Dataset reality check (measured, not assumed)

| Property | Value | Implication |
|---|---|---|
| Rows × Cols | 9,082 × 3,925 | Wide; p ≈ n/2 → severe overfit risk |
| Target `F3924` | 9,001 negative / **81 positive (0.89%)** | Imbalance handled via `scale_pos_weight` + threshold tuning; **no SMOTE** |
| Numeric cols | 3,917 | Tree models native |
| Object cols | 8 (all demographic/profile — no counterparty) | Graph layer must be synthetic for this dataset |
| Zero-variance cols | 359 | Drop unconditionally |
| Cols >50% null | 1,138 | Tree models tolerate; drop only >80% |
| **Duplicate column groups** | **632 groups, 2,688 columns** | **Dedupe first → ~30% free dim reduction** |
| Time-window dimension | `F3889` ∈ {L7D, L14D, L31D, L90D, L180D, L365D, G365D} | Row-level partition, **not** a 6-block column structure |
| Window distribution | 83% `G365D`; L7D/L14D/L90D have **zero positives** | Drop zero-positive windows from supervised set |
| Snapshot months | `F2230` ∈ {Sep25, Oct25, Nov25, Dec25}; 99% Oct25 | **`F2230 ≡ target` — every non-Oct25 row is positive AND every Oct25 supervised row is negative.** Cardinality match: 81 positives ↔ 81 non-Oct25 rows exactly. `F2230` excluded from features unconditionally; collinear features dropped via sweep |
| Bank-hinted features | 18 (F115, F321, F527, F531, F670, F1692, F2082, F2122, F2582, F2678, F2737, F2956, F3043, F3836, F3887, F3889, F3891, F3894) | Seed set for "honest floor" model and leakage audit. **16 of 18 confirmed as bootstrap-stable signal; F670 (13/50) and F2082 (1/50) failed** — bank intuition partially mismatches data |

**Key correction vs. an initial reading of the data:** adjacent columns are NOT different time windows of the same metric — many are exact duplicates (e.g., F19 ≡ F25 across all rows). The time-window dimension lives in a single column (`F3889`). Treat row-level, not column-level.

---

## 2. Solution architecture

```
                +------------------------------------------------+
                |   SOURCES (cross-channel + external)           |
                |  UPI | IMPS | NEFT/RTGS | Cards | AePS         |
                |  Net/Mobile banking | Branch CBS               |
                |  FMS alerts | TMS alerts                       |
                |  I4C/CFCFRMS tickets | RBI advisories          |
                |  Negative-list / mule registries               |
                +------------------+-----------------------------+
                                   |
                            +------v-------+
                            |  Ingestion   |  Kafka topics
                            |  (Kafka /    |  per source,
                            |  REST/SFTP)  |  schema registry
                            +------+-------+
                                   |
                +------------------v-----------------------------+
                |  STREAM PROCESSING  (Flink / Spark)            |
                |  - normalize to canonical Txn/Alert schema     |
                |  - enrich: account, device, IP, geo, beneficiary|
                |  - feature store writes (online + offline)     |
                +------------------+-----------------------------+
                                   |
                +------------------v-----------------------------+
                |  SCORING SERVICE  (FastAPI + LightGBM)         |
                |  - account-level risk score (this project)     |
                |  - txn-level rule + anomaly score              |
                |  - regulatory-list match (I4C/CFCFRMS hits)    |
                |  - graph score (mule network proximity)        |
                +------------------+-----------------------------+
                                   |
                +------------------v-----------------------------+
                |  DECISION ENGINE                                |
                |  policy: thresholds + business rules            |
                |  actions: ALLOW | STEP-UP | HOLD | FREEZE       |
                +------------------+-----------------------------+
                                   |
       +-----------+---------------+---------------+-----------+
       |           |               |               |           |
   Core Banking  Case mgmt     Analyst UI     FIU-IND STR   Audit log
   (action API)  (workflow)    (dashboard)    e-filing prep (WORM)
                                   ^
                                   |  feedback (true/false positive)
                                   +----> retraining pipeline (monthly)
```

**Latency budget (to be measured, not promised):** ingest → decision target < 500 ms; scoring API p95 target < 100 ms. Numbers reported from `benchmark.py`, not slides.

---

## 3. Phased plan

### Phase 0 — Setup
- **Repo layout:**
  ```
  data/raw/DataSet.csv
  data/processed/                  parquet outputs
  notebooks/                       01_eda, 02_features, 03_models, 04_explain
  src/                             preprocess.py, features.py, models.py,
                                   evaluate.py, explain.py, benchmark.py
  service/                         scoring API (FastAPI)
  stream/                          Kafka producer + consumer
  ui/                              Streamlit analyst console
  reports/                         figures/, model_card.md, final_report.pdf
  models/                          *.pkl, version-tagged
  ```
- **Stack:** Python 3.11; pandas / numpy / scikit-learn; **LightGBM + XGBoost**; SHAP; FastAPI; Streamlit; Redpanda (local Kafka); NetworkX (graph demo).
- **Reproducibility:** `random_state=42`; pinned `requirements.txt`; optional MLflow.

### Phase 1 — EDA ([notebooks/01_eda.ipynb](notebooks/01_eda.ipynb))
**Runs on the deduped frame produced by Phase 2 (confirmatory, not preparatory).**
1. Class balance plot (81 / 9082).
2. Missingness heatmap + per-column null fraction.
3. Variance scan — flag 359 zero-variance cols.
4. Object-column profiling — month, account-type, occupation, gender, region, segment, dates, window.
5. Univariate target separation on the 18 bank-hinted features (KDE + Mann-Whitney U).
6. Target rate by `F3889` (window) and `F2230` (month) — quantify temporal/window drift.

### Phase 2 — Preprocessing ([src/preprocess.py](src/preprocess.py))
**Owns the dedupe audit end-to-end. Order matters — dedupe first.**
1. Drop `Unnamed: 0`.
2. Drop 359 zero-variance numeric cols.
3. Drop cols with >80% missing (keep 50–80% bracket; trees tolerate).
4. **Duplicate-column audit + dedupe**: hash columns on full data, confirm the 632 groups / 2,688 columns, keep one representative per group, persist mapping to `data/processed/dup_map.json`. Expect ~2,500 cols out.
5. Object handling:
   - `F3888` (dates): parse → unix epoch numeric + extract year/month.
   - `F2230` (snapshot month): ordinal-encode, but **never use in features** — only as a split key (prevents temporal leakage).
   - `F3886, F3889, F3890, F3891, F3892, F3893`: target/frequency encoding (low cardinality).
6. **Filter rows for supervised training:** drop `F3889 ∈ {L7D, L14D, L90D}` (zero positives — unusable for classification; route to anomaly side-channel only).
7. Imputation: leave NaN as-is for tree models; for linear baseline, median-impute + `_was_missing` indicator on top-k features.
8. **Pre-split cross-tab (methodological rule, always run before committing to a split):**
   - Cross-tab target against every low-cardinality categorical column (≤ 30 unique values) and against binned versions of date-like columns.
   - **Cardinality-coincidence rule:** exact cardinality matches between the rare label and any other rare category are treated as identity until proven otherwise. (This is the rule that would have flagged `F2230 ≡ target` immediately in the first round.)
   - Persist as `data/processed/pre_split_crosstab.json`. Surfaced in `reports/data_audit.md`.

9. **Splits:**
   - **Stratified 70/30 on target** `F3924` across the full supervised pool (8,402 rows after anomaly filter). Train ≈ 5,881 rows / 57 positives. Test ≈ 2,521 rows / 24 positives.
   - **Stratified 5-fold CV × 3 seeds** on the 70% train pool for hyperparameter tuning.
   - **Bootstrap 95% CI** on holdout metrics (1,000 resamples of the test set) — quantifies small-N noise honestly.
   - **Reference-set framing abandoned** — every non-Oct25 row is positive, so there is no separate "future-confirmation" cohort distinct from the positive class.
   - Group-aware if the data provider confirms multiple rows per account; default for now is row-independent.

10. **Two-step leakage audit:**
    - **(a) F2230-collinearity sweep — auto-drop:** Pearson `|corr|` with binary `non_oct25` indicator `> 0.95`. These are snapshot-month proxies; dropped unconditionally. Persisted to `leakage_audit.json`.
    - **(b) Target-collinearity sweep — flag for manual audit:** on remaining features, Pearson `|corr|` with target `F3924` `> 0.95`. **Not auto-dropped.** Each flagged column gets a one-line justification in `reports/data_audit.md` (e.g., "FMS-flag feature the bank already uses — keep"). Catches label-leakage paths that aren't F2230-flavored.

### Phase 3 — Feature engineering & selection ([src/features.py](src/features.py))
With ~2,500 deduped columns and 81 positives, prune aggressively.

1. **Seed set:** the 18 bank-hinted features → train minimal LightGBM → record "honest floor" PR-AUC.
2. **Filter stage:** mutual information + univariate AUC vs target; keep top ~500.
3. **Embedded stage:** LightGBM on filtered set; keep features with non-zero gain.
4. **Stability selection (bootstrap, not k-fold):** 50 bootstrap resamples at 80% with replacement; refit LightGBM on each; keep features with non-zero gain in **≥30 of 50 bootstraps**. More stable than 3-of-5 fold inclusion given ~16 positives per fold.
5. **Pivot exploration (if confirmed):** if data provider says rows are (account × window), pivot `F3889` wide so a single model row covers all windows for one account. Until confirmed, treat `F3889` as a categorical feature.
6. **No SMOTE.** Imbalance handled via `scale_pos_weight = neg/pos ≈ 111` and threshold optimization. If augmentation is required, use Gaussian noise injection on positives (jittering), not synthetic-neighbor generation.

### Phase 4 — Modeling ([src/models.py](src/models.py))

| Model | Role |
|---|---|
| Logistic Regression (L1) on seed-18 | Interpretable floor for the report |
| Random Forest | Robust baseline |
| **LightGBM on seed-18** | **Like-for-like leakage benchmark** |
| **LightGBM on full deduped set** | Primary candidate (NaN-aware, fast) |
| **XGBoost** | Secondary candidate; ensemble member |
| Isolation Forest | Unsupervised anomaly score. Used (a) as a feature for the supervised model on labeled windows, and (b) as a raw alert signal routed to analysts for L7D/L14D/L90D rows. **Not evaluated as a classifier** — those windows have zero positives, so precision/recall are undefined |

**Imbalance lever order:** `scale_pos_weight` → threshold tuning → (only if needed) noise injection.

**Leakage audit (mandatory, 30 minutes) — like-for-like:**
- Train **LightGBM on seed-18** → record CV PR-AUC. This is the honest benchmark (same algorithm as the full model, so the gap reflects features only, not algorithm class).
- Train **LightGBM on full deduped set** → if PR-AUC gap > 0.15, investigate top features.
- **Asymmetric feature-importance check:**
  - `F2230` (snapshot month) ranking high → **stop and investigate**. Snapshot month should not carry mule signal; high importance suggests the label is a function of snapshot timing (label-time leakage).
  - `F3889` (time window) ranking high → **note and move on**. It was handed to us by the bank as a useful feature; importance is expected.
- Also keep LR-on-seed-18 trained, but only as the interpretable floor in the report — not as the leakage benchmark.

### Phase 5 — Evaluation ([src/evaluate.py](src/evaluate.py))
Accuracy is meaningless at 0.89% prevalence. Report:

- **Headline metric: Precision @ top-1% alerts.** Operational; doesn't depend on the small positive count in test; matches what banks actually run on.
- **Secondary:** PR-AUC (average precision) **with bootstrap 95% CI from 1,000 resamples of the test set** — explicitly noisy on 24 test positives, CI bars are part of the reporting.
- **Tertiary:** ROC-AUC, Recall @ Precision=0.5, F2 score, confusion matrix at chosen threshold.
- **Threshold tuning objective (committed):** maximize **Precision@top-1%** on validation. Rationale: analyst capacity is the binding constraint in production; the threshold corresponds to the daily alert budget.
- **Calibration:** Isotonic regression wrapper on final model; reliability diagram + Brier score.
- **Protocols (report both):**
  - Stratified 5-fold × 3 seeds on the 70% train pool — for hyperparameter selection; report mean ± std.
  - **30% stratified holdout** (full supervised pool, target-stratified) — bootstrap 95% CI from 1,000 resamples.
- **Latency:** `benchmark.py` measures p50/p95/p99 of `score(account)` over 1,000 calls. Numbers go on the demo slide.

### Phase 6 — Interpretability & alerting ([src/explain.py](src/explain.py))
- **Global:** SHAP summary on winning model; verify bank-hinted features rank high (sanity check).
- **Local:** per-account SHAP force plot → exportable reason codes (compliance requirement).
- **Risk bands** (calibrated probability):
  - Low < 0.30 — allow + log
  - Medium 0.30–0.70 — step-up auth / soft alert
  - High > 0.70 — hold outgoing leg, route to analyst (15-min SLA)
  - Hard hit (I4C/CFCFRMS match) — freeze, draft STR
- **Drift monitor:** PSI on top-20 features comparing new batches vs training.

### Phase 7 — Static-dataset deliverables
1. `reports/final_report.pdf`
2. Notebooks 01–04.
3. `models/best_model.pkl` (version-tagged) + `predict.py` CLI.
4. **`reports/model_card.md`** (one page): intended use, training data summary, performance per segment (by window `F3889`, snapshot month `F2230`, account type `F3886`, **gender `F3892`, region `F3890`, occupation `F3891`** — disparate-impact slicing per RBI FREE-AI framework), known limitations, ethical considerations, retraining triggers.
5. **Model versioning hash:** every pickled model tagged with `sha256(train_data_hash + sorted_feature_list + hyperparams_json + git_sha)`. Stored in `models/<hash>.pkl` with a `models/registry.json` index. Makes champion/challenger comparisons in the feedback loop demo verifiable, not asserted.

### Phase 8 — Streaming ingestion (production architecture)

| Source | Mode | Role |
|---|---|---|
| Core banking txn stream (UPI/IMPS/NEFT/RTGS/cards/AePS/branch) | Kafka | Primary signal; cross-channel velocity = strongest mule indicator |
| FMS / TMS alerts | Kafka / webhook | Features, not labels |
| I4C / CFCFRMS / NCRP tickets | REST + SFTP | High-confidence positive labels + hard-block list |
| RBI advisories, FIU-IND watchlists | File feed | Hard rules |
| KYC / CDD profile | DB join | Demographic baseline |
| Device / IP / geo / SIM-bind | Event stream | Mule signature: many accounts, one device |

All sources normalize to a **canonical Txn schema** (Avro on schema registry): `{channel, account_id, counterparty, amount, ts, device_fp, ip, geo, channel_ref}`.

### Phase 9 — Real-time features & scoring
- **Feature store:** Feast (online: Redis; offline: Parquet on S3/MinIO).
- **Online windowed features** (Flink):
  - Velocity: txns/hr, unique counterparties/hr, max single-txn amount today
  - Fan-in/fan-out over 24h
  - Channel diversity in last 1h
  - Structuring (txns just under ₹50k / ₹2L thresholds)
  - Dormancy break (txn after N inactive days)
  - Beneficiary novelty (% never-seen counterparties)
  - Device sharing (other accounts on same device_fp / IP)
- **Graph layer:** **synthetic for the hackathon dataset** (no counterparty columns exist). Built by [src/build_synthetic_graph.py](src/build_synthetic_graph.py): cosine similarity of the top-20-SHAP feature vectors across the top-50 highest-scoring test accounts, edges kept above a top-10%-of-pairs threshold (with a 0.30 floor), spring-laid out via NetworkX, served at `GET /graph` and rendered by the [BehavioralCluster](ui/src/components/BehavioralCluster.tsx) panel in the analyst console. Production path: Neo4j fed by real transfer edges from Kafka.
- **Scoring API:** FastAPI + ONNX-exported LightGBM, returns `{score, band, top_reasons, matched_rules}`. Latency target < 100 ms p95 — measured via `benchmark.py`.

### Phase 10 — Decision & prevention layer

| Risk band | Account state | Action |
|---|---|---|
| Low | Any | ALLOW + log |
| Medium | New / low-history | STEP-UP auth (OTP + device check) |
| Medium | Established | ALLOW + soft alert to TMS queue |
| High | Any | HOLD outgoing leg + 15-min analyst SLA |
| Hard hit (I4C/CFCFRMS/FIU watchlist) | Any | FREEZE credit, draft STR, notify nodal officer |

Decision engine = small rules service (Python or OPA), separate from the model so policy changes don't require retraining.

### Phase 11 — Operational surfaces
1. **Analyst console** (Streamlit): alert queue, risk band, top SHAP reasons, account history, graph neighbors; one-click disposition writes back to labeled feedback table.
2. **Management dashboard:** alerts/day, precision@K trend, channel-wise mule density, detection-to-action latency, recovery amount.
3. **Feedback loop (demo this explicitly):** "Mark this account false-positive → row appears in retraining queue in < 60 s." Monthly retrain Airflow DAG with champion/challenger; off-cycle retrain triggered by PSI drift on top features.
4. **Explainability persistence:** every flagged account stores its SHAP reasons + matched rules. Required for STR filing and dispute handling.
5. **Audit:** WORM log of every decision tagged with model/feature/rule versions.

### Phase 12 — Submission scope

**Must-have for the demo (end-to-end, judges can click):**
- Trained model from Phases 1–6 with reported PR-AUC, Recall@P=0.5, Precision@top-1%, calibration plot, latency numbers.
- Kafka producer that replays `DataSet.csv` rows as a synthetic stream.
- FastAPI scoring service + decision engine implementing the policy matrix above.
- Streamlit analyst console showing live alerts with SHAP reasons and the **closed feedback loop**.
- One simulated I4C ticket feed (JSON file) → auto-FREEZE pathway.
- Synthetic graph view of one detected "mule ring" (cosine cluster of flagged accounts).
- `benchmark.py` latency report on the demo slide.
- One-page Model Card.

**Stretch (mention in report as roadmap; build if time permits):**
- Feast feature store wiring.
- Neo4j graph backend.
- Airflow retrain DAG.
- STR auto-draft for FIU-IND.

---

## 4. Risks & open questions

1. **81 positives is small.** Any single feature can dominate CV by chance — stability selection and repeated CV are the safeguards.
2. **Anonymized features (F1–F3924)** — SHAP outputs name columns the report can only describe statistically without a data dictionary.
3. **Missingness semantics unknown** — "not applicable" vs "not recorded" changes whether `_was_missing` is signal or noise. Open question for data provider.
4. **Row independence assumed but not confirmed** — defaulting to row-independent; switch to group-aware CV if provider confirms multiple rows per account.
5. **Zero positives in L7D/L14D/L90D windows** — coincidence or label-application artifact? If artifact, the model can't generalize to short-window scoring without unsupervised augmentation.
6. **`F2230` snapshot-month leakage — CONFIRMED as identity** (`F2230 ≡ target`: every non-Oct25 row is positive and every Oct25 supervised row is negative). Mitigated by hard exclusion from features + two-step collinearity audit (F2230-collinear auto-dropped; target-collinear flagged for manual review). Documented in Section 1 and `reports/data_audit.md`.

### Methodological lesson (general rule for future fraud-analytics work)

**Cardinality coincidences are identity until proven otherwise.** When a rare label count exactly matches the count of any other rare category in the data (e.g., 81 positives ↔ 81 non-Oct25 rows), assume they are the same set and verify before doing anything else. The first round of this project flagged the coincidence but did not crack it open; the second round caught it via the leakage audit before any modeling started. The rule prevents this from being a two-round process in future. → **always run target × every-rare-categorical cross-tab before committing to a split strategy** (now Phase 2 step 8).
7. **Production graph requires data we don't have** — call out explicitly so demo Q&A isn't a surprise.

---

## 5. Build order (recommended sequencing)

1. **Phase 2 (preprocess + duplicate audit + dedupe + split scaffold)** — highest leverage; unblocks everything. Owns the dedupe audit step end-to-end.
2. **Phase 1 EDA** — runs against the deduped frame as confirmatory analysis (not preparatory).
3. **Phase 3 → 4 → 5** — feature selection, model, evaluation, leakage audit, calibration.
4. **Phase 6** — explainability + risk bands.
5. **Phase 7** — model card + report draft.
6. **Phase 8–11 demo skeleton** in parallel with report writing: Kafka replay → FastAPI → Streamlit → feedback loop.
7. **Phase 12** — polish, latency numbers on slide, dry-run the demo script end-to-end.

---

## 6. Demo script (90 seconds)

1. "Here's the dataset — 9,082 accounts, 0.89% mule. We dedupe 2,688 redundant columns first; nothing else does this." (Slide: before/after column count.)
2. "Honest-floor model on the 18 bank-hinted features gets X PR-AUC. Full model gets Y. The gap is N — no leakage." (Slide: leakage-audit table.)
3. "Headline metric: Precision @ top-1% alerts = X. PR-AUC = Y, bootstrap 95% CI [Y_lo, Y_hi] — yes the test set has only 24 positives, here's the noise quantified." (Slide: Precision@top-1% bar + PR-AUC with CI bars.)
4. "Live: I replay account snapshots through the scoring pipeline at production rate. Account 4729 scores 0.84 → HIGH → outgoing leg held. Top reasons: F2122, F3043, F2956. In production this same pipeline consumes the live transaction stream." (Live screen.)
5. "Now I simulate an I4C ticket naming the same account → auto-FREEZE, STR drafted." (Live screen.)
6. "Analyst marks account 1183 as false-positive → it appears in the retrain queue. Closed loop." (Live screen.)
7. "Latency: 38 ms p95. Model card and audit log live in the repo." (Slide: benchmark + model card.)
