import re
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Ride, User, UserProfile
from app.schemas import RideCreate, RideOut, RidePatch, RidesResponse, RideOtherUserOut
from app.security import get_current_user

router = APIRouter(prefix="/rides", tags=["rides"])

EST_SAVED_USD = 4.5
EST_CO2_KG = 2.3
_DAY_INDEX = {
    "mon": 0,
    "monday": 0,
    "tue": 1,
    "tues": 1,
    "tuesday": 1,
    "wed": 2,
    "weds": 2,
    "wednesday": 2,
    "thu": 3,
    "thurs": 3,
    "thursday": 3,
    "fri": 4,
    "friday": 4,
    "sat": 5,
    "saturday": 5,
    "sun": 6,
    "sunday": 6,
}
_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _name_from_email(email: str) -> str:
    local = (email or "").split("@")[0]
    parts = [p for p in re.split(r"[._-]+", local) if p]
    if not parts:
        return "Member"
    return " ".join(p.capitalize() for p in parts)


def _days_from_range(start: int, end: int) -> list[int]:
    if start <= end:
        return list(range(start, end + 1))
    return list(range(start, 7)) + list(range(0, end + 1))


def _parse_workdays(raw: str) -> list[int]:
    text = str(raw or "").strip().lower()
    if not text:
        return []

    normalized = (
        text.replace("–", "-")
        .replace("—", "-")
        .replace("&", ",")
        .replace("/", ",")
        .replace(" and ", ",")
    )
    pieces = [p.strip() for p in re.split(r"[;,]", normalized) if p.strip()]
    out: list[int] = []

    for piece in pieces:
        compact = re.sub(r"\s+", " ", piece)
        if compact in {"weekdays", "week days"}:
            out.extend([0, 1, 2, 3, 4])
            continue
        if compact in {"weekends", "week ends"}:
            out.extend([5, 6])
            continue
        if compact in {"daily", "every day", "all week"}:
            out.extend(range(7))
            continue

        range_match = re.match(r"([a-z]+)\s*-\s*([a-z]+)", compact)
        if range_match:
            start = _DAY_INDEX.get(range_match.group(1))
            end = _DAY_INDEX.get(range_match.group(2))
            if start is not None and end is not None:
                out.extend(_days_from_range(start, end))
                continue

        for token in re.findall(r"[a-z]+", compact):
            idx = _DAY_INDEX.get(token)
            if idx is not None:
                out.append(idx)

    seen: set[int] = set()
    deduped: list[int] = []
    for idx in out:
        if idx not in seen:
            seen.add(idx)
            deduped.append(idx)
    return sorted(deduped)


def _availability_days(profile: UserProfile | None) -> list[str]:
    schedule = profile.work_schedule if profile and isinstance(profile.work_schedule, dict) else {}
    raw_days = schedule.get("days", "")
    parsed = _parse_workdays(str(raw_days or ""))
    if parsed:
        return [_DAY_LABELS[idx] for idx in parsed]
    days_text = str(raw_days or "").strip()
    return [days_text] if days_text else []


def _short_date_label(value: date) -> str:
    return value.strftime("%a %b ") + str(value.day)


def _ride_to_out(ride: Ride, me: User, db: Session) -> RideOut:
    requester = db.get(User, ride.requester_id)
    driver = db.get(User, ride.driver_id)
    if requester is None or driver is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Missing user")

    if me.id == ride.requester_id:
        role = "requester"
        other = driver
    else:
        role = "driver"
        other = requester

    requester_profile = db.scalar(
        select(UserProfile).where(UserProfile.user_id == ride.requester_id)
    )
    driver_profile = db.scalar(
        select(UserProfile).where(UserProfile.user_id == ride.driver_id)
    )

    # Route previews should reflect the person offering the rideshare, i.e. the driver's commute.
    route_origin = (driver_profile.home_address if driver_profile else "") or ""
    route_destination = (driver_profile.office_address if driver_profile else "") or ""

    return RideOut(
        id=ride.id,
        status=ride.status,
        role=role,
        other_user=RideOtherUserOut(
            id=other.id,
            email=other.email,
            name=_name_from_email(other.email),
        ),
        note=ride.note or "",
        created_at=ride.created_at,
        requested_dates=[
            date.fromisoformat(str(d))
            for d in (ride.requested_dates or [])
            if isinstance(d, str) and d
        ],
        availability_days=[str(day) for day in (ride.availability_days or []) if str(day).strip()],
        saved_usd=ride.saved_usd,
        co2_kg=ride.co2_kg,
        route_origin=route_origin.strip(),
        route_destination=route_destination.strip(),
    )


