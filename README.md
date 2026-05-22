# Mule Account Detection — PSB IIT Hyderabad

End-to-end AI/ML system for detecting suspicious mule accounts. Builds a calibrated LightGBM classifier on the supplied dataset, then surrounds it with a production-shaped scoring service, a live analyst console, and a replay-driven demo loop.

See [PLAN.md](PLAN.md) for the full project plan and the detailed methodology behind every decision.

## Headline numbers (test holdout, 24 positives)

| Metric | Value |
|---|---:|
| **Precision @ top-1% alerts** | **0.80** |
| PR-AUC (bootstrap 95% CI) | 0.87 [0.74, 0.97] |
| ROC-AUC | 0.96 |
| Brier score (calibration quality) | 0.0024 |
| Scoring API p95 latency | **15.79 ms** |

Detail in [reports/model_results.md](reports/model_results.md) and [reports/calibration.md](reports/calibration.md).

## Run it locally

You need Python 3.11+ and Node 20+.

```powershell
# 1. Python deps
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 2. Build the model + reports (one-time, ~3 minutes)
python -m src.preprocess              --input DataSet.csv  --out data/processed
python -m src.data_audit              --processed data/processed --out reports/data_audit.md
python -m src.features                --processed data/processed --reports reports
python -m src.cv_variance             --processed data/processed --reports reports
python -m src.models                  --processed data/processed --models models --reports reports
python -m src.calibrate               --processed data/processed --models models --reports reports
python -m src.explain                 --processed data/processed --models models --reports reports
python -m src.build_synthetic_graph   --processed data/processed --models models

# 3. Start the scoring API (terminal 1)
python -m uvicorn service.api:app --port 8000

# 4. Start the analyst console (terminal 2)
cd ui
npm install      # first time only
npm run dev
# Open http://localhost:3000

# 5. Demo replay loop (terminal 3, optional)
python -m stream.replay --rate 1.5 --i4c-every 40
```

The console at <http://localhost:3000> reads from the API at <http://localhost:8000>. The replay loop fakes a production stream by re-scoring real test-set accounts every 1.5 s and injecting an I4C ticket every 40 events — both visible in the analyst console and the [audit log](logs/decisions.jsonl).

## Repository layout

```
DataSet.csv                       raw input (9,082 × 3,925)
PLAN.md                           consolidated project plan
README.md
FRONTEND_SPEC.md                  UI architecture + real-vs-synthesized data contract

src/                              model pipeline (preprocess → features → models → calibrate → explain)
service/                          FastAPI scoring service + policy + benchmark
stream/                           replay.py — snapshot stream simulator
ui/                               Next.js MuleWatch console (Hacky Bank Donezo style)

data/
  processed/                      parquet splits, leakage audit, SHAP cache, features lists
  feedback/                       analyst feedback queue + I4C hard-block list

models/                           versioned LightGBM pickles + registry.json (frozen Day 1)
logs/                             decisions.jsonl — append-only score audit log

reports/                          model card, calibration, leakage audit, feature semantics,
                                  cv variance, latency benchmark, data audit
reports/figures/                  reliability diagram, SHAP plots, score distribution
reports/references/               supplied reference PDFs
```

## What is real, what is decoration

| Field surfaced in the UI | Source |
|---|---|
| Score, band, action, SHAP top reasons | API · frozen calibrated LightGBM `c4a43cb2b9a69325` |
| Account demographics (type, region, occupation, gender, segment, open date) | API · real fields from raw CSV |
| Retrain queue counter, total processed, model version | API · `/health` + `/feedback` |
| Matched I4C/CFCFRMS rules | API · written by `/tickets/i4c` |
| Display ID (`MULE_AC_9071_xxxx`) | UI · deterministic hash of numeric id |
| Customer name | UI · deterministic from id + real gender |
| KYC status, counterparty ledger | UI decoration — dataset is anonymized; flagged with footnote |
| Ambient transaction stream | UI decoration — `setInterval` synthetic events |

