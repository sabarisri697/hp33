from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import get_db, init_db
from .routers import auth, events, registrations, reports, users
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        db = get_db()
        init_db(db)
        seed_if_empty(db)
    except Exception as err:
        print(f"MongoDB startup initialization warning: {err}")
    yield


app = FastAPI(title="Campus Event Management System", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(registrations.router, prefix="/api")
app.include_router(reports.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}


FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
