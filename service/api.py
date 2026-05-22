"""
FastAPI scoring service — Day 1 backend.

Endpoints:
  POST /score          — score an account_id, return {score, band, action, top_reasons, matched_rules, model_version}
  GET  /health         — {status, model_version, loaded_at, accounts_loaded}
  GET  /accounts       — paginated account list for the alert queue
  GET  /accounts/{id}  — full detail incl. SHAP explanation
  POST /feedback       — append to data/feedback/queue.jsonl
  POST /tickets/i4c    — add account_id to hard-block list, triggers FREEZE on next /score

Run:
  uvicorn service.api:app --reload --port 8000
"""
from __future__ import annotations

import json
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
import shap

from service.policy import decide, Band, Action
from service.str_draft import build_str_pdf
from service import docs as report_docs

# --------------------------------------------------------------------------- paths

ROOT = Path(__file__).resolve().parent.parent
PROCESSED = ROOT / "data" / "processed"
MODELS = ROOT / "models"
LOGS = ROOT / "logs"
FEEDBACK_DIR = ROOT / "data" / "feedback"

# Frozen primary models (locked Day 1)
CALIBRATED_HASH = "c4a43cb2b9a69325"   # CalibratedClassifierCV — for /score
UNCALIBRATED_HASH = "0a447c986cd0e73a"  # bare LightGBM — for SHAP

TOP_REASONS = 5

# --------------------------------------------------------------------------- state


class ServiceState:
    """In-memory state holder; populated in lifespan."""

    def __init__(self) -> None:
        self.calibrated_bundle: dict = {}
        self.uncalibrated_bundle: dict = {}
        self.X_test: pd.DataFrame = pd.DataFrame()
        self.y_test: pd.Series = pd.Series(dtype="int8")
        self.feature_names: list[str] = []
        self.account_ids: list[int] = []
        # account_id -> {score_uncal, score_cal, top_reasons (top-5)}
        self.cache: dict[int, dict] = {}
        # account_id -> real demographic profile from raw CSV
        self.profiles: dict[int, dict] = {}
        # account_id -> ticket_ref for hard-block rule
        self.i4c_list: dict[int, str] = {}
        self.loaded_at: str = ""
        self.feedback_lock = threading.Lock()
        self.i4c_lock = threading.Lock()
        self.feedback_queue_len = 0
        self.graph: Optional[dict] = None


STATE = ServiceState()


# --------------------------------------------------------------------------- loaders


def load_models() -> None:
    STATE.calibrated_bundle = joblib.load(MODELS / f"{CALIBRATED_HASH}.pkl")
    STATE.uncalibrated_bundle = joblib.load(MODELS / f"{UNCALIBRATED_HASH}.pkl")
    STATE.feature_names = STATE.uncalibrated_bundle["features"]


def load_test_data() -> None:
    STATE.X_test = pd.read_parquet(PROCESSED / "X_test.parquet")[STATE.feature_names]
    STATE.y_test = pd.read_parquet(PROCESSED / "y_test.parquet").iloc[:, 0]
    STATE.account_ids = STATE.X_test.index.tolist()


# Real demographic columns from the raw CSV (kept as-is, never used as features).
PROFILE_COLS = {
    "F3886": "account_type",
    "F3889": "time_window",
    "F3890": "region",
    "F3891": "occupation",
    "F3892": "gender",
    "F3893": "segment",
    "F3888": "account_opened",
}


def load_profiles() -> None:
    """Read raw demographic fields for every test account_id."""
    raw_path = ROOT / "DataSet.csv"
    if not raw_path.exists():
        print(f"[startup] WARNING: {raw_path} not found, profiles unavailable")
        return
    cols = list(PROFILE_COLS.keys())
    df = pd.read_csv(raw_path, usecols=cols)
    for acct_id in STATE.account_ids:
        row = df.iloc[acct_id]
        STATE.profiles[acct_id] = {
            ui_name: (None if pd.isna(row[csv_col]) else str(row[csv_col]))
            for csv_col, ui_name in PROFILE_COLS.items()
        }


