#!/usr/bin/env python3
"""CLI entry point for demo seed (same logic as server startup).

Prefer letting uvicorn run seed via SEED_DEMO_ACCOUNTS=true (default).
Use this script if you want to seed without starting the server.
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.demo_seed import apply_demo_profile_photos, seed_demo_accounts, seed_demo_chats, seed_demo_rides  # noqa: E402


def main() -> None:
    created, skipped = seed_demo_accounts()
    print(f"Demo seed done: {created} created, {skipped} skipped (already existed).")
    photos_n, _ = apply_demo_profile_photos()
    print(f"Demo profile photos: {photos_n} profiles updated (skipped if avatar already set).")
    rides_n, _ = seed_demo_rides()
    print(f"Demo rides seed: {rides_n} inserted (skipped if rides table non-empty or no JSON).")
    chats_n, _ = seed_demo_chats()
    print(f"Demo chats seed: {chats_n} messages inserted (skipped if messages exist or no JSON).")


if __name__ == "__main__":
    main()
