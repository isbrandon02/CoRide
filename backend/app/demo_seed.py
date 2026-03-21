"""Load demo_accounts.json into the DB. Idempotent (skips existing emails)."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import User, UserProfile, UserVehicle
from app.security import get_password_hash

logger = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = BACKEND_ROOT / "data" / "demo_accounts.json"


def seed_demo_accounts() -> tuple[int, int]:
    """
    Insert demo users from data/demo_accounts.json if missing.
    Returns (created_count, skipped_count).
    """
    if not DATA_PATH.is_file():
        logger.warning("Demo seed skipped: missing %s", DATA_PATH)
        return (0, 0)

    with open(DATA_PATH, encoding="utf-8") as f:
        payload = json.load(f)

    accounts = payload.get("accounts") or []
    if not accounts:
        return (0, 0)

    db: Session = SessionLocal()
    created = 0
    skipped = 0
    try:
        for row in accounts:
            email = row["email"].strip().lower()
            existing = db.query(User).filter(User.email == email).first()
            if existing is not None:
                skipped += 1
                continue

            pwd = row.get("password") or payload.get("meta", {}).get("default_password")
            if not pwd:
                raise ValueError(f"No password for {email}")

            user = User(
                email=email,
                hashed_password=get_password_hash(pwd),
                onboarding_completed=True,
            )
            db.add(user)
            db.flush()

            ws = row.get("work_schedule") or {}
            profile = UserProfile(
                user_id=user.id,
                home_address=row.get("home_address", "").strip(),
                office_address=row.get("office_address", "").strip(),
                hobbies=_hobbies_with_meta(row),
                commute_route=row.get("commute_route", "").strip(),
                work_schedule={
                    "days": str(ws.get("days", "")),
                    "start_time": str(ws.get("start_time", "")),
                    "end_time": str(ws.get("end_time", "")),
                },
            )
            db.add(profile)

            v = row.get("vehicle") or {}
            vehicle = UserVehicle(
                user_id=user.id,
                make=(v.get("make") or None) and str(v["make"]).strip() or None,
                model=(v.get("model") or None) and str(v["model"]).strip() or None,
                year=v.get("year"),
                color=(v.get("color") or None) and str(v["color"]).strip() or None,
            )
            db.add(vehicle)
            created += 1

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    if created:
        logger.info("Demo accounts: %s new user(s) inserted", created)
    if skipped and not created:
        logger.debug("Demo accounts: all %s already present (skipped)", skipped)
    return (created, skipped)


def _hobbies_with_meta(row: dict) -> str:
    company = row.get("company", "").strip()
    team = row.get("team", "").strip()
    role = row.get("role", "").strip()
    base = row.get("hobbies", "").strip()
    bits = []
    if company:
        bits.append(f"Company: {company}")
    if team and team != "—":
        bits.append(f"Team: {team}")
    if role:
        bits.append(f"Role: {role}")
    prefix = " | ".join(bits)
    if prefix and base:
        return f"{prefix} — {base}"
    if prefix:
        return prefix
    return base
