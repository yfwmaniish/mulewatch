# Model Results

Git SHA: `no-git` · Train data hash: `b5f14e5eecf84942`

## 1. Headline comparison

| Model | Features | **Precision @ top-1%** | PR-AUC | 95% CI | ROC-AUC | Recall @ P=0.5 | F2 | Hash |
|---|---:|---:|---:|---|---:|---:|---:|---|
| LR-L1 on seed-18 (interpretable floor) | 18 | **0.120** | 0.056 | [0.021, 0.158] | 0.757 | 0.000 | 0.202 | `589812e68ce56bb3` |
| LightGBM on seed-18 (leakage benchmark) | 18 | **0.280** | 0.330 | [0.157, 0.547] | 0.826 | 0.292 | 0.333 | `58daafbc0a44197d` |
| LightGBM on stable features (primary) | 385 | **0.760** | 0.869 | [0.743, 0.969] | 0.994 | 0.833 | 0.819 | `0a447c986cd0e73a` |

Headline metric is **Precision @ top-1% alerts** — operational; matches analyst capacity. PR-AUC reported with bootstrap 95% CI (1,000 test-set resamples) because the test set has 24 positives and any single-point PR-AUC is noisy at that scale.

## 2. Leakage audit (like-for-like, LightGBM-on-seed-18 vs LightGBM-on-full)

- **LightGBM on seed-18 PR-AUC:** 0.3305
- **LightGBM on stable features PR-AUC:** 0.8690
- **Gap:** +0.5386
- **Threshold:** < 0.15
- **Initial verdict:** INVESTIGATE
- **Post-investigation verdict:** **CLEARED — gap explained by distributed signal, not hidden leakage**

_Same algorithm on both sides means the gap reflects features only, not algorithm class. The threshold firing triggers investigation; the investigation below determines whether the gap reflects leakage or distributed signal._

### Investigation A — leakage signatures on top-10 features

Computed `corr` of each top-10 feature with the `non_oct25` indicator. None should be hiding just below the 0.95 auto-drop threshold from preprocess.

| Rank | Feature | Gain | corr with non_oct25 |
|---:|---|---:|---:|
| 1 | `F3898` | 103508.0 | -0.0532 |
| 2 | `F3914` | 73914.8 | -0.0499 |
| 3 | `F2586` | 19353.4 | -0.0032 |
| 4 | `F1323` | 15206.2 | -0.0157 |
| 5 | `F3887` | 11288.3 | -0.0095 |
| 6 | `F3811` | 11191.8 | -0.0046 |
| 7 | `F3484` | 10676.2 | +0.0292 |
| 8 | `F1065` | 8528.3 | -0.0037 |
| 9 | `F949` | 7487.0 | -0.0056 |
| 10 | `F2295` | 6846.0 | -0.0250 |

Max `|corr|` across top-10 features: **0.0532** (threshold for concern: > 0.5).

### Investigation B — monotonic gradient on a richer baseline

If the gap reflects hidden leakage in some non-seed feature, top-20-by-univariate-AUC should either jump abruptly toward the stable-385 number, or stay flat at seed-18 levels. A smooth middle reading is evidence of distributed signal, not a single leakage path.

| Feature set | Size | PR-AUC | Precision@top-1% |
|---|---:|---:|---:|
| seed-18 (bank-recommended) | 18 | 0.3305 | 0.280 |
| **top-20 by univariate AUC** | **20** | **0.6238** | **0.640** |
| stable (bootstrap-selected) | 385 | 0.8690 | 0.760 |

Gradient is **0.330 → 0.624 → 0.869** — smooth.

### Sub-finding: stability selection was load-bearing, not ceremonial

The 365 features added by bootstrap stability beyond the top-20-by-univariate-AUC contribute **+0.245 PR-AUC** (0.624 → 0.869). That's interactive signal a univariate filter can't surface. Rebuttal to "why not just use top-20 univariate?": tested, it's 24 PR-AUC points worse.

### Conclusion

Audit fired (gap +0.539 > 0.15); both investigations clear it. Bank-hinted seed-18 features are individually weak (F3887 univariate AUC = 0.53); real signal lives in distributed interactions across hundreds of behavioral features.

## 3. Top features (LightGBM on stable set)

| Rank | Feature | Gain |
|---:|---|---:|
| 1 | `F3898` | 103508.0 |
| 2 | `F3914` | 73914.8 |
| 3 | `F2586` | 19353.4 |
| 4 | `F1323` | 15206.2 |
| 5 | `F3887` | 11288.3 |
| 6 | `F3811` | 11191.8 |
| 7 | `F3484` | 10676.2 |
| 8 | `F1065` | 8528.3 |
| 9 | `F949` | 7487.0 |
| 10 | `F2295` | 6846.0 |

F2230 in features: **False** (should be False — hard exclusion is enforced in preprocess).
F3889 (window — bank-recommended) rank: **None** (high rank is expected, not suspicious).

## 4. Model versioning

Every model file at `models/<hash>.pkl` is a `joblib` pickle with `{model, features, metrics}`. The hash is `sha256(train_data_hash + sorted_feature_list + hyperparams_json + git_sha)[:16]`. Indexed in `models/registry.json`.

## 5. Reproduce

```powershell
python -m src.preprocess --input DataSet.csv --out data/processed
python -m src.data_audit --processed data/processed --out reports/data_audit.md
python -m src.features  --processed data/processed --reports reports
python -m src.models    --processed data/processed --models models --reports reports
```
