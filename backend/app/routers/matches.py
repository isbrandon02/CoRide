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
from app.models import User, UserProfile
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


# Stable “Find” fleet: one synthetic car per driver id (not tied to profile garage).
_SYNTHETIC_DRIVER_VEHICLES: list[tuple[str, str, int, str]] = [
    ("Toyota", "Camry", 2022, "Silver"),
    ("Honda", "CR-V", 2021, "Lunar Silver"),
    ("Tesla", "Model 3", 2023, "Pearl White"),
    ("Subaru", "Outback", 2020, "Autumn Green"),
    ("Ford", "Mustang Mach-E", 2022, "Rapid Red"),
    ("Hyundai", "Ioniq 5", 2023, "Digital Teal"),
    ("Volkswagen", "ID.4", 2022, "Moonstone Gray"),
    ("Mazda", "CX-5", 2021, "Soul Red Crystal"),
    ("BMW", "330i", 2022, "Portimao Blue"),
    ("Mercedes-Benz", "C 300", 2021, "Obsidian Black"),
    ("Nissan", "Leaf", 2022, "Pearl White"),
    ("Chevrolet", "Bolt EUV", 2023, "Bright Blue"),
    ("Lexus", "ES 350", 2022, "Eminent White"),
    ("Audi", "Q5", 2021, "Navarra Blue"),
    ("Kia", "EV6", 2023, "Yacht Blue"),
    ("Volvo", "XC60", 2022, "Crystal White"),
    ("Acura", "TLX", 2021, "Platinum White"),
    ("Genesis", "GV70", 2023, "Uyuni White"),
    ("Rivian", "R1T", 2024, "Forest Green"),
    ("Toyota", "RAV4 Prime", 2023, "Magnetic Gray"),
    ("Honda", "Accord Hybrid", 2022, "Radiant Red"),
    ("Jeep", "Grand Cherokee 4xe", 2023, "Velvet Red"),
]


def _synthetic_vehicle_for_match(user_id: int) -> VehicleOut:
    i = user_id % len(_SYNTHETIC_DRIVER_VEHICLES)
    mk, md, yr, col = _SYNTHETIC_DRIVER_VEHICLES[i]
    return VehicleOut(make=mk, model=md, year=yr, color=col)


def _pair_trip_estimates(
    me_id: int,
    other_id: int,
    route_overlap: float,
    time_proximity: float,
) -> tuple[int, float, float, float, int]:
    """
    Deterministic faux metrics aligned with overlap/time: more overlap → less detour, tighter totals.

    Returns (detour_minutes, total_drive_miles, co2_saved_kg, share_usd, eta_minutes).
    """
    ro = min(1.0, max(0.0, route_overlap))
    tp = min(1.0, max(0.0, time_proximity))
    seed = (me_id * 31 + other_id * 17) % 1000
    shared_leg_mi = round((9.0 + (seed % 130) / 10.0) * (0.62 + 0.38 * ro), 1)

    detour_min = int(round(4 + (1.0 - ro) * 21 + (1.0 - tp) * 7))
    detour_min = max(3, min(28, detour_min))

    detour_mi = round(detour_min * 0.38, 1)
    total_drive = round(shared_leg_mi + detour_mi, 1)

    co2 = round(total_drive * 0.17 * (0.48 + 0.52 * ro), 2)
    share_usd = round(0.11 * total_drive + 0.05 * detour_min + 1.5, 2)
    eta_min = int(round(12 + detour_min * 0.52))

    return detour_min, total_drive, co2, share_usd, eta_min


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

        detour_min, total_mi, co2_kg, share_usd, eta_min = _pair_trip_estimates(
            current.id, u.id, ro, tp
        )

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
                vehicle=_synthetic_vehicle_for_match(u.id),
                detour_minutes=detour_min,
                total_drive_miles=total_mi,
                co2_saved_kg=co2_kg,
                share_usd=share_usd,
                eta_minutes=eta_min,
            )
        )

    out.sort(key=lambda x: x.match_score, reverse=True)
    return MatchesResponse(matches=out)
