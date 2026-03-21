"""Heuristic matching: 60% route overlap + 40% time proximity (no GIS required)."""

from __future__ import annotations

import re
from typing import Any

# Words that add noise for token Jaccard on addresses
_STOP = frozenset(
    {
        "the",
        "a",
        "an",
        "and",
        "or",
        "to",
        "from",
        "via",
        "min",
        "am",
        "pm",
        "st",
        "ave",
        "rd",
        "blvd",
        "dr",
        "ca",
    }
)


def _tokens(*parts: str) -> set[str]:
    blob = " ".join(p or "" for p in parts).lower()
    return {t for t in re.findall(r"[a-z0-9]+", blob) if len(t) > 1 and t not in _STOP}


def jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 0.0
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def route_overlap_score(
    home_a: str,
    office_a: str,
    route_a: str,
    home_b: str,
    office_b: str,
    route_b: str,
) -> float:
    """
    0..1 overlap from commute text + addresses (token Jaccard).
    Same normalized office bumps score so coworkers at one HQ rank up.
    """
    t_self = _tokens(home_a, office_a, route_a)
    t_other = _tokens(home_b, office_b, route_b)
    jac = jaccard(t_self, t_other)

    def _norm_addr(s: str) -> str:
        return re.sub(r"\s+", " ", (s or "").lower().strip())

    oa = _norm_addr(office_a)
    ob = _norm_addr(office_b)
    office_bonus = 0.0
    if oa and ob and oa == ob:
        office_bonus = 0.25

    raw = min(1.0, jac + office_bonus)
    return raw


def parse_time_to_minutes(s: str) -> int | None:
    """Parse values like '9:00', '09:30', '8:30 AM', '17:00'. Returns minutes from midnight."""
    s = (s or "").strip().lower()
    if not s:
        return None
    m = re.match(
        r"^\s*(\d{1,2})\s*:\s*(\d{2})\s*(am|pm)?\s*$",
        s,
        re.I,
    )
    if not m:
        return None
    hour = int(m.group(1))
    minute = int(m.group(2))
    ap = (m.group(3) or "").lower()
    if ap == "pm":
        if hour < 12:
            hour += 12
    elif ap == "am":
        if hour == 12:
            hour = 0
    else:
        # No am/pm: treat 1–11 as morning, 12 as noon, 13–23 as 24h
        if hour <= 12 and "pm" not in s and "am" not in s:
            pass  # assume already sensible for commute (e.g. 8:30 = morning)
    if hour > 24 or minute > 59:
        return None
    return hour * 60 + minute


def work_start_minutes(work_schedule: dict[str, Any] | None) -> int:
    ws = work_schedule or {}
    st = str(ws.get("start_time") or "").strip()
    parsed = parse_time_to_minutes(st)
    if parsed is not None:
        return parsed
    return 9 * 60 + 0  # default 9:00 AM


def time_proximity_score(min_a: int, min_b: int, max_delta: int = 120) -> float:
    """
    1.0 at same minute, linearly down to 0 at max_delta minutes apart (default 2h).
    """
    delta = abs(min_a - min_b)
    if delta >= max_delta:
        return 0.0
    return 1.0 - (delta / max_delta)


def combined_match_score(route_overlap_01: float, time_score_01: float) -> float:
    """0..1: 60% route + 40% time."""
    return 0.6 * route_overlap_01 + 0.4 * time_score_01
