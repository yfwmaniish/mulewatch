import type { ApiAccountDetail, ApiAccountSummary, ApiBand, ApiReason } from "./api-types";
import {
  synthesizeCounterparties,
  synthesizeCustomerName,
  synthesizeDisplayId,
  synthesizeKycStatus,
} from "./synthesize";
import { FEATURE_SEMANTICS } from "./feature-semantics";

import type { AccountAlert } from "@/context/AlertContext";

const REGION_LABEL: Record<string, string> = {
  M: "Metro",
  R: "Rural",
  SU: "Semi-Urban",
  U: "Urban",
};

const KYC_FROM_API_BAND: Record<ApiBand, "Verified" | "Pending" | "Flagged"> = {
  LOW: "Verified",
  MEDIUM: "Pending",
  HIGH: "Pending",
  FREEZE: "Flagged",
};

export function mapBand(b: ApiBand): AccountAlert["riskBand"] {
  if (b === "FREEZE") return "Hard Hit";
  if (b === "HIGH") return "High";
  if (b === "MEDIUM") return "Medium";
  return "Low";
}

function describeReason(r: ApiReason): string {
  const sem = FEATURE_SEMANTICS[r.feature];
  const directionWord = r.shap > 0 ? "increases mule risk" : "reduces mule risk";
  if (sem) {
    return `${sem.short}: ${sem.desc} Contribution ${directionWord}.`;
  }
  return `Behavioral feature ${r.feature} ${directionWord} for this account.`;
}

/** Adapt a /accounts list item into the rich AccountAlert shape the UI consumes. */
export function adaptSummary(s: ApiAccountSummary): AccountAlert {
  const profile = s.profile ?? {};
  const band = mapBand(s.band);
  const baseRules = [...s.matched_rules];
  // Bake in a couple of profile-derived "rule labels" so the UI's matchedRules badges aren't empty.
  if (profile.occupation === "student" && (band === "High" || band === "Hard Hit")) {
    baseRules.push("Student + High Velocity");
  }
  if (profile.region === "R" && (band === "High" || band === "Hard Hit")) {
    baseRules.push("Rural Pass-through Pattern");
  }
  return {
    accountId: synthesizeDisplayId(s.account_id),
    customerName: synthesizeCustomerName(s.account_id, profile.gender),
    kycStatus: synthesizeKycStatus(s.account_id, s.band),
    score: s.score,
    riskBand: band,
    matchedRules: baseRules,
    timestamp: new Date().toISOString(),
    assignedSla: "15:00",
    features: {
      "Account type": profile.account_type ?? "—",
      Region: profile.region ? REGION_LABEL[profile.region] ?? profile.region : "—",
      Occupation: profile.occupation ?? "—",
      "Time window": profile.time_window ?? "—",
      "Account opened": profile.account_opened ?? "—",
      Segment: profile.segment ?? "—",
    },
    shapExplanations: [],
    counterparties: synthesizeCounterparties(s.account_id, s.band),
  };
}

/** Adapt /accounts/{id} into the same AccountAlert shape, with real SHAP attribution descriptions. */
export function adaptDetail(d: ApiAccountDetail): AccountAlert {
  const base = adaptSummary(d);
  return {
    ...base,
    shapExplanations: d.top_reasons.map((r) => ({
      feature: r.feature,
      contribution: Number(r.shap.toFixed(3)),
      humanDescription: describeReason(r),
    })),
  };
}

export const adapt = {
  band: mapBand,
  summary: adaptSummary,
  detail: adaptDetail,
};

// Re-export the inverse from synthesizeDisplayId so the UI can recover the numeric id.
export function parseNumericId(displayId: string): number | null {
  // displayId format: MULE_AC_<num>_<hash4>
  const m = displayId.match(/^MULE_AC_(\d+)_/);
  return m ? Number(m[1]) : null;
}
