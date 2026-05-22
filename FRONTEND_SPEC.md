# Frontend Specification

Living document for the analyst console. **UI is the "hacky bank" MuleWatch shell** (Donezo-style sidebar + header + multi-view SPA) wired to the live FastAPI scoring service from Day 1.

## 1. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14.2 · App Router · React 18 |
| Styling | Tailwind 3.4 (light theme, no CSS-in-JS) |
| Icons | `lucide-react` |
| State | React Context (`AlertContext`) — no React Query, no Redux |
| Data fetching | Native `fetch` via thin client in [ui/src/lib/api.ts](ui/src/lib/api.ts) |

The hacky bank shell intentionally avoids heavy primitive libraries (no shadcn, no Radix). Every interactive element is built from `<button>`/`<div>` + Tailwind + lucide-react. This keeps the bundle tight (111 kB First Load JS) and the look perfectly consistent.

## 2. Architecture

```
                       ┌─────────────────────────────┐
                       │   FastAPI (port 8000)       │
                       │   - calibrated LightGBM     │
                       │   - precomputed SHAP cache  │
                       │   - decisions.jsonl audit   │
                       └────────────┬────────────────┘
                                    │ fetch JSON
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │  ui/src/lib/api.ts          (HTTP client)               │
       │  ui/src/lib/api-types.ts    (response shapes)           │
       │  ui/src/lib/adapt.ts        (API → AccountAlert)        │
       │  ui/src/lib/synthesize.ts   (deterministic decoration)  │
       │  ui/src/lib/feature-semantics.ts                        │
       └──────────────────────┬──────────────────────────────────┘
                              │ AccountAlert[]
                              ▼
       ┌─────────────────────────────────────────────────────────┐
       │  ui/src/context/AlertContext.tsx                        │
       │  - loads /accounts on mount                             │
       │  - lazy /accounts/{id} on row select (SHAP)             │
       │  - /feedback + /tickets/i4c mutations                   │
       │  - apiStatus / modelVersion / refresh                   │
       └──────────────────────┬──────────────────────────────────┘
                              │ useAlerts()
                              ▼
       ┌─────────────────────────────────────────────────────────┐
       │  ui/src/app/page.tsx (SPAConsoleContainer)              │
       │  ui/src/components/{CommandMenu,Donezo,Header,…}        │
       │  ui/src/app/SidebarNav.tsx                              │
       └─────────────────────────────────────────────────────────┘
```

## 3. Real vs synthesized data

| Field | Source | Notes |
|---|---|---|
| Calibrated score | API (`/accounts/{id}`) | **Real** — from frozen LightGBM `c4a43cb2b9a69325` |
| Risk band | API + `decide()` policy | **Real** |
| SHAP top reasons (`shapExplanations`) | API | **Real** SHAP values; descriptions from [feature_semantics.md](reports/feature_semantics.md) |
| Account demographics (type, region, occupation, gender, segment, open date, window) | API `profile` (raw CSV) | **Real** — `F3886`, `F3890`, `F3891`, `F3892`, `F3893`, `F3888`, `F3889` |
| Matched I4C rules | API | **Real** — written when `POST /tickets/i4c` fires |
| Display account ID (`MULE_AC_<n>_<hash>`) | `synthesize.synthesizeDisplayId` | Synthesized — deterministic hash suffix |
| Customer name | `synthesize.synthesizeCustomerName(id, gender)` | Synthesized — pool of common Indian names, gender-aware |
| KYC status | `synthesize.synthesizeKycStatus` | Derived — deterministic from band + id |
| Counterparty list | `synthesize.synthesizeCounterparties` | **Demo only** — dataset has no counterparty edges |
| Ambient stream events (`streamEvents`) | `setInterval` random | **Demo only** — for visual liveness |
| Retrain queue counter | API (`/feedback` response) | **Real** |
| Total processed (`9082`) | API (`/health.accounts_loaded`) | **Real** |
| Analyst feed, recent logs | Local in-memory | Demo decoration |

Footnote that should appear once in the Account Detail panel:
> Customer name, KYC status, and counterparty ledger are synthesized for visualization — the dataset is anonymized.

## 4. Data contracts

API contracts are owned by [service/api.py](service/api.py) and mirrored into [ui/src/lib/api-types.ts](ui/src/lib/api-types.ts). Translation between the API shape (`ApiAccountDetail`) and the UI shape (`AccountAlert`) lives in [ui/src/lib/adapt.ts](ui/src/lib/adapt.ts).

When `AlertContext` calls a mutation:
- `markAsFalsePositive(displayId)` → `parseNumericId()` → `POST /feedback`
- `executeSystemBlock(displayId)` → `POST /tickets/i4c` → re-fetch `/accounts/{id}` so band updates to FREEZE

## 5. Polling cadence

| Action | Frequency |
|---|---|
| Initial alerts fetch | once on mount |
| `/health` heartbeat (sets `apiStatus` + `modelVersion`) | every 5 s |
| Ambient stream tick | every 1.5 s (synthetic) |
| Detail fetch (SHAP) | on row select, cached thereafter |

`refreshAlerts()` is exposed so a manual refresh button (Day 11 polish) can wire to it.

## 6. Running locally

```powershell
# Terminal 1 — API (Day 1)
python -m uvicorn service.api:app --port 8000

# Terminal 2 — UI (Day 2/3)
cd ui
npm install      # first time only
npm run dev
# open http://localhost:3000
```

If the API is offline the UI shows `apiStatus = 'offline'` and the queue is empty; once it comes back, `refreshAlerts()` repopulates.
