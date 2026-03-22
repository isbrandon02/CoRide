"""Load demo_accounts.json into the DB. Idempotent (skips existing emails)."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import ChatConversation, ChatMessage, ChatParticipant, Ride, User, UserProfile, UserVehicle
from app.security import get_password_hash

logger = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = BACKEND_ROOT / "data" / "demo_accounts.json"
RIDES_PATH = BACKEND_ROOT / "data" / "demo_rides.json"
CHATS_SEED_PATH = BACKEND_ROOT / "seed_data" / "demo_chats.json"
PROFILE_PHOTOS_PATH = BACKEND_ROOT / "seed_data" / "demo_profile_photos.json"


def apply_demo_profile_photos() -> tuple[int, int]:
    """
    Set avatar_url from seed_data/demo_profile_photos.json when profile avatar is still empty.
    Returns (updated_count, 0).
    """
    if not PROFILE_PHOTOS_PATH.is_file():
        return (0, 0)
    with open(PROFILE_PHOTOS_PATH, encoding="utf-8") as f:
        payload = json.load(f)
    if not isinstance(payload, dict) or not payload:
        return (0, 0)

    db: Session = SessionLocal()
    updated = 0
    try:
        for email_raw, url in payload.items():
            email = str(email_raw).strip().lower()
            url_s = str(url).strip()
            if not url_s:
                continue
            u = db.query(User).filter(User.email == email).first()
            if u is None:
                continue
            p = db.get(UserProfile, u.id)
            if p is None:
                continue
            if (p.avatar_url or "").strip():
                continue
            p.avatar_url = url_s
            updated += 1
        if updated:
            db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    if updated:
        logger.info("Demo profile photos: %s profile(s) updated", updated)
    return (updated, 0)


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
                name=(row.get("name") or "").strip(),
                age=row.get("age"),
                gender=(row.get("gender") or "").strip(),
                status=(row.get("status") or "").strip(),
                home_address=row.get("home_address", "").strip(),
                office_address=row.get("office_address", "").strip(),
                hobbies=_hobbies_with_meta(row),
                commute_route=row.get("commute_route", "").strip(),
                avatar_url=(row.get("avatar_url") or "").strip(),
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


def seed_demo_rides() -> tuple[int, int]:
    """
    Insert demo rides from data/demo_rides.json when the rides table is empty.
    Skips rows if requester or driver email is missing from the DB.
    Returns (inserted_count, 0).
    """
    if not RIDES_PATH.is_file():
        logger.debug("Demo rides seed skipped: missing %s", RIDES_PATH)
        return (0, 0)

    with open(RIDES_PATH, encoding="utf-8") as f:
        payload = json.load(f)

    spec = payload.get("rides") or []
    if not spec:
        return (0, 0)

    db: Session = SessionLocal()
    created = 0
    try:
        existing = db.scalar(select(func.count()).select_from(Ride)) or 0
        if existing > 0:
            logger.debug("Demo rides seed skipped: rides table already has %s row(s)", existing)
            return (0, 0)

        users_list = db.query(User).all()
        users = {u.email.strip().lower(): u for u in users_list}
        now = datetime.now(timezone.utc)

        for row in spec:
            re = row["requester_email"].strip().lower()
            de = row["driver_email"].strip().lower()
            ur = users.get(re)
            ud = users.get(de)
            if ur is None or ud is None:
                logger.warning("Demo ride skipped: unknown user(s) %s / %s", re, de)
                continue

            st = (row.get("status") or "").strip().lower()
            if st not in {"pending", "accepted", "declined", "cancelled", "completed"}:
                logger.warning("Demo ride skipped: invalid status %s", st)
                continue

            created_days = int(row.get("created_days_ago", 0))
            created_at = now - timedelta(days=created_days)

            rid = Ride(
                requester_id=ur.id,
                driver_id=ud.id,
                status=st,
                note=(row.get("note") or "").strip(),
                created_at=created_at,
            )
            if st == "completed":
                comp_days = int(row.get("completed_days_ago", created_days))
                rid.completed_at = now - timedelta(days=comp_days)
                rid.saved_usd = float(row.get("saved_usd", 4.5))
                rid.co2_kg = float(row.get("co2_kg", 2.3))

            db.add(rid)
            created += 1

        if created:
            db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    if created:
        logger.info("Demo rides: %s row(s) inserted", created)
    return (created, 0)


def seed_demo_chats() -> tuple[int, int]:
    """
    Insert demo DM threads from seed_data/demo_chats.json when chat_messages is empty.
    Returns (message_count_inserted, 0).
    """
    if not CHATS_SEED_PATH.is_file():
        logger.debug("Demo chats seed skipped: missing %s", CHATS_SEED_PATH)
        return (0, 0)

    with open(CHATS_SEED_PATH, encoding="utf-8") as f:
        payload = json.load(f)

    dm_threads = payload.get("threads") or []
    group_threads = payload.get("group_threads") or []
    if not dm_threads and not group_threads:
        return (0, 0)

    db: Session = SessionLocal()
    inserted = 0
    try:
        existing = db.scalar(select(func.count()).select_from(ChatMessage)) or 0
        if existing > 0:
            logger.debug("Demo chats seed skipped: chat_messages already has %s row(s)", existing)
            return (0, 0)

        users_list = db.query(User).all()
        users = {u.email.strip().lower(): u for u in users_list}
        now = datetime.now(timezone.utc)

        def add_messages_for_conv(conv_id: int, raw_msgs: list) -> None:
            nonlocal inserted
            ordered = sorted(raw_msgs, key=lambda m: int(m.get("minutes_ago", 0)), reverse=True)
            for row in ordered:
                fe = (row.get("from_email") or "").strip().lower()
                sender = users.get(fe)
                if sender is None:
                    continue
                body = (row.get("body") or "").strip()
                if not body:
                    continue
                mins = int(row.get("minutes_ago", 0))
                created_at = now - timedelta(minutes=mins)
                db.add(
                    ChatMessage(
                        conversation_id=conv_id,
                        sender_id=sender.id,
                        body=body,
                        created_at=created_at,
                    )
                )
                inserted += 1

        for thread in dm_threads:
            emails = [e.strip().lower() for e in thread.get("participants") or []]
            if len(emails) != 2:
                continue
            u0 = users.get(emails[0])
            u1 = users.get(emails[1])
            if u0 is None or u1 is None:
                logger.warning("Demo chat thread skipped: missing user(s) %s", emails)
                continue

            conv = ChatConversation(created_at=now - timedelta(days=1))
            db.add(conv)
            db.flush()
            db.add(ChatParticipant(conversation_id=conv.id, user_id=u0.id))
            db.add(ChatParticipant(conversation_id=conv.id, user_id=u1.id))
            add_messages_for_conv(conv.id, thread.get("messages") or [])

        for thread in group_threads:
            emails = [e.strip().lower() for e in thread.get("participants") or []]
            if len(emails) < 3:
                continue
            part_users = [users.get(e) for e in emails]
            if any(u is None for u in part_users):
                logger.warning("Demo group chat skipped: missing user(s) %s", emails)
                continue
            gtitle = (thread.get("title") or "").strip()
            conv = ChatConversation(title=gtitle, created_at=now - timedelta(days=2))
            db.add(conv)
            db.flush()
            for u in part_users:
                db.add(ChatParticipant(conversation_id=conv.id, user_id=u.id))
            add_messages_for_conv(conv.id, thread.get("messages") or [])

        if inserted:
            db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    if inserted:
        logger.info("Demo chats: %s message(s) inserted", inserted)
    return (inserted, 0)