def precompute_scores_and_reasons() -> None:
    """Pre-score all test accounts + SHAP top-5 reasons. ~5s cold start, cuts /score to <5ms."""
    cal_model = STATE.calibrated_bundle["model"]
    uncal_model = STATE.uncalibrated_bundle["model"]

    proba_cal = cal_model.predict_proba(STATE.X_test)[:, 1]
    proba_uncal = uncal_model.predict_proba(STATE.X_test)[:, 1]

    # SHAP from the uncalibrated tree model. Isotonic calibration preserves
    # rank order, so SHAP attributions remain interpretable for the calibrated score.
    explainer = shap.TreeExplainer(uncal_model)
    shap_values = explainer.shap_values(STATE.X_test)
    if isinstance(shap_values, list):
        sv = shap_values[1]
    else:
        sv = shap_values

    for i, acct_id in enumerate(STATE.account_ids):
        row_sv = sv[i]
        abs_order = np.argsort(-np.abs(row_sv))[:TOP_REASONS]
        top_reasons = []
        for j in abs_order:
            v = STATE.X_test.iloc[i, j]
            top_reasons.append({
                "feature": STATE.feature_names[j],
                "value": (None if pd.isna(v) else float(v)),
                "shap": float(row_sv[j]),
                "direction": "pushes toward mule" if row_sv[j] > 0 else "pushes toward legit",
            })
        STATE.cache[acct_id] = {
            "score": float(proba_cal[i]),
            "score_uncalibrated": float(proba_uncal[i]),
            "actual_label": int(STATE.y_test.iloc[i]),
            "top_reasons": top_reasons,
        }


def load_i4c_list() -> None:
    path = FEEDBACK_DIR / "i4c_list.json"
    if path.exists():
        STATE.i4c_list = {int(k): v for k, v in json.loads(path.read_text()).items()}


def load_graph() -> None:
    """Behavioral-similarity graph generated by src/build_synthetic_graph.py."""
    path = PROCESSED / "mule_graph.json"
    if path.exists():
        try:
            STATE.graph = json.loads(path.read_text())
        except Exception as exc:
            print(f"[startup] WARNING: could not parse mule_graph.json: {exc}")
            STATE.graph = None
    else:
        STATE.graph = None


def persist_i4c_list() -> None:
    FEEDBACK_DIR.mkdir(parents=True, exist_ok=True)
    (FEEDBACK_DIR / "i4c_list.json").write_text(
        json.dumps({str(k): v for k, v in STATE.i4c_list.items()}, indent=2)
    )


def count_feedback() -> int:
    path = FEEDBACK_DIR / "queue.jsonl"
    if not path.exists():
        return 0
    with path.open() as f:
        return sum(1 for _ in f)


# --------------------------------------------------------------------------- lifespan


@asynccontextmanager
async def lifespan(app: FastAPI):
    LOGS.mkdir(parents=True, exist_ok=True)
    FEEDBACK_DIR.mkdir(parents=True, exist_ok=True)
    load_models()
    load_test_data()
    print(f"[startup] loaded {len(STATE.feature_names)} features, "
          f"{len(STATE.account_ids)} test accounts")
    precompute_scores_and_reasons()
    load_profiles()
    print(f"[startup] loaded demographic profiles for {len(STATE.profiles)} accounts")
    load_i4c_list()
    load_graph()
    if STATE.graph is not None:
        meta = STATE.graph.get("meta", {})
        print(f"[startup] loaded behavioral graph: "
              f"{meta.get('n_nodes', '?')} nodes / {meta.get('n_edges', '?')} edges")
    STATE.feedback_queue_len = count_feedback()
    STATE.loaded_at = datetime.now(timezone.utc).isoformat()
    print(f"[startup] cache built for {len(STATE.cache)} accounts, "
          f"{len(STATE.i4c_list)} on I4C list")
    yield


