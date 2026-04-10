import os
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import Header, HTTPException

# JWT configuration
JWT_SECRET = os.getenv("PM_JWT_SECRET", "dev-secret-change-in-production!!")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: int, username: str) -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": datetime.now(UTC) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        decoded["sub"] = int(decoded["sub"])
        return decoded
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_auth(authorization: str = Header(...)) -> dict:
    """FastAPI dependency that extracts and validates JWT from Authorization header."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization[7:]
    return decode_token(token)
