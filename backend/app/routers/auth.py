from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
import bcrypt

from app.database import get_db
from app.models.user import User
from app.services.token_service import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


@router.post("/register")
async def register(body: RegisterIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    pw_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    user = User(name=body.name, email=body.email, password_hash=pw_hash)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {"token": token, "user": {"id": user.id, "name": user.name, "email": user.email}}


@router.post("/login")
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not bcrypt.checkpw(body.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {"token": token, "user": {"id": user.id, "name": user.name, "email": user.email}}


@router.get("/linkedin/session-status")
async def linkedin_session_status():
    import json
    from pathlib import Path
    cookies_path = Path("uploads/linkedin_cookies.json")
    has_session = False
    if cookies_path.exists():
        try:
            cookies = json.loads(cookies_path.read_text())
            has_session = any(c.get("name") == "li_at" for c in cookies)
        except Exception:
            has_session = False
    return {"has_session": has_session}


@router.post("/linkedin/browser-login")
async def linkedin_browser_login():
    """Open a visible Chromium window for the user to log into LinkedIn and capture session cookies."""
    import subprocess, sys, tempfile
    from pathlib import Path

    script = """
import time, json
from pathlib import Path
from playwright.sync_api import sync_playwright

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=False, args=["--start-maximized"])
    ctx = browser.new_context(viewport=None)
    page = ctx.new_page()
    page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded")
    print("Waiting for LinkedIn login... (up to 3 minutes)", flush=True)
    try:
        page.wait_for_url("**/feed/**", timeout=180000)
    except Exception:
        try:
            page.wait_for_url("**/jobs/**", timeout=10000)
        except Exception:
            pass
    cookies = ctx.cookies()
    Path("uploads").mkdir(exist_ok=True)
    Path("uploads/linkedin_cookies.json").write_text(json.dumps(cookies))
    print("Session saved.", flush=True)
    browser.close()
"""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
        f.write(script)
        script_path = f.name

    subprocess.Popen([sys.executable, script_path])
    return {"status": "browser_opened"}


@router.get("/linkedin/connected")
async def linkedin_connected():
    """Check whether a valid LinkedIn browser session exists (li_at cookie present)."""
    import json
    from pathlib import Path
    cookies_path = Path("uploads/linkedin_cookies.json")
    has_session = False
    if cookies_path.exists():
        try:
            cookies = json.loads(cookies_path.read_text())
            has_session = any(c.get("name") == "li_at" for c in cookies)
        except Exception:
            has_session = False
    return {"has_session": has_session}


@router.get("/me")
async def get_me(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user.id, "name": user.name, "email": user.email}
