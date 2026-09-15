import re
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import DESCENDING
from pymongo.database import Database

from ..database import get_db, get_next_sequence
from ..deps import require_roles
from ..models import User, utc_now
from ..schemas import AdminUserCreate, UserOut, UserUpdate
from ..security import generate_salt, hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    q: str | None = Query(default=None),
    db: Database = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    filter_query = {}
    if q:
        regex = f".*{re.escape(q.strip())}.*"
        filter_query = {
            "$or": [
                {"full_name": {"$regex": regex, "$options": "i"}},
                {"username": {"$regex": regex, "$options": "i"}},
                {"email": {"$regex": regex, "$options": "i"}},
                {"role": {"$regex": regex, "$options": "i"}},
            ]
        }
    cursor = db.users.find(filter_query).sort("created_at", DESCENDING)
    return [UserOut.model_validate(User(doc)) for doc in cursor]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: AdminUserCreate,
    db: Database = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    username = payload.username.strip().lower()
    email = str(payload.email).strip().lower()
    if db.users.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    salt = generate_salt()
    user_id = get_next_sequence(db, "users")
    doc = {
        "_id": user_id,
        "id": user_id,
        "full_name": payload.full_name.strip(),
        "username": username,
        "email": email,
        "salt": salt,
        "password_hash": hash_password(payload.password, salt),
        "role": payload.role,
        "created_at": utc_now(),
    }
    db.users.insert_one(doc)
    return UserOut.model_validate(User(doc))


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Database = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    user_doc = db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    updates = {}
    if payload.email:
        new_email = str(payload.email).lower()
        if db.users.find_one({"email": new_email, "id": {"$ne": user_id}}):
            raise HTTPException(status_code=400, detail="Email already exists")
        updates["email"] = new_email
    if payload.full_name:
        updates["full_name"] = payload.full_name.strip()
    if payload.role:
        if user_id == current_user.id and payload.role != "admin":
            raise HTTPException(status_code=400, detail="You cannot remove your own admin role")
        updates["role"] = payload.role
    if payload.password:
        salt = generate_salt()
        updates["salt"] = salt
        updates["password_hash"] = hash_password(payload.password, salt)

    if updates:
        db.users.update_one({"id": user_id}, {"$set": updates})
        user_doc = db.users.find_one({"id": user_id})

    return UserOut.model_validate(User(user_doc))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Database = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    user_doc = db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    db.registrations.delete_many({"user_id": user_id})
    organized_events = list(db.events.find({"organizer_id": user_id}))
    for ev in organized_events:
        db.registrations.delete_many({"event_id": ev["id"]})
        db.events.delete_one({"id": ev["id"]})
    db.users.delete_one({"id": user_id})
