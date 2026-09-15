from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

ROLES = ("admin", "organizer", "attendee")
CATEGORIES = ("Technology", "Academic", "Cultural", "Sports")
EVENT_STATUSES = ("active", "cancelled")


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role: Literal["organizer", "attendee"] = "attendee"

    @field_validator("username")
    @classmethod
    def username_alnum(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned.replace("_", "").isalnum():
            raise ValueError("Username may contain letters, numbers, and underscores only")
        return cleaned.lower()

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        return value.strip()


class AdminUserCreate(UserCreate):
    role: Literal["admin", "organizer", "attendee"] = "attendee"


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    role: Literal["admin", "organizer", "attendee"] | None = None
    password: str | None = Field(default=None, min_length=8, max_length=72)


class UserOut(BaseModel):
    id: int
    full_name: str
    username: str
    email: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    username: str = Field(min_length=3)
    password: str = Field(min_length=1)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class EventCreate(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    category: Literal["Technology", "Academic", "Cultural", "Sports"]
    date: str
    time: str
    venue: str = Field(min_length=2, max_length=120)
    capacity: int = Field(ge=1, le=5000)

    @field_validator("date")
    @classmethod
    def valid_date(cls, value: str) -> str:
        datetime.strptime(value, "%Y-%m-%d")
        return value

    @field_validator("time")
    @classmethod
    def valid_time(cls, value: str) -> str:
        cleaned = value.strip()[:5]
        datetime.strptime(cleaned, "%H:%M")
        return cleaned

    @field_validator("title", "venue")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=160)
    category: Literal["Technology", "Academic", "Cultural", "Sports"] | None = None
    date: str | None = None
    time: str | None = None
    venue: str | None = Field(default=None, min_length=2, max_length=120)
    capacity: int | None = Field(default=None, ge=1, le=5000)
    status: Literal["active", "cancelled"] | None = None

    @field_validator("date")
    @classmethod
    def valid_date(cls, value: str | None) -> str | None:
        if value:
            datetime.strptime(value, "%Y-%m-%d")
        return value

    @field_validator("time")
    @classmethod
    def valid_time(cls, value: str | None) -> str | None:
        if value:
            cleaned = value.strip()[:5]
            datetime.strptime(cleaned, "%H:%M")
            return cleaned
        return value


class EventOut(BaseModel):
    id: int
    title: str
    category: str
    date: str
    time: str
    venue: str
    capacity: int
    status: str
    organizer_id: int
    registered: int
    is_upcoming: bool

    model_config = {"from_attributes": True}


class BookingOut(BaseModel):
    id: int
    confirmation_code: str
    event_id: int
    event_title: str
    date: str
    time: str
    venue: str
    status: str
    created_at: datetime


class AttendeeOut(BaseModel):
    registration_id: int
    confirmation_code: str
    user_id: int
    full_name: str
    email: str
    role: str
    registration_date: datetime


class ReportRow(BaseModel):
    event_id: int
    title: str
    category: str
    venue: str
    date: str
    capacity: int
    registered: int
    occupancy_rate: float
    status: str


class DashboardStats(BaseModel):
    total_events: int
    total_bookings: int
    registered_users: int
    active_venues: int
    avg_occupancy: float
    most_popular_event: str | None


class ActivityItem(BaseModel):
    kind: str
    message: str
    created_at: datetime
