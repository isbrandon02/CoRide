from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserProfile, UserVehicle
from app.schemas import (
    OnboardingPut,
    ProfileOut,
    VehicleOut,
    WorkScheduleOut,
)
from app.security import get_current_user

router = APIRouter(prefix="/profile", tags=["profile"])


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


def _to_profile_out(user: User, db: Session) -> ProfileOut:
    profile = db.get(UserProfile, user.id)
    vehicle = db.get(UserVehicle, user.id)
    return ProfileOut(
        home_address=profile.home_address if profile else "",
        office_address=profile.office_address if profile else "",
        hobbies=profile.hobbies if profile else "",
        commute_route=profile.commute_route if profile else "",
        avatar_url=(profile.avatar_url if profile else "") or "",
        work_schedule=_work_schedule_out(profile),
        vehicle=_vehicle_out(vehicle),
        onboarding_completed=user.onboarding_completed,
    )


@router.get("", response_model=ProfileOut)
def get_profile(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileOut:
    return _to_profile_out(current, db)


@router.put("", response_model=ProfileOut)
def save_onboarding(
    body: OnboardingPut,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileOut:
    profile = db.get(UserProfile, current.id)
    if profile is None:
        profile = UserProfile(user_id=current.id)
    profile.home_address = body.home_address.strip()
    profile.office_address = body.office_address.strip()
    profile.hobbies = body.hobbies.strip()
    profile.commute_route = body.commute_route.strip()
    profile.avatar_url = (body.avatar_url or "").strip()
    profile.work_schedule = {
        "days": body.work_schedule.days.strip(),
        "start_time": body.work_schedule.start_time.strip(),
        "end_time": body.work_schedule.end_time.strip(),
    }

    vehicle = db.get(UserVehicle, current.id)
    if vehicle is None:
        vehicle = UserVehicle(user_id=current.id)
    v = body.vehicle
    vehicle.make = v.make.strip() or None
    vehicle.model = v.model.strip() or None
    vehicle.year = v.year
    vehicle.color = v.color.strip() or None

    current.onboarding_completed = True

    db.add(profile)
    db.add(vehicle)
    db.add(current)
    db.commit()
    db.refresh(current)

    return _to_profile_out(current, db)
