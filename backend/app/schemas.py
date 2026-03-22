from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    id: int
    email: str
    onboarding_completed: bool

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SignupResponse(BaseModel):
    message: str
    email: str


class WorkScheduleIn(BaseModel):
    days: str = ""
    start_time: str = ""
    end_time: str = ""


class VehicleIn(BaseModel):
    make: str = ""
    model: str = ""
    year: int | None = None
    color: str = ""


class OnboardingPut(BaseModel):
    home_address: str = Field(..., min_length=1, max_length=2000)
    office_address: str = Field(..., min_length=1, max_length=2000)
    hobbies: str = Field(default="", max_length=2000)
    commute_route: str = Field(default="", max_length=2000)
    avatar_url: str = Field(default="", max_length=2048)
    work_schedule: WorkScheduleIn = Field(default_factory=WorkScheduleIn)
    vehicle: VehicleIn = Field(default_factory=VehicleIn)


class WorkScheduleOut(BaseModel):
    days: str = ""
    start_time: str = ""
    end_time: str = ""


class VehicleOut(BaseModel):
    make: str | None = None
    model: str | None = None
    year: int | None = None
    color: str | None = None


class ProfileOut(BaseModel):
    home_address: str
    office_address: str
    hobbies: str
    commute_route: str
    avatar_url: str = ""
    work_schedule: WorkScheduleOut
    vehicle: VehicleOut
    onboarding_completed: bool


class MatchItemOut(BaseModel):
    """Carpool match for current user. Scores are 0–100."""

    id: int
    email: str
    name: str
    match_score: float
    route_overlap: float
    time_score: float
    home_address: str = ""
    office_address: str = ""
    commute_route: str = ""
    work_schedule: WorkScheduleOut = Field(default_factory=WorkScheduleOut)
    vehicle: VehicleOut = Field(default_factory=VehicleOut)


class MatchesResponse(BaseModel):
    matches: list[MatchItemOut]
    weights: dict[str, float] = Field(
        default_factory=lambda: {"route_overlap": 0.6, "time_proximity": 0.4},
        description="Score = route_overlap * w1 + time_score * w2",
    )


class RideCreate(BaseModel):
    driver_id: int = Field(..., ge=1)
    note: str = Field(default="", max_length=2000)


class RidePatch(BaseModel):
    status: str = Field(..., min_length=4, max_length=24)


class RideOtherUserOut(BaseModel):
    id: int
    email: str
    name: str


class RideOut(BaseModel):
    id: int
    status: str
    role: str
    other_user: RideOtherUserOut
    note: str
    created_at: datetime
    saved_usd: float | None = None
    co2_kg: float | None = None


class RidesResponse(BaseModel):
    rides: list[RideOut]


class ImpactResponse(BaseModel):
    total_saved: float
    total_co2_kg: float
    rides_shared: int
    weekly: list[dict[str, Any]]


class ChatDmCreate(BaseModel):
    other_user_id: int = Field(..., ge=1)


class ChatDmOut(BaseModel):
    conversation_id: int
    title: str


class ChatMemberFace(BaseModel):
    user_id: int
    display_name: str
    avatar_url: str | None = None


class ChatConversationListItem(BaseModel):
    id: int
    title: str
    preview: str
    time: str
    is_group: bool = False
    members: list[ChatMemberFace] = Field(default_factory=list)
    extra_member_count: int = 0


class ChatConversationsResponse(BaseModel):
    conversations: list[ChatConversationListItem]


class ChatMessageOut(BaseModel):
    id: int
    sender_id: int
    body: str
    created_at: datetime
    is_me: bool
    sender_name: str = ""


class ChatMessagesResponse(BaseModel):
    messages: list[ChatMessageOut]


class ChatMessageCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=4000)