See [FRONTEND_SPEC.md](FRONTEND_SPEC.md) for the complete data contract.

## Key methodological findings

1. **`F2230 ≡ target`** — every non-Oct25 row in the raw data is positive. Caught by the pre-split cross-tab; F2230 hard-excluded from features and one collinear cousin (`F3912`) auto-dropped. See [reports/data_audit.md](reports/data_audit.md).
2. **Leakage audit fired, then cleared.** Same-algorithm gap LightGBM-on-seed-18 (0.330) vs LightGBM-on-stable (0.869) crossed the 0.15 alarm threshold. Investigation: max `|corr|` of top-10 features with `non_oct25` is 0.06, and the gradient 0.330 → 0.624 → 0.869 across seed-18 → top-20-by-AUC → stable-385 is monotonic. Verdict: distributed signal, not hidden leakage. See [reports/model_results.md §2](reports/model_results.md).
3. **Stability selection was load-bearing.** The 365 features added by bootstrap stability beyond top-20-by-AUC contribute +0.245 PR-AUC.
4. **16 of 18 bank-hinted features survived bootstrap stability.** `F670` (13/50) and `F2082` (1/50) failed.
5. **6 false negatives in Low band are behaviourally normal-looking** — 2–12× the typical mule balance, larger lifetime histories. Mitigation: rules-based hard filters (I4C list, dormancy-break + large debit) that don't depend on behavioral profiling.

## Deliverables index

- [PLAN.md](PLAN.md) — consolidated plan with every methodological decision logged
- [reports/model_card.md](reports/model_card.md) — RBI FREE-AI aligned governance artifact
- [reports/model_results.md](reports/model_results.md) — headline metrics + leakage audit + investigation
- [reports/data_audit.md](reports/data_audit.md) — leakage paths identified and closed
- [reports/feature_selection.md](reports/feature_selection.md) — seed-18 + filter + bootstrap stability
- [reports/calibration.md](reports/calibration.md) — isotonic + reliability diagram + risk-band breakdown
- [reports/cv_variance.md](reports/cv_variance.md) — 5-fold × 3 seeds + hyperparameter bake-off
- [reports/feature_semantics.md](reports/feature_semantics.md) — plausible-banking interpretations
- [reports/latency_benchmark.md](reports/latency_benchmark.md) — measured p50/p95/p99
- [FRONTEND_SPEC.md](FRONTEND_SPEC.md) — UI data contract

## Live demo script (90 seconds)

1. Open the analyst console at <http://localhost:3000> → "API LIVE" pill in header, 40 real alerts in the queue.
2. "Headline numbers — Precision @ top-1% = 0.80, PR-AUC = 0.87 with bootstrap 95% CI [0.74, 0.97], latency p95 = 16 ms." (Cite the report + benchmark.)
3. Start `python -m stream.replay` in a side terminal → audit log scrolls live, header badge climbs.
4. Click the top alert → SHAP reasons appear from the API (`F3914 +1.49 · F3811 +1.15 …`) with banking interpretations.
5. Click **Mark False Positive** → toast shows "retrain queue #N" returned from the API, alert removed.
6. Inject a manual I4C ticket via the dev panel (or wait for the replay's auto-injection) → next score returns `band=FREEZE`, top of queue pulses red.
7. Click **Generate STR Draft** → PDF opens in new tab with real score / SHAP / demographic data populated into the FIU-IND Form V2 layout. Sample [STR_draft_sample.pdf](reports/references/STR_draft_sample.pdf).
8. Switch to **Nodal Officer Network** tab → behavioral-similarity graph showing the 50 highest-scoring alerts clustered by cosine similarity of top-20 SHAP features. 21 confirmed mules visible as ringed nodes.
9. Show <reports/figures/score_distribution.png> — bimodal, 18 of 24 test positives in actionable bands at 100% precision.

## License

See [LICENSE](LICENSE) — MIT, unless overridden by competition terms.
