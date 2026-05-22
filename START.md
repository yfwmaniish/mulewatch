# How to start the project

Three terminals total. The backend on `:8000`, the frontend on `:3000`, and the replay loop optional.

## Prerequisites (one-time, on a fresh machine)

| Tool | Version | Why |
|---|---|---|
| Python | 3.11+ | model pipeline + API |
| Node.js | 20+ | Next.js dev server |
| Git Bash or PowerShell | any | running the commands |

Verify:

```powershell
python --version    # should print 3.11.x or higher
node --version      # should print v20.x or higher
npm --version
```

---

## First-time setup (run once)

```powershell
# 1. Python dependencies
cd "C:\Projects\PSB IIT Hyderabad"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 2. Build the model + reports (~3 minutes)
python -m src.preprocess              --input DataSet.csv  --out data/processed
python -m src.data_audit              --processed data/processed --out reports/data_audit.md
python -m src.features                --processed data/processed --reports reports
python -m src.cv_variance             --processed data/processed --reports reports
python -m src.models                  --processed data/processed --models models --reports reports
python -m src.calibrate               --processed data/processed --models models --reports reports
python -m src.explain                 --processed data/processed --models models --reports reports
python -m src.build_synthetic_graph   --processed data/processed --models models

# 3. UI dependencies
cd ui
npm install
cd ..
```

You're set up. Skip directly to **Daily run** for every session after this.

---

## Daily run — start the full stack

Open **three PowerShell terminals**, one for each piece.

### Terminal 1 — Backend (FastAPI scoring service)

```powershell
cd "C:\Projects\PSB IIT Hyderabad"
.\.venv\Scripts\Activate.ps1
python -m uvicorn service.api:app --port 8000 --host 127.0.0.1
```

Expected output:

```
[startup] loaded 385 features, 2521 test accounts
[startup] cache built for 2521 accounts, 7 on I4C list
[startup] loaded demographic profiles for 2521 accounts
[startup] loaded behavioral graph: 50 nodes / 122 edges
INFO:     Uvicorn running on http://127.0.0.1:8000
```

Health check (from another terminal):

```powershell
curl http://127.0.0.1:8000/health
```

Should return JSON with `"status": "ok"` and `"model_version": "c4a43cb2b9a69325"`.

### Terminal 2 — Frontend (Next.js analyst console)

```powershell
cd "C:\Projects\PSB IIT Hyderabad\ui"
npm run dev
```

Expected output:

```
▲ Next.js 14.2.x
- Local:        http://localhost:3000
✓ Ready in 1.3s
```

Then **open <http://localhost:3000>** in your browser.

You should see the MuleWatch console with the "API LIVE · c4a43cb2" pill in the top-right.

### Terminal 3 (optional) — Snapshot replay loop

For the live-demo "stream is alive" effect:

```powershell
cd "C:\Projects\PSB IIT Hyderabad"
.\.venv\Scripts\Activate.ps1
python -m stream.replay --rate 1.5 --i4c-every 40
```

This fires a real `/score` call every 1.5 s on a random top-scoring account and triggers an `/tickets/i4c` freeze every 40 calls. Stop with Ctrl-C.

---

## Stop everything

In each terminal: **Ctrl-C**.

If a terminal is unresponsive or ports stay bound, force-kill from a fresh PowerShell:

```powershell
@(3000, 3001, 3002, 8000) | ForEach-Object {
    Get-NetTCPConnection -LocalPort $_ -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess |
        ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}
```

---

## Troubleshooting

### `Port 8000 is in use` (or 3000)
Something's already bound. Run the force-kill snippet above, then restart.

### `ModuleNotFoundError: No module named 'joblib'` when launching uvicorn
Wrong Python — there's a system-installed `uvicorn.exe` from a different interpreter. Always invoke as `python -m uvicorn ...`, never bare `uvicorn`.

### Frontend shows `API OFFLINE`
The Next.js dev server is up but the FastAPI server isn't. Start Terminal 1. The UI will reconnect automatically within 5 s (it polls `/health`).

### Frontend port is 3001 / 3002 instead of 3000
You have a stale Next dev server running. Kill it with the force-kill snippet above, then `npm run dev` again.

### `Hydration error` mentioning a timestamp
Already fixed in code. If you still see it, hard-reload the browser (Ctrl-Shift-R) to bypass cache.

### `mule_graph.json not found` when hitting `/graph`
Run the graph builder once:

```powershell
python -m src.build_synthetic_graph
```

Then restart the API (Ctrl-C, then re-run the uvicorn command).

### Model pickles not found at startup
Re-run the model pipeline:

```powershell
python -m src.models      --processed data/processed --models models --reports reports
python -m src.calibrate   --processed data/processed --models models --reports reports
```

---

## Quick demo flow (3 minutes)

1. <http://localhost:3000> → top-right shows "API LIVE · c4a43cb2".
2. **Dashboard** view → 2,521 monitored accounts, live KPI cards.
3. **Alert Queue** → 40 real high-scoring accounts, sorted by score.
4. Click any HIGH-band row → triage view loads with real SHAP attributions.
5. Click **Generate STR Draft** → 2-page PDF opens in a new tab, populated with real model output in FIU-IND Form V2 layout.
6. Click **Execute System Freeze** → POSTs to `/tickets/i4c`, account re-scores to `FREEZE`.
7. **Nodal Officer Network** → behavioral similarity graph (50 nodes / 122 edges; 21 ringed nodes = ground-truth mules).
8. Start replay loop (Terminal 3) → audit log scrolls, queue badges update live.

---

## What the URLs do

| URL | Served by | Purpose |
|---|---|---|
| `http://127.0.0.1:8000/docs` | API | Swagger UI for every endpoint |
| `http://127.0.0.1:8000/health` | API | Heartbeat + model version |
| `http://127.0.0.1:8000/accounts` | API | Paginated alert queue |
| `http://127.0.0.1:8000/accounts/9071` | API | Detail for one account incl. SHAP |
| `http://127.0.0.1:8000/graph` | API | Behavioral-similarity graph |
| `http://127.0.0.1:8000/str-draft/9071` | API | Download an STR-draft PDF |
| `http://localhost:3000` | UI | Analyst console |
