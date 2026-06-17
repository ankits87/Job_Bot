from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.app_config import AppConfig
from app.services.crypto import encrypt, decrypt


async def get_config(db: AsyncSession) -> AppConfig | None:
    result = await db.execute(select(AppConfig).where(AppConfig.id == 1))
    return result.scalar_one_or_none()


async def get_linkedin_credentials(db: AsyncSession) -> dict | None:
    """Returns decrypted credentials or None if setup hasn't been completed."""
    config = await get_config(db)
    if not config or not config.setup_complete:
        return None
    return {
        "client_id": config.linkedin_client_id,
        "client_secret": decrypt(config.linkedin_client_secret_enc),
        "redirect_uri": config.linkedin_redirect_uri,
    }


async def save_config(
    db: AsyncSession,
    client_id: str,
    client_secret: str,
    redirect_uri: str,
) -> AppConfig:
    config = await get_config(db)
    if not config:
        config = AppConfig(id=1)
        db.add(config)

    config.linkedin_client_id = client_id or None
    config.linkedin_client_secret_enc = encrypt(client_secret) if client_secret else None
    config.linkedin_redirect_uri = redirect_uri
    config.setup_complete = True

    await db.commit()
    await db.refresh(config)
    return config
