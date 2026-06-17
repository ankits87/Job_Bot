import asyncio
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context
from app.config import get_settings
from app.models.base_imports import Base  # registers all models

settings = get_settings()
db_url = settings.database_url

config = context.config
config.set_main_option("sqlalchemy.url", db_url)

if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline():
    context.configure(url=db_url, target_metadata=target_metadata, literal_binds=True, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online_async():
    engine = create_async_engine(db_url)
    async with engine.begin() as conn:
        await conn.run_sync(do_run_migrations)
    await engine.dispose()


def run_migrations_online():
    if db_url.startswith("sqlite"):
        # Use sync engine for SQLite (aiosqlite doesn't support run_sync well in Alembic)
        sync_url = db_url.replace("sqlite+aiosqlite", "sqlite")
        from sqlalchemy import create_engine
        engine = create_engine(sync_url, connect_args={"check_same_thread": False})
        with engine.connect() as conn:
            do_run_migrations(conn)
    else:
        asyncio.run(run_migrations_online_async())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
