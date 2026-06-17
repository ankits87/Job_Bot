"""
Celery task: apply to a LinkedIn job via Playwright Easy Apply.
Runs async code via asyncio.run() since Celery tasks are sync.
"""
import asyncio
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.workers.celery_app import celery_app
from app.database import SessionLocal
from app.models.application import Application
from app.models.resume import OptimizedResume, Resume
from app.models.user import User, UserProfile
from app.services.linkedin_browser import LinkedInBrowser


async def _do_apply(application_id: int):
    async with SessionLocal() as db:
        result = await db.execute(
            select(Application)
            .where(Application.id == application_id)
            .options(selectinload(Application.job), selectinload(Application.optimized_resume))
        )
        app = result.scalar_one_or_none()
        if not app:
            return

        app.status = "applying"
        await db.commit()

        # Get user profile for phone etc.
        user_result = await db.execute(select(User).where(User.id == app.user_id))
        user = user_result.scalar_one_or_none()

        profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == app.user_id))
        profile = profile_result.scalar_one_or_none()

        # Determine which resume PDF to use
        resume_path = None
        if app.optimized_resume and app.optimized_resume.pdf_path:
            resume_path = app.optimized_resume.pdf_path
        else:
            # Fall back to original uploaded resume
            res_result = await db.execute(
                select(Resume).where(Resume.user_id == app.user_id).order_by(Resume.id.desc())
            )
            original = res_result.scalars().first()
            if original:
                resume_path = original.file_path

        if not resume_path:
            app.status = "failed"
            app.error_message = "No resume file found"
            await db.commit()
            return

        # Skip automation for non-Easy Apply jobs — mark immediately
        if not app.job.is_easy_apply:
            app.status = "manual_required"
            app.error_message = "This job does not support Easy Apply. Use the link to apply on the company website."
            await db.commit()
            return

        profile_dict = {
            "phone": getattr(profile, "phone", ""),
        }

        async with LinkedInBrowser() as browser:
            outcome = await browser.apply_to_job(app.job.url, resume_path, profile_dict)

        app.status = outcome["status"]
        app.error_message = outcome.get("error")
        if outcome["status"] == "applied":
            app.applied_at = datetime.utcnow()
        await db.commit()


@celery_app.task(name="apply_worker.run_apply_task", bind=True, max_retries=1)
def run_apply_task(self, application_id: int):
    try:
        asyncio.run(_do_apply(application_id))
    except Exception as exc:
        # Mark as failed in DB so UI doesn't stay stuck on "pending"
        async def mark_failed():
            async with SessionLocal() as db:
                result = await db.execute(select(Application).where(Application.id == application_id))
                app = result.scalar_one_or_none()
                if app:
                    app.status = "failed"
                    app.error_message = str(exc)[:200]
                    await db.commit()
        try:
            asyncio.run(mark_failed())
        except Exception:
            pass
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=30)
