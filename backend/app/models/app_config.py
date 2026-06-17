from sqlalchemy import String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class AppConfig(Base):
    """Singleton row (id=1) holding app-level configuration set via the setup wizard."""
    __tablename__ = "app_config"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    linkedin_client_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    linkedin_client_secret_enc: Mapped[str | None] = mapped_column(Text, nullable=True)  # Fernet-encrypted
    linkedin_redirect_uri: Mapped[str] = mapped_column(Text, default="http://localhost:8000/auth/linkedin/callback")
    setup_complete: Mapped[bool] = mapped_column(Boolean, default=False)
