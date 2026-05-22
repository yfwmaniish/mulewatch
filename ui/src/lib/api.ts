import type {
  ApiAccountDetail,
  ApiAccountList,
  ApiBand,
  ApiFeedbackResponse,
  ApiGraph,
  ApiHealth,
  ApiI4CResponse,
} from "./api-types";

const API_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8000";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...init,
  });
  if (!res.ok) {
    let detail: unknown;
    try { detail = await res.json(); } catch { detail = await res.text(); }
    throw Object.assign(new Error(`${path} → ${res.status}`), { status: res.status, detail });
  }
  return res.json() as Promise<T>;
}

export const api = {
  baseUrl: API_URL,
  health: () => http<ApiHealth>("/health"),
  listAccounts: (opts?: {
    pageSize?: number;
    sort?: "score_desc" | "score_asc" | "id_asc";
    band?: ApiBand;
  }) => {
    const q = new URLSearchParams();
    q.set("page_size", String(opts?.pageSize ?? 50));
    q.set("sort", opts?.sort ?? "score_desc");
    if (opts?.band) q.set("band", opts.band);
    return http<ApiAccountList>(`/accounts?${q.toString()}`);
  },
  accountDetail: (id: number) => http<ApiAccountDetail>(`/accounts/${id}`),
  submitFeedback: (req: {
    account_id: number;
    verdict: "confirmed" | "false_positive" | "escalate";
    notes?: string;
    analyst_id?: string;
  }) =>
    http<ApiFeedbackResponse>("/feedback", { method: "POST", body: JSON.stringify(req) }),
  submitI4C: (req: { account_id: number; ticket_ref: string }) =>
    http<ApiI4CResponse>("/tickets/i4c", { method: "POST", body: JSON.stringify(req) }),
  graph: () => http<ApiGraph>("/graph"),
  /** Open the STR draft PDF for an account. Returns a blob URL the caller should `window.open`. */
  strDraftUrl: async (req: {
    account_id: number;
    customer_name?: string;
    counterparties?: Array<{ id: string; name: string; amount: number; channel: string; timestamp: string }>;
    analyst_id?: string;
  }): Promise<string> => {
    const res = await fetch(`${API_URL}/str-draft/${req.account_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: req.customer_name,
        counterparties: req.counterparties,
        analyst_id: req.analyst_id,
      }),
    });
    if (!res.ok) throw new Error(`STR draft → ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
};
