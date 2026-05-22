"""
Pure policy function. score + matched_rules -> (band, action).

Decoupled from the model so policy changes don't require retraining.
Band cutoffs are LOCKED: 0.30 / 0.70 (see PLAN.md §10).
"""
from __future__ import annotations

from typing import Literal

Band = Literal["LOW", "MEDIUM", "HIGH", "FREEZE"]
Action = Literal["ALLOW", "STEP_UP", "HOLD", "FREEZE"]

LOW_HIGH_CUTOFF = 0.30
HIGH_CUTOFF = 0.70

HARD_BLOCK_PREFIXES = ("I4C", "CFCFRMS", "FIU")


def decide(score: float, matched_rules: list[str]) -> tuple[Band, Action]:
    """
    Hard-block rules win unconditionally. Otherwise band by calibrated score.

    Returns (band, action). UI consumes band; downstream systems consume action.
    """
    if any(r.split("-")[0] in HARD_BLOCK_PREFIXES for r in matched_rules):
        return "FREEZE", "FREEZE"
    if score >= HIGH_CUTOFF:
        return "HIGH", "HOLD"
    if score >= LOW_HIGH_CUTOFF:
        return "MEDIUM", "STEP_UP"
    return "LOW", "ALLOW"
