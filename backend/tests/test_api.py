import os

os.environ["MONGODB_DB_NAME"] = "test_ems_db"

from fastapi.testclient import TestClient
from app.database import get_db, init_db
from app.main import app
from app.seed import seed_if_empty

# Clean test database
db = get_db()
db.client.drop_database("test_ems_db")
init_db(db)
seed_if_empty(db)

client = TestClient(app)


def login(username: str, password: str):
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_health():
    assert client.get("/api/health").json()["status"] == "ok"


def test_login_and_failed_login():
    assert client.post("/api/auth/login", json={"username": "admin", "password": "wrong"}).status_code == 401
    test_db = get_db()
    failed = test_db.login_attempts.count_documents({"username": "admin", "success": "failed"})
    assert failed >= 1
    token = login("admin", "Admin@123")
    me = client.get("/api/auth/me", headers=token)
    assert me.status_code == 200
    assert me.json()["role"] == "admin"


def test_register_validation_and_book_event():
    weak = client.post(
        "/api/auth/register",
        json={
            "full_name": "A",
            "username": "ab",
            "email": "not-an-email",
            "password": "short",
            "role": "attendee",
        },
    )
    assert weak.status_code == 422

    payload = {
        "full_name": "New Student",
        "username": "newstudent",
        "email": "newstudent@campus.edu",
        "password": "Student@123",
        "role": "attendee",
    }
    created = client.post("/api/auth/register", json=payload)
    assert created.status_code == 201, created.text
    duplicate = client.post("/api/auth/register", json=payload)
    assert duplicate.status_code == 400

    headers = login("newstudent", "Student@123")
    events = client.get("/api/events", headers=headers).json()
    upcoming = next(event for event in events if event["is_upcoming"])
    booked = client.post(f"/api/events/{upcoming['id']}/register", headers=headers)
    assert booked.status_code == 201
    assert booked.json()["confirmation_code"].startswith("EMS-")
    again = client.post(f"/api/events/{upcoming['id']}/register", headers=headers)
    assert again.status_code == 400


def test_event_search_crud_and_reports():
    headers = login("admin", "Admin@123")
    created = client.post(
        "/api/events",
        headers=headers,
        json={
            "title": "Library Workshop",
            "category": "Academic",
            "date": "2027-01-15",
            "time": "11:00:00",
            "venue": "Library Hall",
            "capacity": 40,
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["time"] == "11:00"
    event_id = created.json()["id"]

    searched = client.get("/api/events?search=library&category=Academic&venue=Library Hall", headers=headers)
    assert searched.status_code == 200
    assert any(event["id"] == event_id for event in searched.json())

    empty = client.get("/api/events?search=does-not-exist", headers=headers).json()
    assert empty == []

    updated = client.put(
        f"/api/events/{event_id}",
        headers=headers,
        json={"capacity": 50, "status": "active"},
    )
    assert updated.status_code == 200
    assert updated.json()["capacity"] == 50

    report = client.get("/api/reports/events", headers=headers)
    assert report.status_code == 200
    assert any(row["event_id"] == event_id for row in report.json())
    csv_report = client.get("/api/reports/events/export", headers=headers)
    assert csv_report.status_code == 200
    assert "text/csv" in csv_report.headers["content-type"]
    assert client.delete(f"/api/events/{event_id}", headers=headers).status_code == 204


def test_student_user_crud_and_search():
    headers = login("admin", "Admin@123")
    created = client.post(
        "/api/users",
        headers=headers,
        json={
            "full_name": "Ravi Kumar",
            "username": "ravi",
            "email": "ravi@campus.edu",
            "password": "Student@123",
            "role": "attendee",
        },
    )
    assert created.status_code == 201, created.text
    user_id = created.json()["id"]

    found = client.get("/api/users?q=ravi", headers=headers)
    assert found.status_code == 200
    assert any(user["username"] == "ravi" for user in found.json())

    updated = client.put(
        f"/api/users/{user_id}",
        headers=headers,
        json={"full_name": "Ravi K.", "role": "attendee"},
    )
    assert updated.status_code == 200
    assert updated.json()["full_name"] == "Ravi K."
    assert client.delete(f"/api/users/{user_id}", headers=headers).status_code == 204


def test_attendee_cannot_access_admin_features():
    headers = login("attendee", "Attendee@123")
    assert client.get("/api/users", headers=headers).status_code == 403
    assert client.get("/api/reports/events", headers=headers).status_code == 403
    created = client.post(
        "/api/events",
        headers=headers,
        json={
            "title": "Unauthorized Event",
            "category": "Sports",
            "date": "2027-02-01",
            "time": "09:00",
            "venue": "Hall B",
            "capacity": 10,
        },
    )
    assert created.status_code == 403


def test_event_filters_and_timeframe():
    headers = login("attendee", "Attendee@123")
    res_upcoming = client.get("/api/events?timeframe=upcoming", headers=headers)
    assert res_upcoming.status_code == 200
    assert all(item["is_upcoming"] for item in res_upcoming.json())

    res_past = client.get("/api/events?timeframe=past", headers=headers)
    assert res_past.status_code == 200
    assert all(not item["is_upcoming"] for item in res_past.json())

    res_tech = client.get("/api/events?category=Technology", headers=headers)
    assert res_tech.status_code == 200
    assert all(item["category"] == "Technology" for item in res_tech.json())
