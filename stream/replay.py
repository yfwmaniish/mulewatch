"""
Snapshot replay — fakes a production transaction stream by re-scoring
real test-set accounts through the live FastAPI service.

Usage:
  Terminal 1:  python -m uvicorn service.api:app --port 8000
  Terminal 2:  python -m stream.replay --rate 1.5

What it does:
  - Pulls every account_id from /accounts (real, 2,521 rows).
  - Picks one at random every `rate` seconds and POSTs /score.
  - Logs each scoring response (band + action + score) to stdout.
  - Every `--i4c-every` cycles, fires a /tickets/i4c on a random HIGH-band
    account to inject a FREEZE beat into the audit log (great for live demo).

Notes:
  - This is "account snapshot replay", not transaction replay. The dataset
    has no transaction-level data; phrasing in the demo should match.
  - All scoring is real — the audit log at logs/decisions.jsonl receives
    every event, so the analyst console / dashboard see real throughput.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone


def http(url: str, payload: dict | None = None, method: str = "GET") -> dict:
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"} if data else {},
        method=method,
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def fetch_account_pool(api: str, page_size: int = 500) -> list[dict]:
    """Pull the highest-scoring page_size accounts as the replay pool."""
    body = http(f"{api}/accounts?page_size={page_size}&sort=score_desc")
    return body["accounts"]


def fmt_score(s: float) -> str:
    if s >= 0.7:
        return f"\033[91m{s:.3f}\033[0m"  # red
    if s >= 0.3:
        return f"\033[93m{s:.3f}\033[0m"  # yellow
    return f"\033[92m{s:.3f}\033[0m"      # green


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8000")
    ap.add_argument("--rate", type=float, default=1.5, help="seconds between /score calls")
    ap.add_argument("--count", type=int, default=0, help="stop after N events (0 = forever)")
    ap.add_argument("--i4c-every", type=int, default=40,
                    help="fire a /tickets/i4c every N scoring events (0 = never)")
    ap.add_argument("--pool-size", type=int, default=500,
                    help="how many highest-score accounts to keep in the replay pool")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    # Warm up — wait for the API if it's still booting.
    health_url = f"{args.url}/health"
    print(f"Connecting to {args.url} …", flush=True)
    for attempt in range(30):
        try:
            h = http(health_url)
            print(f"  API live · model {h['model_version'][:8]} · {h['accounts_loaded']} accounts loaded",
                  flush=True)
            break
        except urllib.error.URLError:
            time.sleep(1)
    else:
        print("API never came up. Start `python -m uvicorn service.api:app` first.", file=sys.stderr)
        sys.exit(1)

    pool = fetch_account_pool(args.url, args.pool_size)
    if not pool:
        print("Empty account pool — API has nothing to replay.", file=sys.stderr)
        sys.exit(1)

    # Build two pools — full + HIGH-band subset for I4C injection.
    high_pool = [a for a in pool if a["band"] == "HIGH"]
    print(f"  Replay pool: {len(pool)} accounts ({len(high_pool)} HIGH band)\n", flush=True)

    rng = random.Random(args.seed)
    n_scored = 0
    n_i4c = 0
    t_start = time.perf_counter()
    try:
        while True:
            acct = rng.choice(pool)["account_id"]
            try:
                res = http(f"{args.url}/score", {"account_id": acct}, method="POST")
                n_scored += 1
                ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
                print(
                    f"[{ts}] #{n_scored:5d}  acct {acct:>5}  score={fmt_score(res['score'])}  "
                    f"band={res['band']:<7}  action={res['action']:<8}  "
                    f"rules={','.join(res['matched_rules']) or '—'}",
                    flush=True,
                )
            except urllib.error.HTTPError as e:
                print(f"  /score {acct} → HTTP {e.code}", file=sys.stderr)

            # Periodic I4C injection
            if args.i4c_every > 0 and n_scored > 0 and n_scored % args.i4c_every == 0 and high_pool:
                target = rng.choice(high_pool)["account_id"]
                ticket = f"I4C-CFCFRMS-{datetime.now().year}-REPLAY-{n_i4c:04d}"
                try:
                    http(f"{args.url}/tickets/i4c",
                         {"account_id": target, "ticket_ref": ticket}, method="POST")
                    n_i4c += 1
                    print(f"  >> I4C injected on acct {target} ({ticket})  total I4C: {n_i4c}",
                          flush=True)
                except urllib.error.HTTPError as e:
                    print(f"  /tickets/i4c {target} → HTTP {e.code}", file=sys.stderr)

            if args.count and n_scored >= args.count:
                break
            time.sleep(args.rate)
    except KeyboardInterrupt:
        pass

    wall = time.perf_counter() - t_start
    print(
        f"\nStopped after {n_scored} scoring calls, {n_i4c} I4C tickets, "
        f"{wall:.1f}s ({n_scored / max(wall, 1):.2f} rps).",
        flush=True,
    )


if __name__ == "__main__":
    main()
