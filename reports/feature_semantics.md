# Feature Semantics Map

The dataset's features are anonymized (`F1`–`F3924`) — there is no data dictionary. This document is what we can infer from **value distributions** + **SHAP direction** + **banking domain context**.

> **The word "plausibly" does all the work.** Every interpretation below is a hypothesis grounded in (a) how the feature's distribution differs between mule and non-mule accounts and (b) what kinds of behavioral signals banks typically engineer. None of it is verified against a data dictionary.

## Method

1. Train primary LightGBM (conservative-regularized, on 385 bootstrap-stable features).
2. Compute SHAP values on the 30% test holdout (24 positives).
3. Rank features by mean `|SHAP|`. Take top 20.
4. For each top feature, compare class distributions on the train set (5,881 rows / 57 positives).
5. Combine distribution + SHAP direction into a plausible banking interpretation.

## Top 20 features

Distribution columns: `neg_med` = median for non-mule accounts, `pos_med` = median for mule accounts.

| Rank | Feature | neg median | pos median | NA% | Model direction | Plausible banking interpretation |
|---:|---|---:|---:|---:|---|---|
| 1 | `F3898` | 3.0 | 1.0 | 0% | low → mule | Account-history depth proxy. Non-mules have 3× the value of mules. Plausibly txn count over a long horizon, count of active relationships, or stability score. |
| 2 | `F3914` | 0.0 | 0.0 | 0% | sign mixed | Sparse 0/1-range indicator with non-monotonic relation. Plausibly a flag-style feature (e.g. "channel ever used") whose presence interacts with other features. |
| 3 | `F3484` | 0.020 | 0.020 | 0.1% | small +mule | Mean shift, not median shift. Plausibly a normalized ratio whose tail distinguishes classes. |
| 4 | `F2391` | 0.76 | 0.0 | 43.6% | low → mule | Mules' median is 0 while non-mules' is 0.76, on a 0–1-bounded feature. **Plausibly a "share of regular-pattern transactions" or "stability of beneficiary set" metric.** High missingness suggests this is computed only when sufficient history exists. |
| 5 | `F3908` | 0.0 | 1.0 | 0% | high → mule | Strong binary-flavored signal. Non-mules cluster at 0; mules cluster at 1. Plausibly a flag — e.g. "account has had a velocity spike", "device shared with another account", or "received a high-value first credit recently". |
| 6 | `F937` | 0.0 | 0.0 | 0.2% | tail-driven | Both medians are 0 but the right tail is heavy and class-differential. Plausibly a count of something most accounts have 0 of (e.g. failed authentication attempts, cross-channel debits over a threshold). |
| 7 | `F154` | 0.62 | 1.0 | 20.9% | high → mule | Bounded 0–1 ratio. Mules tend toward the upper limit. Plausibly a "concentration ratio" — e.g. share of total outflow to a single beneficiary. |
| 8 | `F3700` | 0.020 | 0.010 | 0% | low → mule | Small numeric in a tight range; mules half the median. Plausibly a normalized churn / retention proxy. |
| 9 | `F2382` | 0.54 | 0.0 | 27.0% | low → mule | Mules' median is 0 (no signal); non-mules' median ~0.54. Plausibly a "consistency of activity pattern" score that mules don't accumulate. |
| 10 | `F1863` | 194,625 | 98,902 | 0% | mixed | Currency-scale value; non-mules ~2× mules. Plausibly an average / cumulative balance or maintained-balance metric. |
| 11 | `F2489` | 1.49 | 0.38 | 34.5% | low → mule | Mules' median lower, but right tail heavy for mules (mean 47 vs 9.5). Non-monotonic — model exploits both modes. |
| 12 | `F2383` | 0.55 | 0.01 | 34.2% | low → mule | Same pattern as F2391 / F2382 — mules cluster near 0 on a 0–1-bounded "consistency" feature. |
| 13 | `F3805` | 1,215,243 | 192,227 | 0% | low → mule | Currency-scale; non-mules ~6× mules. Strong signal. Plausibly cumulative transaction volume or lifetime credit amount — mule accounts are typically short-lived. |
| 14 | `F2032` | 0.99 | 1.0 | 0.1% | high → mule | Tight 0.99/1.0 distinction. Plausibly a "fully-used" indicator (e.g. limit utilization at 100%). |
| 15 | `F3825` | 0.47 | 0.68 | 0% | high → mule | Mid-range ratio shifted upward in mules. Plausibly a "fraction of outflow vs inflow" or "share of digital channels". |
| 16 | `F471` | 1.13 | 1.06 | 33.1% | small +mule | Subtle separation. Plausibly a normalized counter. |
| 17 | `F270` | 0.40 | 0.73 | 33.2% | high → mule | Bounded 0–1; mules clearly higher. Plausibly a concentration metric similar to F154. |
| 18 | `F3105` | 136 | 51 | 33.3% | low → mule | Integer-scale; non-mules ~2.7× mules. Plausibly a count of distinct counterparties / merchants / past txns — mule accounts have narrow counterparty sets. |
| 19 | `F2637` | -0.10 | -0.03 | 0.8% | high → mule | Negative-valued feature where mules sit closer to zero. Plausibly a signed momentum / trend score. |
| 20 | `F53` | 0.60 | 1.0 | 25.7% | high → mule | Bounded 0–1; mules at the cap. Plausibly a "saturation" or "concentration" indicator. |

## Patterns the model is learning

Grouping the top 20 into thematic families:

1. **Account-history depth (low → mule):** F3898, F3805, F3105, F2391, F2382, F2383. Mule accounts are short-lived and have shallow behavioral history — across multiple anonymized metrics, the consistent story is "less of everything legitimate."
2. **Concentration ratios (high → mule):** F154, F270, F3825, F53. Mules concentrate flows — to a small set of beneficiaries, channels, or counterparties. This matches the textbook mule pattern of receiving from many sources and forwarding to few.
3. **Binary-flagged anomalies:** F3908, F937, F2032. Sparse high-value indicators that mules trigger more often. Plausibly engineered fraud flags or threshold-crossing markers.
4. **Currency-scale magnitudes:** F1863, F3805. Mule accounts move less total money than legitimate ones — consistent with their role as transient relay points rather than long-term holding accounts.

## How this informs the demo

When the analyst console surfaces "top reasons" for a flagged account, the SHAP attributions land predominantly on these features. A typical High-band alert reads: "F3898 (low — shallow history), F154 (high — concentration), F3908 (1 — flagged anomaly), F3805 (low — small lifetime volume)". A judge from a banking background will recognize the pattern even without the data dictionary.

## Limitations

- **No verification possible.** All interpretations are hypotheses, not facts. A real banking deployment would map these to the feature engineering catalog before stating any of them in customer-facing explanations.
- **SHAP is a linear approximation per sample.** "High → mule" oversimplifies non-monotonic features (notably F2489, F3914). For UI purposes, "this feature pushed the score up by X" is honest; "high values predict mule" sometimes isn't.
- **24 test positives.** Top-20 ranking by mean `|SHAP|` is robust on this size, but individual rankings 15–20 may shuffle with seed.

## Reproduce

```powershell
python -m src.explain --processed data/processed --models models --reports reports
```
