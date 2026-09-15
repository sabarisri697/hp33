# Campus Event Management System

College Event Management System built with a FastAPI backend, MongoDB, and a responsive web frontend. The source of truth is `srs.md`. Version 1 covers registration and login, event management, search and filter, seat booking with confirmation codes, participant management, student/user CRUD, dashboard, and reports. Email/SMS, payments, QR check-in, and a mobile app are out of scope.

## Features

- Register as an attendee or organizer; admin is a seeded role
- Login with username and password (SHA-256 hashed passwords with a 16-character salt)
- Failed login attempts are stored in MongoDB
- Organizers and admins create, update, cancel, and delete events
- Browse upcoming and past events; search and filter by date, category, and venue
- Attendees book a seat and receive a unique confirmation code
- Admin/organizer participant lists with CSV export
- Admin student and staff management (create, search, update, delete)
- Dashboard stats and event/participant reports with CSV export

## Requirements

- Python 3.10 or later
- MongoDB (Running on `localhost:27017` or configured via `MONGODB_URL` env variable)

## Setup and run

From the project root:

```bash
cd backend
python -m venv .venv
```

Windows (PowerShell):

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

macOS / Linux:

```bash
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). The API is served at `/api` and the frontend is served from the same origin.

API docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

MongoDB Database: `ems_db` (created and seeded automatically on startup).

## Demo accounts

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `Admin@123` |
| Organizer | `organizer` | `Organizer@123` |
| Attendee | `attendee` | `Attendee@123` |

## Tests

```bash
cd backend
pytest -q
```

## Project structure

- `frontend/` — HTML, CSS, and JavaScript UI
- `backend/app/` — FastAPI application, models, and API routes
- `srs.md` — software requirements