app = FastAPI(
    title="Mule Account Detection — Scoring Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- schemas


class ScoreRequest(BaseModel):
    account_id: int


class Reason(BaseModel):
    feature: str
    value: Optional[float]
    shap: float
    direction: str


class ScoreResponse(BaseModel):
    account_id: int
    score: float
    band: Band
    action: Action
    top_reasons: list[Reason]
    matched_rules: list[str]
    model_version: str
    scored_at: str


class HealthResponse(BaseModel):
    status: str
    model_version: str
    loaded_at: str
    accounts_loaded: int
    feedback_queue_len: int
    i4c_list_size: int


class AccountProfile(BaseModel):
    account_type: Optional[str] = None
    time_window: Optional[str] = None
    region: Optional[str] = None
    occupation: Optional[str] = None
    gender: Optional[str] = None
    segment: Optional[str] = None
    account_opened: Optional[str] = None


class AccountSummary(BaseModel):
    account_id: int
    score: float
    band: Band
    action: Action
    matched_rules: list[str]
    profile: Optional[AccountProfile] = None


class AccountListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    accounts: list[AccountSummary]


class AccountDetailResponse(BaseModel):
    account_id: int
    score: float
    band: Band
    action: Action
    matched_rules: list[str]
    top_reasons: list[Reason]
    feature_count: int
    actual_label: int  # ground truth from test set (-1 if unknown)
    model_version: str
    profile: Optional[AccountProfile] = None


class FeedbackRequest(BaseModel):
    account_id: int
    verdict: str = Field(..., pattern="^(confirmed|false_positive|escalate)$")
    notes: Optional[str] = None
    analyst_id: Optional[str] = None


class FeedbackResponse(BaseModel):
    queued: bool
    queue_position: int
    written_at: str


class I4CTicketRequest(BaseModel):
    account_id: int
    ticket_ref: str = Field(..., description="e.g., I4C-CFCFRMS-2024-7841")


class I4CTicketResponse(BaseModel):
    account_id: int
    ticket_ref: str
    hard_block_active: bool
    written_at: str


# --------------------------------------------------------------------------- helpers


def matched_rules_for(account_id: int) -> list[str]:
    rules = []
    if account_id in STATE.i4c_list:
        rules.append(STATE.i4c_list[account_id])
    return rules


def score_account(account_id: int) -> ScoreResponse:
    if account_id not in STATE.cache:
        raise HTTPException(status_code=404, detail=f"account_id {account_id} not in test set")
    cached = STATE.cache[account_id]
    rules = matched_rules_for(account_id)
    band, action = decide(cached["score"], rules)
    resp = ScoreResponse(
        account_id=account_id,
        score=cached["score"],
        band=band,
        action=action,
        top_reasons=[Reason(**r) for r in cached["top_reasons"]],
        matched_rules=rules,
        model_version=CALIBRATED_HASH,
        scored_at=datetime.now(timezone.utc).isoformat(),
    )
    audit_log(resp)
    return resp


def audit_log(resp: ScoreResponse) -> None:
    entry = {
        "ts": resp.scored_at,
        "account_id": resp.account_id,
        "score": resp.score,
        "band": resp.band,
        "action": resp.action,
        "matched_rules": resp.matched_rules,
        "model_version": resp.model_version,
    }
    with (LOGS / "decisions.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


# --------------------------------------------------------------------------- routes


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model_version=CALIBRATED_HASH,
        loaded_at=STATE.loaded_at,
        accounts_loaded=len(STATE.cache),
        feedback_queue_len=STATE.feedback_queue_len,
        i4c_list_size=len(STATE.i4c_list),
    )


@app.post("/score", response_model=ScoreResponse)
def score(req: ScoreRequest) -> ScoreResponse:
    return score_account(req.account_id)


@app.get("/accounts", response_model=AccountListResponse)
def list_accounts(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort: str = Query("score_desc", pattern="^(score_desc|score_asc|id_asc)$"),
    band: Optional[Band] = Query(None),
) -> AccountListResponse:
    rows = []
    for acct_id, cached in STATE.cache.items():
        rules = matched_rules_for(acct_id)
        b, a = decide(cached["score"], rules)
        if band is not None and b != band:
            continue
        rows.append({
            "account_id": acct_id,
            "score": cached["score"],
            "band": b,
            "action": a,
            "matched_rules": rules,
            "profile": STATE.profiles.get(acct_id),
        })

    # Risk band always wins over score so freezes / hard-hits never get pushed
    # off the visible page by a near-zero calibrated score.
    BAND_RANK = {"FREEZE": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    if sort == "score_desc":
        rows.sort(key=lambda r: (BAND_RANK.get(r["band"], 9), -r["score"]))
    elif sort == "score_asc":
        rows.sort(key=lambda r: (BAND_RANK.get(r["band"], 9), r["score"]))
    else:
        rows.sort(key=lambda r: r["account_id"])

    total = len(rows)
    start = (page - 1) * page_size
    page_rows = rows[start:start + page_size]
    return AccountListResponse(
        total=total, page=page, page_size=page_size,
        accounts=[AccountSummary(**r) for r in page_rows],
    )


@app.get("/accounts/{account_id}", response_model=AccountDetailResponse)
def account_detail(account_id: int) -> AccountDetailResponse:
    if account_id not in STATE.cache:
        raise HTTPException(status_code=404, detail=f"account_id {account_id} not in test set")
    cached = STATE.cache[account_id]
    rules = matched_rules_for(account_id)
    band, action = decide(cached["score"], rules)
    return AccountDetailResponse(
        account_id=account_id,
        score=cached["score"],
        band=band,
        action=action,
        matched_rules=rules,
        top_reasons=[Reason(**r) for r in cached["top_reasons"]],
        feature_count=len(STATE.feature_names),
        actual_label=cached["actual_label"],
        model_version=CALIBRATED_HASH,
        profile=AccountProfile(**STATE.profiles[account_id]) if account_id in STATE.profiles else None,
    )


@app.post("/feedback", response_model=FeedbackResponse)
def submit_feedback(req: FeedbackRequest) -> FeedbackResponse:
    if req.account_id not in STATE.cache:
        raise HTTPException(status_code=404, detail=f"account_id {req.account_id} unknown")
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "account_id": req.account_id,
        "verdict": req.verdict,
        "notes": req.notes,
        "analyst_id": req.analyst_id,
        "model_version": CALIBRATED_HASH,
    }
    with STATE.feedback_lock:
        FEEDBACK_DIR.mkdir(parents=True, exist_ok=True)
        with (FEEDBACK_DIR / "queue.jsonl").open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
        STATE.feedback_queue_len += 1
        position = STATE.feedback_queue_len
    return FeedbackResponse(queued=True, queue_position=position, written_at=entry["ts"])


@app.get("/docs")
def list_docs() -> dict:
    """List every report markdown that can be downloaded as PDF."""
    return {"docs": report_docs.list_docs()}


@app.get("/docs/{slug}")
def get_doc_pdf(slug: str) -> Response:
    """Stream a styled PDF generated on demand from one of the report markdowns."""
    result = report_docs.render_pdf(slug, ROOT)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Document slug '{slug}' not configured or report file missing")
    pdf_bytes, filename = result
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@app.get("/str-draft/{account_id}")
def str_draft(account_id: int) -> Response:
    """Render a FIU-IND STR draft PDF for an account."""
    if account_id not in STATE.cache:
        raise HTTPException(status_code=404, detail=f"account_id {account_id} not in test set")
    cached = STATE.cache[account_id]
    rules = matched_rules_for(account_id)
    band, action = decide(cached["score"], rules)
    profile = STATE.profiles.get(account_id, {})

    # Match the UI's deterministic synthesis so the PDF matches what the analyst sees.
    h = 2166136261
    for c in f"acct-{account_id}".encode():
        h ^= c
        h = (h * 16777619) & 0xFFFFFFFF
    display_id = f"MULE_AC_{account_id}_{f'{h:08X}'[:4]}"

    pdf_bytes = build_str_pdf(
        account_id=account_id,
        display_id=display_id,
        customer_name="(see analyst console)",
        kyc_status={"FREEZE": "Flagged", "HIGH": "Pending"}.get(band, "Verified"),
        score=cached["score"],
        band=band,
        action=action,
        matched_rules=rules,
        top_reasons=cached["top_reasons"],
        profile=profile,
        model_version=CALIBRATED_HASH,
        counterparties=None,  # UI passes synthesized counterparties via POST below
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="STR_draft_{display_id}.pdf"',
            "X-Filing-Reference": rules[0] if rules else f"INTL-STR-{account_id:05d}",
        },
    )


