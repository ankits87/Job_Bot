from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from sqlalchemy import func
from app.database import get_db
from app.models.user import User, UserProfile
from app.models.job import Job
from app.models.application import Application
from app.services.auth_deps import get_current_user
from app.models.resume import Resume
from app.services.job_scraper import scrape_jobs, expand_interests
from app.services.job_ranker import rank_jobs
from app.services.token_service import decode_access_token
from app.services.llm_service import complete, LLMTask

router = APIRouter(prefix="/jobs", tags=["jobs"])
_bearer = HTTPBearer(auto_error=False)


async def _optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    if not credentials:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        result = await db.execute(select(User).where(User.id == int(payload["sub"])))
        return result.scalar_one_or_none()
    except Exception:
        return None


@router.get("")
async def list_jobs(db: AsyncSession = Depends(get_db), user: Optional[User] = Depends(_optional_user)):
    # Collect job IDs the user has already applied to (any non-failed status)
    applied_job_ids: set[int] = set()
    if user:
        applied_result = await db.execute(
            select(Application.job_id).where(
                Application.user_id == user.id,
                Application.status.notin_(["failed"]),
            )
        )
        applied_job_ids = {row[0] for row in applied_result.all()}

    result = await db.execute(select(Job).order_by(Job.relevance_score.desc().nullslast(), Job.scraped_at.desc()))
    jobs = result.scalars().all()
    return [
        {
            "id": j.id,
            "title": j.title,
            "company": j.company,
            "location": j.location,
            "jd_text": j.jd_text or "",
            "url": j.url,
            "is_easy_apply": j.is_easy_apply,
            "relevance_score": j.relevance_score,
            "scraped_at": j.scraped_at.isoformat() if j.scraped_at else None,
            "posted_at": (j.extra or {}).get("posted_at"),
        }
        for j in jobs
        if j.id not in applied_job_ids
    ]


@router.post("/scan")
async def scan_jobs(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db), start: int = 0, quick: bool = False):
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=400, detail="Complete your profile before scanning jobs")

    profile_dict = {
        "skills": profile.skills or [],
        "interests": profile.interests or [],
        "target_roles": profile.target_roles or [],
        "experience_years": profile.experience_years or 0,
        "preferred_locations": profile.preferred_locations or [],
    }

    target_roles = profile.target_roles or []
    expanded_interests = expand_interests(profile.interests or [])
    if not target_roles:
        raise HTTPException(status_code=400, detail="Add target roles to your profile first")

    # If start not provided, auto-calculate from jobs already in DB
    if start == 0:
        count_result = await db.execute(select(func.count()).select_from(Job))
        existing_count = count_result.scalar() or 0
        if existing_count >= 10:
            start = existing_count

    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Scanning with start={start}, roles={target_roles}, interests={expanded_interests[:3]}, locations={profile.preferred_locations}")

    try:
        raw_jobs = await scrape_jobs(
            target_roles=target_roles,
            interests=expanded_interests,
            locations=profile.preferred_locations or [],
            max_jobs=10,
            start=start,
            easy_apply=True,
            max_queries=2 if quick else 6,
        )
        logger.info(f"Scraper returned {len(raw_jobs)} jobs")
        ranked = await rank_jobs(raw_jobs, profile_dict)
    except Exception as e:
        logger.error(f"Scan failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")

    saved = []
    for j in ranked:
        result = await db.execute(select(Job).where(Job.url == j["url"]))
        existing = result.scalar_one_or_none()
        if existing:
            existing.is_easy_apply = j.get("is_easy_apply", False)
            existing.relevance_score = j.get("relevance_score") or existing.relevance_score
            continue
        job = Job(
            title=j["title"],
            company=j["company"],
            location=j["location"],
            jd_text=j["jd_text"],
            url=j["url"],
            is_easy_apply=j.get("is_easy_apply", False),
            relevance_score=j.get("relevance_score"),
            extra={"posted_at": j.get("posted_at")} if j.get("posted_at") else {},
        )
        db.add(job)
        saved.append(job)

    await db.commit()
    return {"scanned": len(raw_jobs), "saved": len(saved)}


@router.get("/{job_id}/match-analysis")
async def match_analysis(
    job_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job_result = await db.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    resume_result = await db.execute(
        select(Resume).where(Resume.user_id == user.id).order_by(Resume.id.desc())
    )
    resume = resume_result.scalars().first()
    if not resume:
        raise HTTPException(status_code=404, detail="No resume found")

    prompt = f"""Compare this job description against the candidate's resume.

Job Description:
{job.jd_text[:3000]}

Resume:
{resume.original_text[:3000]}

Return a JSON object with exactly two arrays:
- "matched": list of specific skills, tools, or requirements from the JD that ARE present in the resume (max 10 items)
- "missing": list of specific skills, tools, or requirements from the JD that are NOT in the resume (max 10 items)

Each item should be a short phrase (2-5 words max). Be specific — name actual technologies, skills, or qualifications.
Return ONLY valid JSON, no explanation."""

    import json
    raw = await complete(prompt, task=LLMTask.FAST)
    try:
        # Strip markdown code fences if present
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(cleaned)
        return {
            "matched": data.get("matched", [])[:10],
            "missing": data.get("missing", [])[:10],
        }
    except Exception:
        return {"matched": [], "missing": []}
