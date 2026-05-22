// Plausible-banking interpretations distilled from reports/feature_semantics.md.
// Missing entries fall back to "Behavioral feature" in adapt.ts.

export interface FeatureLabel {
  short: string;
  desc: string;
}

export const FEATURE_SEMANTICS: Record<string, FeatureLabel> = {
  F3898: { short: "Account-history depth", desc: "Plausibly txn count over a long horizon. Low value → shallow history → mule risk." },
  F3914: { short: "Sparse activity flag",  desc: "0/1-style indicator. Triggered presence often coincides with mule profile." },
  F3484: { short: "Normalized ratio",       desc: "Mean-shifted feature; tail distinguishes classes." },
  F2391: { short: "Pattern consistency",    desc: "Share of regular-pattern transactions. Mules cluster near 0." },
  F3908: { short: "Anomaly flag",           desc: "Plausibly a velocity-spike / device-share / first-credit flag." },
  F937:  { short: "Heavy-tail counter",     desc: "Most accounts at 0; positive tail differentiates classes." },
  F154:  { short: "Concentration ratio",    desc: "Share of outflow to a single beneficiary. Mules near upper limit." },
  F3700: { short: "Churn / retention",      desc: "Tight-range normalized score; mules half the median." },
  F2382: { short: "Activity consistency",   desc: "Stability of activity pattern. Mules don't accumulate this." },
  F1863: { short: "Maintained balance",     desc: "Currency-scale; non-mules carry ~2× the median." },
  F2489: { short: "Bimodal predictor",      desc: "Non-monotonic — model exploits both modes." },
  F2383: { short: "Activity consistency",   desc: "Same family as F2391/F2382 — mules near 0." },
  F3805: { short: "Lifetime txn volume",    desc: "Cumulative transaction amount. Mules at ~16% of typical levels." },
  F2032: { short: "Limit-utilization flag", desc: "Near-saturation indicator." },
  F3825: { short: "Flow share",             desc: "Outflow/inflow ratio. Mules shifted higher." },
  F471:  { short: "Normalized counter",     desc: "Subtle class separation." },
  F270:  { short: "Concentration metric",   desc: "Same family as F154 — mules clearly higher." },
  F3105: { short: "Counterparty count",     desc: "Distinct merchants/counterparties. Mules ~⅓ of legit." },
  F2637: { short: "Signed momentum",        desc: "Trend score. Mules sit closer to zero." },
  F53:   { short: "Saturation indicator",   desc: "Bounded 0–1; mules at the cap." },
  F3887: { short: "Bank-recommended",       desc: "Among 18 bank-hinted features; bootstrap-stable." },
  F3889: { short: "Time window",            desc: "L7D/L14D/.../G365D — aggregation horizon." },
  F3891: { short: "Occupation",             desc: "Customer occupation, frequency-encoded." },
  F2586: { short: "Behavioral feature",     desc: "Bootstrap-stable predictor, non-linear contribution." },
  F1323: { short: "Behavioral feature",     desc: "Bootstrap-stable predictor." },
  F3811: { short: "Behavioral feature",     desc: "High univariate AUC (0.81) on its own." },
  F3534: { short: "Behavioral feature",     desc: "Bootstrap-stable predictor." },
};
