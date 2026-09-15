import csv
import io
import secrets

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pymongo import DESCENDING
from pymongo.database import Database

from ..database import get_db, get_next_sequence
from ..deps import event_is_upcoming, get_current_user, require_roles
from ..models import User, utc_now
from ..schemas import AttendeeOut, BookingOut

router = APIRouter(tags=["registrations"])


def _unique_code(db: Database) -> str:
    for _ in range(20):
        code = "EMS-" + secrets.token_hex(4).upper()
        if not db.registrations.find_one({"confirmation_code": code}):
            return code
    raise HTTPException(status_code=500, detail="Could not generate confirmation code")


def _booking_out(db: Database, reg_doc: dict) -> BookingOut:
    event_doc = db.events.find_one({"id": reg_doc["event_id"]}) or {}
    status_str = "Cancelled" if event_doc.get("status") == "cancelled" else "Confirmed"
    return BookingOut(
        id=reg_doc["id"],
        confirmation_code=reg_doc["confirmation_code"],
        event_id=reg_doc["event_id"],
        event_title=event_doc.get("title", "Unknown Event"),
        date=event_doc.get("date", ""),
        time=event_doc.get("time", ""),
        venue=event_doc.get("venue", ""),
        status=status_str,
        created_at=reg_doc["created_at"],
    )


@router.post("/events/{event_id}/register", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def register_for_event(
    event_id: int,
    db: Database = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event_doc = db.events.find_one({"id": event_id})
    if not event_doc:
        raise HTTPException(status_code=404, detail="Event not found")
    if event_doc.get("status") != "active":
        raise HTTPException(status_code=400, detail="This event has been cancelled")
    if not event_is_upcoming(event_doc.get("date", ""), event_doc.get("time", "")):
        raise HTTPException(status_code=400, detail="Cannot register for a past event")

    current_reg_count = db.registrations.count_documents({"event_id": event_id})
    if current_reg_count >= event_doc.get("capacity", 0):
        raise HTTPException(status_code=400, detail="This event is fully booked")

    existing = db.registrations.find_one({"event_id": event_id, "user_id": current_user.id})
    if existing:
        raise HTTPException(status_code=400, detail="You are already registered for this event")

    reg_id = get_next_sequence(db, "registrations")
    reg_doc = {
        "_id": reg_id,
        "id": reg_id,
        "event_id": event_id,
        "user_id": current_user.id,
        "confirmation_code": _unique_code(db),
        "created_at": utc_now(),
    }
    db.registrations.insert_one(reg_doc)
    return _booking_out(db, reg_doc)


@router.get("/bookings", response_model=list[BookingOut])
def my_bookings(
    db: Database = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cursor = db.registrations.find({"user_id": current_user.id}).sort("created_at", DESCENDING)
    return [_booking_out(db, reg) for reg in cursor]


@router.delete("/bookings/{registration_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_booking(
    registration_id: int,
    db: Database = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reg_doc = db.registrations.find_one({"id": registration_id})
    if not reg_doc:
        raise HTTPException(status_code=404, detail="Booking not found")

    event_doc = db.events.find_one({"id": reg_doc["event_id"]}) or {}
    owns_event = current_user.role in ("admin", "organizer") and (
        current_user.role == "admin" or event_doc.get("organizer_id") == current_user.id
    )
    if reg_doc.get("user_id") != current_user.id and not owns_event:
        raise HTTPException(status_code=403, detail="You can only cancel your own booking")

    db.registrations.delete_one({"id": registration_id})


@router.get("/events/{event_id}/attendees", response_model=list[AttendeeOut])
def event_attendees(
    event_id: int,
    db: Database = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "organizer")),
):
    event_doc = db.events.find_one({"id": event_id})
    if not event_doc:
        raise HTTPException(status_code=404, detail="Event not found")
    if current_user.role != "admin" and event_doc.get("organizer_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed to view this roster")

    cursor = db.registrations.find({"event_id": event_id})
    results = []
    for reg in cursor:
        u_doc = db.users.find_one({"id": reg["user_id"]}) or {}
        results.append(
            AttendeeOut(
                registration_id=reg["id"],
                confirmation_code=reg["confirmation_code"],
                user_id=reg["user_id"],
                full_name=u_doc.get("full_name", "Unknown"),
                email=u_doc.get("email", ""),
                role=u_doc.get("role", "attendee"),
                registration_date=reg["created_at"],
            )
        )
    return results


@router.get("/events/{event_id}/attendees/export")
def export_attendees(
    event_id: int,
    db: Database = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "organizer")),
):
    event_doc = db.events.find_one({"id": event_id})
    if not event_doc:
        raise HTTPException(status_code=404, detail="Event not found")
    if current_user.role != "admin" and event_doc.get("organizer_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed to export this roster")

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["confirmation_code", "full_name", "email", "role", "registration_date"])

    cursor = db.registrations.find({"event_id": event_id})
    for reg in cursor:
        u_doc = db.users.find_one({"id": reg["user_id"]}) or {}
        reg_date = reg["created_at"].isoformat(timespec="seconds") if hasattr(reg["created_at"], "isoformat") else str(reg["created_at"])
        writer.writerow(
            [
                reg["confirmation_code"],
                u_doc.get("full_name", ""),
                u_doc.get("email", ""),
                u_doc.get("role", ""),
                reg_date,
            ]
        )
    filename = f"attendees-event-{event_id}.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
