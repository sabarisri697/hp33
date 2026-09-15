import csv
import io

from fastapi import APIRouter, Depends, Response
from pymongo import DESCENDING
from pymongo.database import Database

from ..database import get_db
from ..deps import require_roles
from ..models import User
from ..schemas import ActivityItem, DashboardStats, ReportRow

router = APIRouter(tags=["reports"])


def _occupancy(capacity: int, reg_count: int) -> float:
    if capacity <= 0:
        return 0.0
    return round((reg_count / capacity) * 100, 1)


@router.get("/dashboard/stats", response_model=DashboardStats)
def dashboard_stats(
    db: Database = Depends(get_db),
    _: User = Depends(require_roles("admin", "organizer", "attendee")),
):
    events = list(db.events.find({}))
    bookings = db.registrations.count_documents({})
    users = db.users.count_documents({})

    venues = {e.get("venue") for e in events if e.get("venue")}
    occupancies = []
    popular_title = None
    max_regs = -1

    for e in events:
        reg_count = db.registrations.count_documents({"event_id": e["id"]})
        cap = e.get("capacity", 0)
        if cap > 0:
            occupancies.append(_occupancy(cap, reg_count))
        if reg_count > max_regs:
            max_regs = reg_count
            popular_title = e.get("title")

    avg_occ = round(sum(occupancies) / len(occupancies), 1) if occupancies else 0.0

    return DashboardStats(
        total_events=len(events),
        total_bookings=bookings,
        registered_users=users,
        active_venues=len(venues),
        avg_occupancy=avg_occ,
        most_popular_event=popular_title if max_regs > 0 else None,
    )


@router.get("/dashboard/activity", response_model=list[ActivityItem])
def dashboard_activity(
    db: Database = Depends(get_db),
    _: User = Depends(require_roles("admin", "organizer", "attendee")),
):
    items: list[ActivityItem] = []

    regs = list(db.registrations.find({}).sort("created_at", DESCENDING).limit(8))
    for reg in regs:
        u_doc = db.users.find_one({"id": reg.get("user_id")}) or {}
        e_doc = db.events.find_one({"id": reg.get("event_id")}) or {}
        user_name = u_doc.get("full_name", "A user")
        event_title = e_doc.get("title", "an event")
        items.append(
            ActivityItem(
                kind="RSVP",
                message=f"{user_name} registered for {event_title}",
                created_at=reg.get("created_at"),
            )
        )

    events = list(db.events.find({}).sort("created_at", DESCENDING).limit(4))
    for ev in events:
        u_doc = db.users.find_one({"id": ev.get("organizer_id")}) or {}
        org_name = u_doc.get("full_name", "An organizer")
        items.append(
            ActivityItem(
                kind="Event",
                message=f"{org_name} created {ev.get('title')}",
                created_at=ev.get("created_at"),
            )
        )

    items.sort(key=lambda item: item.created_at, reverse=True)
    return items[:8]


@router.get("/reports/events", response_model=list[ReportRow])
def event_reports(
    db: Database = Depends(get_db),
    _: User = Depends(require_roles("admin", "organizer")),
):
    events = list(db.events.find({}).sort("date", DESCENDING))
    results = []
    for ev in events:
        reg_count = db.registrations.count_documents({"event_id": ev["id"]})
        cap = ev.get("capacity", 0)
        results.append(
            ReportRow(
                event_id=ev["id"],
                title=ev.get("title", ""),
                category=ev.get("category", ""),
                venue=ev.get("venue", ""),
                date=ev.get("date", ""),
                capacity=cap,
                registered=reg_count,
                occupancy_rate=_occupancy(cap, reg_count),
                status=ev.get("status", "active"),
            )
        )
    return results


@router.get("/reports/events/export")
def export_reports(
    db: Database = Depends(get_db),
    _: User = Depends(require_roles("admin", "organizer")),
):
    events = list(db.events.find({}).sort("date", DESCENDING))
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["event_id", "title", "category", "venue", "date", "capacity", "registered", "occupancy_rate", "status"])
    for ev in events:
        reg_count = db.registrations.count_documents({"event_id": ev["id"]})
        cap = ev.get("capacity", 0)
        writer.writerow(
            [
                ev["id"],
                ev.get("title", ""),
                ev.get("category", ""),
                ev.get("venue", ""),
                ev.get("date", ""),
                cap,
                reg_count,
                _occupancy(cap, reg_count),
                ev.get("status", "active"),
            ]
        )
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="event-reports.csv"'},
    )
