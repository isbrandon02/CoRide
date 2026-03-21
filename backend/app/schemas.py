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
    work_schedule: WorkScheduleOut
    vehicle: VehicleOut
    onboarding_completed: bool
