import re

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.matching import (
    combined_match_score,
    route_overlap_score,
    time_proximity_score,
    work_start_minutes,
)
from app.models import User, UserProfile, UserVehicle
from app.schemas import MatchItemOut, MatchesResponse, VehicleOut, WorkScheduleOut
from app.security import get_current_user

router = APIRouter(prefix="/matches", tags=["matches"])


def _name_from_email(email: str) -> str:
    local = (email or "").split("@")[0]
    parts = [p for p in re.split(r"[._-]+", local) if p]
    if not parts:
        return "Member"
    return " ".join(p.capitalize() for p in parts)


def _work_schedule_out(profile: UserProfile | None) -> WorkScheduleOut:
    if not profile or not profile.work_schedule:
        return WorkScheduleOut()
    d = profile.work_schedule
    return WorkScheduleOut(
        days=str(d.get("days", "")),
        start_time=str(d.get("start_time", "")),
        end_time=str(d.get("end_time", "")),
    )


def _vehicle_out(vehicle: UserVehicle | None) -> VehicleOut:
    if not vehicle:
        return VehicleOut()
    return VehicleOut(
        make=vehicle.make,
        model=vehicle.model,
        year=vehicle.year,
        color=vehicle.color,
    )


@router.get("", response_model=MatchesResponse)
def list_matches(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MatchesResponse:
    """
    Rank other onboarded users by:
    - **60%** route overlap (token overlap on home + office + commute text; same office boosts)
    - **40%** time proximity (work start time; 2h window to 0 score)
    """
    me_profile = db.get(UserProfile, current.id)
    if me_profile is None:
        me_profile = UserProfile(user_id=current.id)

    my_home = me_profile.home_address or ""
    my_office = me_profile.office_address or ""
    my_route = me_profile.commute_route or ""
    my_ws = me_profile.work_schedule or {}
    my_start = work_start_minutes(my_ws if isinstance(my_ws, dict) else {})

    others = (
        db.query(User)
        .filter(User.id != current.id)
        .filter(User.onboarding_completed.is_(True))
        .all()
    )

    out: list[MatchItemOut] = []
    for u in others:
        p = db.get(UserProfile, u.id)
        if p is None:
            continue
        v = db.get(UserVehicle, u.id)

        oh = p.home_address or ""
        oo = p.office_address or ""
        ort = p.commute_route or ""
        if not (oh.strip() or oo.strip()):
            continue

        ro = route_overlap_score(my_home, my_office, my_route, oh, oo, ort)
        other_ws = p.work_schedule if isinstance(p.work_schedule, dict) else {}
        other_start = work_start_minutes(other_ws)
        tp = time_proximity_score(my_start, other_start, max_delta=120)

        combined = combined_match_score(ro, tp)
        match_score = round(combined * 100, 1)
        route_pct = round(ro * 100, 1)
        time_pct = round(tp * 100, 1)

        out.append(
            MatchItemOut(
                id=u.id,
                email=u.email,
                name=_name_from_email(u.email),
                match_score=match_score,
                route_overlap=route_pct,
                time_score=time_pct,
                home_address=oh,
                office_address=oo,
                commute_route=ort,
                work_schedule=_work_schedule_out(p),
                vehicle=_vehicle_out(v),
            )
        )

    out.sort(key=lambda x: x.match_score, reverse=True)
    return MatchesResponse(matches=out)
