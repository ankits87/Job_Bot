"""
Symmetric encryption for secrets stored in the DB (LinkedIn client secret, session cookies).
Key is derived from SECRET_KEY so the only thing in .env is a random string — no separate key to manage.
"""
import base64
import hashlib
from cryptography.fernet import Fernet
from app.config import get_settings


def _get_fernet() -> Fernet:
    key_bytes = hashlib.sha256(get_settings().secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key_bytes))


def encrypt(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    return _get_fernet().decrypt(ciphertext.encode()).decode()