class StrDraftRequest(BaseModel):
    customer_name: Optional[str] = None
    counterparties: Optional[list[dict]] = None
    analyst_id: Optional[str] = None


@app.post("/str-draft/{account_id}")
def str_draft_post(account_id: int, req: StrDraftRequest) -> Response:
    """Same as GET, but lets the UI pass the synthesized customer name + counterparties."""
    if account_id not in STATE.cache:
        raise HTTPException(status_code=404, detail=f"account_id {account_id} not in test set")
    cached = STATE.cache[account_id]
    rules = matched_rules_for(account_id)
    band, action = decide(cached["score"], rules)
    profile = STATE.profiles.get(account_id, {})

    h = 2166136261
    for c in f"acct-{account_id}".encode():
        h ^= c
        h = (h * 16777619) & 0xFFFFFFFF
    display_id = f"MULE_AC_{account_id}_{f'{h:08X}'[:4]}"

    pdf_bytes = build_str_pdf(
        account_id=account_id,
        display_id=display_id,
        customer_name=req.customer_name or "(customer name redacted)",
        kyc_status={"FREEZE": "Flagged", "HIGH": "Pending"}.get(band, "Verified"),
        score=cached["score"],
        band=band,
        action=action,
        matched_rules=rules,
        top_reasons=cached["top_reasons"],
        profile=profile,
        model_version=CALIBRATED_HASH,
        counterparties=req.counterparties,
        analyst_id=req.analyst_id or "(analyst pending)",
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="STR_draft_{display_id}.pdf"',
            "X-Filing-Reference": rules[0] if rules else f"INTL-STR-{account_id:05d}",
        },
    )


