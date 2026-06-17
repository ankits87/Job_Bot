# re-export Base for Alembic env.py
from app.database import Base
from app.models import *  # noqa: F401,F403 — ensure all models are registered
