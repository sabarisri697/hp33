import os
from pymongo import MongoClient
from pymongo.database import Database

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DB_NAME", "ems_db")

_client = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        if MONGODB_URL.startswith("mongomock://"):
            import mongomock
            _client = mongomock.MongoClient()
        else:
            try:
                client = MongoClient(MONGODB_URL, serverSelectionTimeoutMS=1500)
                client.admin.command("ping")
                _client = client
            except Exception:
                try:
                    import mongomock
                    print("Live MongoDB service unreachable on host, falling back to mock MongoDB engine.")
                    _client = mongomock.MongoClient()
                except ImportError:
                    _client = MongoClient(MONGODB_URL)
    return _client


def get_db() -> Database:
    client = get_client()
    return client[DB_NAME]


def get_next_sequence(db: Database, name: str) -> int:
    ret = db.counters.find_one_and_update(
        {"_id": name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    if isinstance(ret, dict):
        return ret.get("seq", 1)
    return ret.seq if hasattr(ret, "seq") else 1


def init_db(db: Database = None) -> None:
    if db is None:
        db = get_db()
    try:
        db.users.create_index("username", unique=True)
        db.users.create_index("email", unique=True)
        db.registrations.create_index("confirmation_code", unique=True)
        db.registrations.create_index([("event_id", 1), ("user_id", 1)], unique=True)
    except Exception as e:
        print(f"MongoDB index notice: {e}")
