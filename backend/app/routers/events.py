import re
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import ASCENDING
from pymongo.database import Database

from ..database import get_db, get_next_sequence
from ..deps import event_is_upcoming, get_current_user, require_roles
from ..models import User, utc_now
from ..schemas import EventCreate, EventOut, EventUpdate

router = APIRouter(prefix="/events", tags=["events"])


def _to_out(db: Database, doc: dict) -> EventOut:
    registered = db.registrations.count_documents({"event_id": doc["id"]})
    status_str = doc.get("status", "active")
    date_str = doc.get("date", "")
    time_str = doc.get("time", "")
    return EventOut(
        id=doc["id"],
        title=doc["title"],
        category=doc["category"],
        date=date_str,
        time=time_str,
        venue=doc["venue"],
        capacity=doc["capacity"],
        status=status_str,
        organizer_id=doc["organizer_id"],
        registered=registered,
        is_upcoming=event_is_upcoming(date_str, time_str) and status_str == "active",
    )


def _can_manage(user: User, doc: dict) -> bool:
    return user.role == "admin" or doc.get("organizer_id") == user.id


@router.get("", response_model=list[EventOut])
def list_events(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    venue: str | None = Query(default=None),
    date: str | None = Query(default=None),
    timeframe: str | None = Query(default="all"),
    db: Database = Depends(get_db),
    _: User = Depends(get_current_user),
):
    filter_query = {}
    if search:
        pattern = f".*{re.escape(search.strip())}.*"
        filter_query["$or"] = [
            {"title": {"$regex": pattern, "$options": "i"}},
            {"venue": {"$regex": pattern, "$options": "i"}},
            {"category": {"$regex": pattern, "$options": "i"}},
        ]
    if category and category != "All":
        filter_query["category"] = category
    if venue and venue != "All":
        filter_query["venue"] = venue
    if date:
        filter_query["date"] = date

    cursor = db.events.find(filter_query).sort([("date", ASCENDING), ("time", ASCENDING)])
    results = []
    for doc in cursor:
        item = _to_out(db, doc)
        if timeframe == "upcoming" and not item.is_upcoming:
            continue
        if timeframe == "past" and item.is_upcoming:
            continue
        results.append(item)
    return results


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    db: Database = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "organizer")),
):
    ev_id = get_next_sequence(db, "events")
    doc = {
        "_id": ev_id,
        "id": ev_id,
        "organizer_id": current_user.id,
        "status": "active",
        "created_at": utc_now(),
        **payload.model_dump(),
    }
    db.events.insert_one(doc)
    return _to_out(db, doc)


@router.put("/{event_id}", response_model=EventOut)
def update_event(
    event_id: int,
    payload: EventUpdate,
    db: Database = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "organizer")),
):
    doc = db.events.find_one({"id": event_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Event not found")
    if not _can_manage(current_user, doc):
        raise HTTPException(status_code=403, detail="You can only manage your own events")
    data = payload.model_dump(exclude_unset=True)
    if "capacity" in data:
        reg_count = db.registrations.count_documents({"event_id": event_id})
        if data["capacity"] < reg_count:
            raise HTTPException(status_code=400, detail="Capacity cannot be below current registrations")

    if data:
        db.events.update_one({"id": event_id}, {"$set": data})
        doc = db.events.find_one({"id": event_id})

    return _to_out(db, doc)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    db: Database = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "organizer")),
):
    doc = db.events.find_one({"id": event_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Event not found")
    if not _can_manage(current_user, doc):
        raise HTTPException(status_code=403, detail="You can only delete your own events")

    db.registrations.delete_many({"event_id": event_id})
    db.events.delete_one({"id": event_id})
