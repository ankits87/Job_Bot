import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.application import Application
from app.services.auth_deps import get_current_user
from app.workers.apply_worker import _do_apply

router = APIRouter(prefix="/applications", tags=["applications"])


class ApplyIn(BaseModel):
    job_ids: list[int]


@router.get("")
async def list_applications(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Application)
        .where(Application.user_id == user.id)
        .options(selectinload(Application.job))
        .order_by(Application.id.desc())
    )
    apps = result.scalars().all()
    return [
        {
            "id": a.id,
            "job": {
                "title": a.job.title,
                "company": a.job.company,
                "location": a.job.location,
                "url": a.job.url,
                "is_easy_apply": a.job.is_easy_apply,
            },
            "status": a.status,
            "ats_score_before": a.ats_score_before or 0,
            "ats_score_after": a.ats_score_after or 0,
            "applied_at": a.applied_at.isoformat() if a.applied_at else None,
            "error_message": a.error_message,
        }
        for a in apps
    ]


@router.post("/apply")
async def apply_jobs(
    body: ApplyIn,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Application).where(
            Application.user_id == user.id,
            Application.job_id.in_(body.job_ids),
        )
    )
    apps = result.scalars().all()

    for app in apps:
        app.status = "pending"
    await db.commit()

    # Run apply tasks as FastAPI background tasks (no Celery/Redis needed)
    for app in apps:
        background_tasks.add_task(_do_apply, app.id)

    return {"queued": len(apps)}


@router.post("/{application_id}/mark-applied")
async def mark_applied(
    application_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Application).where(Application.id == application_id, Application.user_id == user.id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    app.status     = "applied"
    app.applied_at = datetime.utcnow()
    app.error_message = None
    await db.commit()
    return {"status": "applied"}
