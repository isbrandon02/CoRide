import re

from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Ride, User, UserProfile
from app.schemas import LeaderboardEntryOut, LeaderboardResponse
from app.security import get_current_user

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


def _name_from_user(user: User, profile: UserProfile | None) -> str:
    raw = (profile.name or "").strip() if profile else ""
    if raw:
        return raw

    local = (user.email or "").split("@")[0]
    parts = [p for p in re.split(r"[._-]+", local) if p]
    if not parts:
        return "Member"
    return " ".join(p.capitalize() for p in parts)


def _impact_score(total_saved: float, total_co2_kg: float, rides_shared: int) -> float:
    # First-pass composite sustainability score for leaderboard ranking.
    return round(total_saved * 8 + total_co2_kg * 20 + rides_shared * 12, 1)


@router.get("", response_model=LeaderboardResponse)
def get_leaderboard(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LeaderboardResponse:
    users = db.scalars(
        select(User).where(User.onboarding_completed.is_(True)).order_by(User.created_at.asc())
    ).all()

    leaderboard: list[LeaderboardEntryOut] = []
    for user in users:
        profile = db.get(UserProfile, user.id)
        rides = db.scalars(
            select(Ride).where(
                Ride.status == "completed",
                or_(Ride.requester_id == user.id, Ride.driver_id == user.id),
            )
        ).all()

        total_saved = round(sum(float(r.saved_usd or 0) for r in rides), 2)
        total_co2 = round(sum(float(r.co2_kg or 0) for r in rides), 2)
        rides_shared = len(rides)

        leaderboard.append(
            LeaderboardEntryOut(
                id=user.id,
                email=user.email,
                name=_name_from_user(user, profile),
                avatar_url=(profile.avatar_url or "").strip() or None if profile else None,
                score=_impact_score(total_saved, total_co2, rides_shared),
                total_saved=total_saved,
                total_co2_kg=total_co2,
                rides_shared=rides_shared,
                rank=0,
                is_current_user=user.id == current.id,
            )
        )

    leaderboard.sort(
        key=lambda item: (item.score, item.total_co2_kg, item.total_saved, item.rides_shared),
        reverse=True,
    )

    for index, item in enumerate(leaderboard, start=1):
        item.rank = index

    return LeaderboardResponse(users=leaderboard)
