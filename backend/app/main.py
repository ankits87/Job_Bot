from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import auth, onboarding, resume, jobs, applications, network, setup
from alembic.config import Config
from alembic import command

settings = get_settings()

app = FastAPI(title="LinkedIn Job Automator", version="0.1.0")


@app.on_event("startup")
async def run_migrations():
    try:
        alembic_cfg = Config("/app/alembic.ini")
        alembic_cfg.set_main_option("script_location", "/app/alembic")
        command.upgrade(alembic_cfg, "head")
    except Exception as e:
        print(f"Migration warning: {e}")

allowed_origins = [
    settings.frontend_url,
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(setup.router)
app.include_router(auth.router)
app.include_router(onboarding.router)
app.include_router(resume.router)
app.include_router(jobs.router)
app.include_router(applications.router)
app.include_router(network.router)


@app.get("/health")
async def health():
    return {"status": "ok", "frontend_url": settings.frontend_url, "environment": settings.environment}
