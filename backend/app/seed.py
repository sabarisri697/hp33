from datetime import datetime, timedelta, timezone
from pymongo.database import Database

from .database import get_next_sequence
from .models import utc_now
from .security import generate_salt, hash_password


def seed_if_empty(db: Database) -> None:
    if db.users.count_documents({}) > 0:
        return

    admin_salt = generate_salt()
    organizer_salt = generate_salt()
    attendee_salt = generate_salt()
    extra_salt = generate_salt()

    admin_id = get_next_sequence(db, "users")
    admin_doc = {
        "_id": admin_id,
        "id": admin_id,
        "full_name": "Campus Admin",
        "username": "admin",
        "email": "admin@campus.edu",
        "salt": admin_salt,
        "password_hash": hash_password("Admin@123", admin_salt),
        "role": "admin",
        "created_at": utc_now(),
    }

    organizer_id = get_next_sequence(db, "users")
    organizer_doc = {
        "_id": organizer_id,
        "id": organizer_id,
        "full_name": "Priya Organizer",
        "username": "organizer",
        "email": "organizer@campus.edu",
        "salt": organizer_salt,
        "password_hash": hash_password("Organizer@123", organizer_salt),
        "role": "organizer",
        "created_at": utc_now(),
    }

    attendee_id = get_next_sequence(db, "users")
    attendee_doc = {
        "_id": attendee_id,
        "id": attendee_id,
        "full_name": "Alex Student",
        "username": "attendee",
        "email": "alex@campus.edu",
        "salt": attendee_salt,
        "password_hash": hash_password("Attendee@123", attendee_salt),
        "role": "attendee",
        "created_at": utc_now(),
    }

    extra_id = get_next_sequence(db, "users")
    extra_doc = {
        "_id": extra_id,
        "id": extra_id,
        "full_name": "Sara Patel",
        "username": "sara",
        "email": "sara@campus.edu",
        "salt": extra_salt,
        "password_hash": hash_password("Student@123", extra_salt),
        "role": "attendee",
        "created_at": utc_now(),
    }

    db.users.insert_many([admin_doc, organizer_doc, attendee_doc, extra_doc])

    events_data = [
        {
            "title": "Annual Tech Symposium",
            "category": "Technology",
            "date": (datetime.now() + timedelta(days=20)).strftime("%Y-%m-%d"),
            "time": "10:00",
            "venue": "Main Auditorium",
            "capacity": 150,
            "status": "active",
            "organizer_id": organizer_id,
            "created_at": utc_now(),
        },
        {
            "title": "Inter-College Chess Championship",
            "category": "Sports",
            "date": (datetime.now() + timedelta(days=25)).strftime("%Y-%m-%d"),
            "time": "09:00",
            "venue": "Hall B",
            "capacity": 50,
            "status": "active",
            "organizer_id": organizer_id,
            "created_at": utc_now(),
        },
        {
            "title": "Guest Lecture: AI in Healthcare",
            "category": "Academic",
            "date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            "time": "14:00",
            "venue": "Science Block",
            "capacity": 80,
            "status": "active",
            "organizer_id": organizer_id,
            "created_at": utc_now(),
        },
        {
            "title": "Spring Cultural Festival",
            "category": "Cultural",
            "date": (datetime.now() + timedelta(days=40)).strftime("%Y-%m-%d"),
            "time": "17:00",
            "venue": "Campus Ground",
            "capacity": 300,
            "status": "active",
            "organizer_id": organizer_id,
            "created_at": utc_now(),
        },
        {
            "title": "Freshers Orientation Recap",
            "category": "Academic",
            "date": (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d"),
            "time": "11:00",
            "venue": "Main Auditorium",
            "capacity": 200,
            "status": "active",
            "organizer_id": admin_id,
            "created_at": utc_now(),
        },
    ]

    inserted_events = []
    for item in events_data:
        ev_id = get_next_sequence(db, "events")
        item["_id"] = ev_id
        item["id"] = ev_id
        inserted_events.append(item)

    db.events.insert_many(inserted_events)

    codes = ["EMS-A1B2C3D4", "EMS-E5F6G7H8"]
    reg1_id = get_next_sequence(db, "registrations")
    reg2_id = get_next_sequence(db, "registrations")

    reg1 = {
        "_id": reg1_id,
        "id": reg1_id,
        "event_id": inserted_events[0]["id"],
        "user_id": attendee_id,
        "confirmation_code": codes[0],
        "created_at": utc_now(),
    }
    reg2 = {
        "_id": reg2_id,
        "id": reg2_id,
        "event_id": inserted_events[2]["id"],
        "user_id": attendee_id,
        "confirmation_code": codes[1],
        "created_at": utc_now(),
    }
    db.registrations.insert_many([reg1, reg2])

    login_id = get_next_sequence(db, "login_attempts")
    db.login_attempts.insert_one(
        {
            "_id": login_id,
            "id": login_id,
            "username": "unknown",
            "success": "failed",
            "created_at": datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1),
        }
    )
