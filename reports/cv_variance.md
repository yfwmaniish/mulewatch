# CV Variance + Hyperparameter Bake-off

**Protocol:** 5-fold stratified CV × 3 seeds = 15 folds. Feature set: 385 bootstrap-stable features.

Tuning with Optuna on 65 training positives is theatre — the best config from one CV run won't transfer reliably. Better protocol: pick a conservative-regularized config alongside current defaults, CV both, report variance, choose winner.

## Results

| Config | PR-AUC (mean ± std) | Precision@top-1% (mean ± std) | Folds |
|---|---|---|---:|
| defaults (current primary) | 0.756 ± 0.100 | 0.667 ± 0.081 | 15 |
| conservative-regularized | 0.781 ± 0.087 | 0.694 ± 0.090 | 15 |

**Winner:** conservative-regularized (0.781 mean PR-AUC).

### defaults (current primary) hyperparameters
```json
{
  "n_estimators": 400,
  "learning_rate": 0.05,
  "num_leaves": 31,
  "min_data_in_leaf": 10,
  "n_jobs": -1,
  "verbose": -1
}
```

### conservative-regularized hyperparameters
```json
{
  "n_estimators": 500,
  "learning_rate": 0.05,
  "num_leaves": 15,
  "min_data_in_leaf": 20,
  "reg_alpha": 0.1,
  "reg_lambda": 0.1,
  "n_jobs": -1,
  "verbose": -1
}
```
