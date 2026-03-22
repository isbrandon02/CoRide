#!/usr/bin/env python3
"""CLI entry point for demo seed (same logic as server startup).

Prefer letting uvicorn run seed via SEED_DEMO_ACCOUNTS=true (default).
Use this script if you want to seed without starting the server.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.demo_seed import (  # noqa: E402
    apply_demo_profile_photos,
    ensure_sample_rides_for_users_without_rides,
    ensure_upcoming_week_sample_rides,
    seed_demo_accounts,
    seed_demo_chats,
    seed_demo_rides,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo accounts, photos, rides, and chats.")
    parser.add_argument(
        "--reset-rides",
        action="store_true",
        help="Delete all ride rows, then insert rides from data/demo_rides.json (ignores empty-table guard).",
    )
    args = parser.parse_args()

    created, skipped = seed_demo_accounts()
    print(f"Demo seed done: {created} created, {skipped} skipped (already existed).")
    photos_n, _ = apply_demo_profile_photos()
    print(f"Demo profile photos: {photos_n} profiles updated (skipped if avatar already set).")
    rides_n, _ = seed_demo_rides(replace=args.reset_rides)
    if args.reset_rides:
        print(f"Demo rides reset: {rides_n} inserted from JSON.")
    else:
        print(f"Demo rides seed: {rides_n} inserted (skipped if rides table non-empty or no JSON).")
    extra_n = ensure_sample_rides_for_users_without_rides()
    print(f"Sample rides for accounts with no activity: {extra_n} row(s) added.")
    up_n = ensure_upcoming_week_sample_rides()
    print(f"Upcoming-week sample rides (if needed): {up_n} row(s) added.")
    chats_n, _ = seed_demo_chats()
    print(f"Demo chats seed: {chats_n} messages inserted (skipped if messages exist or no JSON).")


if __name__ == "__main__":
    main()
