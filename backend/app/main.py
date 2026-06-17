from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import auth, onboarding, resume, jobs, applications, network, setup

settings = get_settings()

app = FastAPI(title="LinkedIn Job Automator", version="0.1.0")

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
