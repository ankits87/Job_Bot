from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User, UserProfile
from app.models.job import Job
from app.models.connection import Connection
from app.services.auth_deps import get_current_user
from app.services.network_mapper import find_referrals

router = APIRouter(prefix="/network", tags=["network"])


@router.get("/connections/{job_id}")
async def get_connections_for_job(
    job_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch LinkedIn connections at the company for a given job."""
    job_result = await db.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = profile_result.scalar_one_or_none()
    target_role = profile.target_roles[0] if profile and profile.target_roles else job.title

    try:
        people = await find_referrals(job.company, target_role)
    except ValueError as e:
        if "SESSION_EXPIRED" in str(e):
            raise HTTPException(status_code=403, detail="LinkedIn session expired — please save your session again")
        raise HTTPException(status_code=500, detail=str(e))

    for p in people:
        existing = await db.execute(
            select(Connection).where(Connection.user_id == user.id, Connection.linkedin_id == p["linkedin_id"])
        )
        if not existing.scalar_one_or_none():
            conn = Connection(
                user_id=user.id,
                linkedin_id=p["linkedin_id"],
                name=p["name"],
                title=p.get("title", ""),
                company=job.company,
                profile_url=p.get("profile_url", ""),
                degree=p["degree"],
            )
            db.add(conn)

    await db.commit()

    return {
        "company": job.company,
        "job_title": job.title,
        "connections": [
            {
                "name": p["name"],
                "title": p.get("title", ""),
                "profile_url": p.get("profile_url", ""),
                "degree": p["degree"],
                "outreach_message": p.get("outreach_message", ""),
            }
            for p in people
        ],
    }


@router.get("/referrals/{company}")
async def get_referrals(
    company: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = profile_result.scalar_one_or_none()
    target_role = profile.target_roles[0] if profile and profile.target_roles else "the open role"

    people = await find_referrals(company, target_role)

    # Persist discovered connections
    for p in people:
        existing = await db.execute(
            select(Connection).where(Connection.user_id == user.id, Connection.linkedin_id == p["linkedin_id"])
        )
        if not existing.scalar_one_or_none():
            conn = Connection(
                user_id=user.id,
                linkedin_id=p["linkedin_id"],
                name=p["name"],
                title=p.get("title", ""),
                company=company,
                profile_url=p.get("profile_url", ""),
                degree=p["degree"],
            )
            db.add(conn)

    await db.commit()

    return [
        {
            "id": idx,
            "name": p["name"],
            "title": p.get("title", ""),
            "company": company,
            "profile_url": p.get("profile_url", ""),
            "degree": p["degree"],
            "outreach_message": p.get("outreach_message", ""),
        }
        for idx, p in enumerate(people)
    ]
