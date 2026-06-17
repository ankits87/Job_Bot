import json
from app.services.llm_service import complete, LLMTask

SYSTEM = "You are a tech career advisor with deep knowledge of job market trends."


async def suggest_skills(skills: list[str], target_roles: list[str], experience_years: int) -> list[str]:
    prompt = f"""A candidate is targeting these roles: {', '.join(target_roles)}.
They have {experience_years} years of experience and already know: {', '.join(skills)}.

Suggest 8-12 additional skills that would significantly strengthen their applications for these roles.
Focus on skills that are in high demand, complement what they already know, and are realistic to add to a profile.

Return ONLY a JSON array of skill name strings. No explanation, no markdown.
Example: ["Docker", "Kubernetes", "Terraform"]"""

    raw = await complete(prompt, SYSTEM, LLMTask.FAST)
    try:
        start = raw.index("[")
        end = raw.rindex("]") + 1
        suggestions = json.loads(raw[start:end])
        # Filter out skills the user already has (case-insensitive)
        existing_lower = {s.lower() for s in skills}
        return [s for s in suggestions if s.lower() not in existing_lower]
    except (ValueError, json.JSONDecodeError):
        return []