@app.get("/graph")
def get_graph() -> dict:
    """Return the precomputed behavioral-similarity graph for the analyst console."""
    if STATE.graph is None:
        raise HTTPException(
            status_code=503,
            detail="Behavioral graph not built. Run `python -m src.build_synthetic_graph` first.",
        )
    # Annotate nodes with live band (band may have shifted via I4C tickets).
    augmented_nodes = []
    for node in STATE.graph["nodes"]:
        acct = node["account_id"]
        cached = STATE.cache.get(acct)
        rules = matched_rules_for(acct)
        if cached:
            band, _ = decide(cached["score"], rules)
        else:
            band = node.get("band", "LOW")
        augmented_nodes.append({**node, "band_live": band, "matched_rules": rules})
    return {"meta": STATE.graph["meta"], "nodes": augmented_nodes, "edges": STATE.graph["edges"]}


@app.post("/tickets/i4c", response_model=I4CTicketResponse)
def submit_i4c_ticket(req: I4CTicketRequest) -> I4CTicketResponse:
    if req.account_id not in STATE.cache:
        raise HTTPException(status_code=404, detail=f"account_id {req.account_id} unknown")
    with STATE.i4c_lock:
        STATE.i4c_list[req.account_id] = req.ticket_ref
        persist_i4c_list()
    return I4CTicketResponse(
        account_id=req.account_id,
        ticket_ref=req.ticket_ref,
        hard_block_active=True,
        written_at=datetime.now(timezone.utc).isoformat(),
    )
