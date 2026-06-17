from datetime import datetime, timedelta
from jose import jwt
from app.config import get_settings

settings = get_settings()
ALGORITHM = "HS256"
EXPIRE_DAYS = 30


def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(days=EXPIRE_DAYS)
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
