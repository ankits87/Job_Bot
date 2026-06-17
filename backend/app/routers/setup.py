from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.app_config_service import get_config, save_config

router = APIRouter(prefix="/setup", tags=["setup"])


class SetupIn(BaseModel):
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""
    redirect_uri: str = "http://localhost:8001/auth/linkedin/callback"


@router.get("/status", response_model=None)
async def setup_status(db: AsyncSession = Depends(get_db)):
    config = await get_config(db)
    # Auto-complete setup on first check so the app is usable without LinkedIn OAuth
    if not config or not config.setup_complete:
        config = await save_config(db, "", "", "http://localhost:8001/auth/linkedin/callback")
    return {
        "setup_complete": True,
        "has_linkedin_oauth": bool(config.linkedin_client_id),
        "redirect_uri": config.linkedin_redirect_uri,
    }


@router.post("/", response_model=None)
async def complete_setup(body: SetupIn, db: AsyncSession = Depends(get_db)):
    await save_config(db, body.linkedin_client_id.strip(), body.linkedin_client_secret.strip(), body.redirect_uri)
    return {"status": "configured"}
