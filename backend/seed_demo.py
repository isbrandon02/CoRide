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

from app.demo_seed import seed_demo_accounts  # noqa: E402


def main() -> None:
    created, skipped = seed_demo_accounts()
    print(f"Demo seed done: {created} created, {skipped} skipped (already existed).")


if __name__ == "__main__":
    main()
