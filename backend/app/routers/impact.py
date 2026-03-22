from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Ride, User
from app.schemas import ImpactResponse
from app.security import get_current_user

router = APIRouter(prefix="/impact", tags=["impact"])


@router.get("", response_model=ImpactResponse)
def get_impact(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ImpactResponse:
    completed = db.scalars(
        select(Ride).where(
            Ride.status == "completed",
            or_(Ride.requester_id == current.id, Ride.driver_id == current.id),
        )
    ).all()

    total_saved = sum(float(r.saved_usd or 0) for r in completed)
    total_co2 = sum(float(r.co2_kg or 0) for r in completed)
    rides_shared = len(completed)

    today = datetime.now(timezone.utc).date()
    weekly: list[dict] = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_total = 0.0
        for r in completed:
            ref = r.completed_at or r.created_at
            if ref is None:
                continue
            if ref.tzinfo is None:
                ref = ref.replace(tzinfo=timezone.utc)
            if ref.date() == day:
                day_total += float(r.saved_usd or 0)
        weekly.append({"d": day.strftime("%a"), "v": round(day_total, 2)})

    return ImpactResponse(
        total_saved=round(total_saved, 2),
        total_co2_kg=round(total_co2, 2),
        rides_shared=rides_shared,
        weekly=weekly,
    )
