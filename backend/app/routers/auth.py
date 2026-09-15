import re
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database

from ..database import get_db, get_next_sequence
from ..deps import get_current_user
from ..models import User, utc_now
from ..schemas import LoginRequest, TokenOut, UserCreate, UserOut
from ..security import create_access_token, generate_salt, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Database = Depends(get_db)):
    username = payload.username.strip().lower()
    email = str(payload.email).strip().lower()
    if db.users.find_one({"username": {"$regex": f"^{re.escape(username)}$", "$options": "i"}}):
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.users.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}):
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


@router.post("/login", response_model=TokenOut)
def login(payload: LoginRequest, db: Database = Depends(get_db)):
    identifier = payload.username.strip().lower()
    regex = f"^{re.escape(identifier)}$"
    doc = db.users.find_one({
        "$or": [
            {"username": {"$regex": regex, "$options": "i"}},
            {"email": {"$regex": regex, "$options": "i"}},
        ]
    })
    login_id = get_next_sequence(db, "login_attempts")
    if not doc or not verify_password(payload.password, doc.get("salt", ""), doc.get("password_hash", "")):
        db.login_attempts.insert_one({
            "_id": login_id,
            "id": login_id,
            "username": identifier,
            "success": "failed",
            "created_at": utc_now(),
        })
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    db.login_attempts.insert_one({
        "_id": login_id,
        "id": login_id,
        "username": doc.get("username", identifier),
        "success": "success",
        "created_at": utc_now(),
    })
    token = create_access_token(doc["username"], doc["role"])
    return TokenOut(access_token=token, user=UserOut.model_validate(User(doc)))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
