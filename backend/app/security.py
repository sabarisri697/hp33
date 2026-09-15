import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

SECRET_KEY = "campus-ems-college-demo-secret-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480


def generate_salt() -> str:
    # 16 hex characters, matching the SRS minimum salt length
    return secrets.token_hex(8)


def hash_password(password: str, salt: str) -> str:
    payload = f"{salt}{password}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def verify_password(password: str, salt: str, stored_hash: str) -> bool:
    return hash_password(password, salt) == stored_hash


def create_access_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
