from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import UserProfile
from app.services.auth_deps import get_current_user
from app.services.skill_suggester import suggest_skills
from app.models.user import User

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class ProfileIn(BaseModel):
    skills: list[str] = []
    interests: list[str] = []
    target_roles: list[str] = []
    experience_years: int = 0
    preferred_locations: list[str] = []


class SkillSuggestIn(BaseModel):
    skills: list[str]
    target_roles: list[str]
    experience_years: int = 0


@router.get("/profile")
async def get_profile(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        return None
    return {
        "skills": profile.skills or [],
        "interests": profile.interests or [],
        "target_roles": profile.target_roles or [],
        "experience_years": profile.experience_years or 0,
        "preferred_locations": profile.preferred_locations or [],
    }


@router.post("/profile")
async def save_profile(body: ProfileIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalar_one_or_none()

    if profile:
        profile.skills = body.skills
        profile.interests = body.interests
        profile.target_roles = body.target_roles
        profile.experience_years = body.experience_years
        profile.preferred_locations = body.preferred_locations
    else:
        profile = UserProfile(
            user_id=user.id,
            skills=body.skills,
            interests=body.interests,
            target_roles=body.target_roles,
            experience_years=body.experience_years,
            preferred_locations=body.preferred_locations,
        )
        db.add(profile)

    await db.commit()
    return {"status": "saved"}


@router.post("/suggest-skills")
async def suggest(body: SkillSuggestIn, user: User = Depends(get_current_user)):
    suggestions = await suggest_skills(body.skills, body.target_roles, body.experience_years)
    return {"suggestions": suggestions}