@router.get("", response_model=RidesResponse)
def list_rides(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RidesResponse:
    rides = db.scalars(
        select(Ride)
        .where(or_(Ride.requester_id == current.id, Ride.driver_id == current.id))
        .order_by(Ride.created_at.desc())
    ).all()
    return RidesResponse(rides=[_ride_to_out(r, current, db) for r in rides])


@router.post("", response_model=RideOut, status_code=status.HTTP_201_CREATED)
def create_ride(
    body: RideCreate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RideOut:
    if body.driver_id == current.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot request a ride from yourself")

    driver = db.get(User, body.driver_id)
    if driver is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")
    if not driver.onboarding_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That coworker has not finished onboarding yet",
        )

    driver_profile = db.get(UserProfile, driver.id)
    allowed_days = _parse_workdays(
        str(((driver_profile.work_schedule or {}) if driver_profile else {}).get("days", ""))
    )
    requested_dates = sorted(set(body.requested_dates))
    today = datetime.now(timezone.utc).date()
    if any(day < today for day in requested_dates):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ride requests must be scheduled for today or a future date",
        )
    if allowed_days:
        invalid = [day for day in requested_dates if day.weekday() not in allowed_days]
        if invalid:
            invalid_labels = ", ".join(_short_date_label(day) for day in invalid[:3])
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Those dates do not match the driver's listed workdays: {invalid_labels}",
            )

    dup = db.scalars(
        select(Ride).where(
            Ride.requester_id == current.id,
            Ride.driver_id == body.driver_id,
            Ride.status == "pending",
        )
    ).first()
    if dup is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending request with this driver",
        )

    ride = Ride(
        requester_id=current.id,
        driver_id=body.driver_id,
        status="pending",
        note=(body.note or "").strip(),
        requested_dates=[d.isoformat() for d in requested_dates],
        availability_days=_availability_days(driver_profile),
    )
    db.add(ride)
    db.commit()
    db.refresh(ride)
    return _ride_to_out(ride, current, db)


@router.patch("/{ride_id}", response_model=RideOut)
def patch_ride(
    ride_id: int,
    body: RidePatch,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RideOut:
    ride = db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found")

    if current.id not in (ride.requester_id, ride.driver_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not part of this ride")

    new_status = body.status.strip().lower()
    allowed = {"accepted", "declined", "cancelled", "completed"}
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status (use one of: {', '.join(sorted(allowed))})",
        )

    is_requester = current.id == ride.requester_id
    is_driver = current.id == ride.driver_id

    if new_status == "cancelled":
        if not is_requester:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the person who requested the ride can cancel it",
            )
        if ride.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You can only cancel a ride while the request is still pending",
            )
        ride.status = "cancelled"

    elif new_status in ("accepted", "declined"):
        if not is_driver:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the driver can accept or decline this request",
            )
        if ride.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This request is no longer pending",
            )
        ride.status = new_status

    elif new_status == "completed":
        if ride.status != "accepted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only an accepted ride can be marked complete",
            )
        ride.status = "completed"
        ride.completed_at = datetime.now(timezone.utc)
        ride.saved_usd = EST_SAVED_USD
        ride.co2_kg = EST_CO2_KG

    db.commit()
    db.refresh(ride)
    return _ride_to_out(ride, current, db)
