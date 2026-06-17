import os
import uuid
import asyncio
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User, UserProfile
from app.models.resume import Resume, OptimizedResume
from app.models.job import Job
from app.models.application import Application
from app.services.auth_deps import get_current_user
from app.services.resume_parser import parse_resume
from app.services.ats_optimizer import optimize_resume_for_job
from app.services.docx_generator import generate_optimized_docx
from app.services.pdf_generator import generate_optimized_pdf

router = APIRouter(prefix="/resume", tags=["resume"])
UPLOAD_DIR = Path("uploads/resumes")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.get("/me")
async def get_my_resume(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Resume).where(Resume.user_id == user.id).order_by(Resume.id.desc())
    )
    resume = result.scalars().first()
    if not resume:
        return None
    parsed = resume.parsed_json or {}
    return {
        "resume_id": resume.id,
        "file_type": resume.file_type,
        "name": parsed.get("name", ""),
        "email": parsed.get("email", ""),
        "skills": parsed.get("skills", []),
        "experience": parsed.get("experience", []),
        "education": parsed.get("education", []),
    }


@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ext = Path(file.filename or "").suffix.lower().lstrip(".")
    if ext not in ("pdf", "docx"):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 10 MB limit")

    filename = f"{uuid.uuid4()}.{ext}"
    file_path = UPLOAD_DIR / filename
    file_path.write_bytes(file_bytes)

    result = await parse_resume(file_bytes, ext)
    parsed = result["parsed"]
    raw_text = result["raw_text"]

    resume = Resume(
        user_id=user.id,
        original_text=raw_text,
        parsed_json=parsed,
        file_path=str(file_path),
        file_type=ext,
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)

    return {**parsed, "resume_id": resume.id}


class OptimizeBatchIn(BaseModel):
    job_ids: list[int]


@router.post("/optimize-batch")
async def optimize_batch(
    body: OptimizeBatchIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Get latest resume
    result = await db.execute(
        select(Resume).where(Resume.user_id == user.id).order_by(Resume.id.desc())
    )
    resume = result.scalars().first()
    if not resume:
        raise HTTPException(status_code=404, detail="No resume found. Please upload one first.")

    # Get jobs
    result = await db.execute(select(Job).where(Job.id.in_(body.job_ids)))
    jobs = result.scalars().all()

    async def process_job(job: Job):
        opt = await optimize_resume_for_job(resume.original_text, job.jd_text)

        # Upsert application row
        app_result = await db.execute(
            select(Application).where(Application.user_id == user.id, Application.job_id == job.id)
        )
        app = app_result.scalar_one_or_none()
        if not app:
            app = Application(
                user_id=user.id,
                job_id=job.id,
                ats_score_before=opt["ats_score_before"],
                ats_score_after=opt["ats_score_after"],
            )
            db.add(app)
            await db.flush()

            opt_resume = OptimizedResume(
                application_id=app.id,
                resume_id=resume.id,
                rewritten_text=opt["rewritten_text"],
                keywords_injected=opt["keywords"],
            )
            db.add(opt_resume)
        else:
            app.ats_score_before = opt["ats_score_before"]
            app.ats_score_after  = opt["ats_score_after"]
            # Reset failed/manual_required so the job can be re-applied
            if app.status == "failed":
                app.status        = "pending"
                app.error_message = None
                app.applied_at    = None

        return {
            "id": job.id,
            "title": job.title,
            "company": job.company,
            "location": job.location,
            "jd_text": job.jd_text,
            "url": job.url,
            "is_easy_apply": job.is_easy_apply,
            "relevance_score": job.relevance_score or 0,
            "ats_score_before": opt["ats_score_before"],
            "ats_score_after": opt["ats_score_after"],
            "keywords": opt["keywords"],
            "optimized_resume_preview": opt["rewritten_text"][:800],
        }

    results = await asyncio.gather(*[process_job(j) for j in jobs])
    await db.commit()
    return list(results)


@router.get("/download/{job_id}")
async def download_optimized_resume(
    job_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Get the application for this user + job
    app_result = await db.execute(
        select(Application).where(Application.user_id == user.id, Application.job_id == job_id)
    )
    app = app_result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="No application found for this job")

    # Get optimized resume linked to application
    opt_result = await db.execute(
        select(OptimizedResume).where(OptimizedResume.application_id == app.id)
    )
    opt = opt_result.scalar_one_or_none()
    if not opt:
        raise HTTPException(status_code=404, detail="No optimized resume found — run optimization first")

    # Get original resume for diff
    orig_result = await db.execute(
        select(Resume).where(Resume.id == opt.resume_id)
    )
    original_resume = orig_result.scalar_one_or_none()
    original_text = original_resume.original_text if original_resume else ""

    # Get job title for filename
    job_result = await db.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()
    job_title = job.title.replace(" ", "_") if job else "job"

    parsed_json = (original_resume.parsed_json or {}) if original_resume else {}
    docx_bytes = generate_optimized_docx(original_text, opt.rewritten_text, parsed_json)
    filename = f"resume_{job_title}.docx"

    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/download-pdf/{job_id}")
async def download_optimized_resume_pdf(
    job_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    app_result = await db.execute(
        select(Application).where(Application.user_id == user.id, Application.job_id == job_id)
    )
    app = app_result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="No application found for this job")

    opt_result = await db.execute(
        select(OptimizedResume).where(OptimizedResume.application_id == app.id)
    )
    opt = opt_result.scalar_one_or_none()
    if not opt:
        raise HTTPException(status_code=404, detail="No optimized resume found — run optimization first")

    orig_result = await db.execute(select(Resume).where(Resume.id == opt.resume_id))
    original_resume = orig_result.scalar_one_or_none()
    parsed_json = (original_resume.parsed_json or {}) if original_resume else {}

    job_result = await db.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()
    job_title = job.title.replace(" ", "_") if job else "job"

    pdf_bytes = generate_optimized_pdf(opt.rewritten_text, parsed_json)
    filename  = f"resume_{job_title}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
