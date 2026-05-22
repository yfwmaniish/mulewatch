// API response shapes — match service/api.py exactly.
export type ApiBand = "LOW" | "MEDIUM" | "HIGH" | "FREEZE";
export type ApiAction = "ALLOW" | "STEP_UP" | "HOLD" | "FREEZE";

export interface ApiReason {
  feature: string;
  value: number | null;
  shap: number;
  direction: "pushes toward mule" | "pushes toward legit";
}

export interface ApiProfile {
  account_type?: string | null;
  time_window?: string | null;
  region?: string | null;
  occupation?: string | null;
  gender?: string | null;
  segment?: string | null;
  account_opened?: string | null;
}

export interface ApiAccountSummary {
  account_id: number;
  score: number;
  band: ApiBand;
  action: ApiAction;
  matched_rules: string[];
  profile: ApiProfile | null;
}

export interface ApiAccountList {
  total: number;
  page: number;
  page_size: number;
  accounts: ApiAccountSummary[];
}

export interface ApiAccountDetail extends ApiAccountSummary {
  top_reasons: ApiReason[];
  feature_count: number;
  actual_label: number;
  model_version: string;
}

export interface ApiHealth {
  status: string;
  model_version: string;
  loaded_at: string;
  accounts_loaded: number;
  feedback_queue_len: number;
  i4c_list_size: number;
}

export interface ApiFeedbackResponse {
  queued: boolean;
  queue_position: number;
  written_at: string;
}

export interface ApiI4CResponse {
  account_id: number;
  ticket_ref: string;
  hard_block_active: boolean;
  written_at: string;
}

export interface ApiGraphNode {
  id: number;
  account_id: number;
  display_id: string;
  score: number;
  band: "LOW" | "MEDIUM" | "HIGH";
  band_live: "LOW" | "MEDIUM" | "HIGH" | "FREEZE";
  is_positive: boolean;
  matched_rules: string[];
  x: number;
  y: number;
  degree: number;
}

export interface ApiGraphEdge {
  source: number;
  target: number;
  similarity: number;
}

export interface ApiGraph {
  meta: {
    method: string;
    top_n_features: number;
    top_k_accounts: number;
    n_nodes: number;
    n_edges: number;
    n_positive_nodes: number;
    svg_width: number;
    svg_height: number;
    model_version: string;
    caveat: string;
    applied_cutoff: number;
  };
  nodes: ApiGraphNode[];
  edges: ApiGraphEdge[];
}
