import json
from app.services.llm_service import complete, LLMTask
from app.services.match_scorer import score_match

EXTRACT_SYSTEM = "You are an ATS keyword extraction expert."
REWRITE_SYSTEM = "You are an ATS resume optimization expert. You rewrite resumes to pass ATS filters while keeping all facts truthful and professional."


async def extract_keywords(jd_text: str) -> list[str]:
    prompt = f"""Extract the most important ATS keywords from this job description.
Include: technical skills, tools, frameworks, domain terms, action verbs, certifications.

Job Description:
---
{jd_text[:3000]}
---

Return ONLY a JSON array of keyword strings (max 25). No explanation.
Example: ["Python", "REST APIs", "Agile", "CI/CD", "led", "designed"]"""

    raw = await complete(prompt, EXTRACT_SYSTEM, LLMTask.FAST)
    try:
        start = raw.index("[")
        end = raw.rindex("]") + 1
        return json.loads(raw[start:end])
    except (ValueError, json.JSONDecodeError):
        return []


async def rewrite_resume(resume_text: str, jd_text: str, keywords: list[str]) -> str:
    prompt = f"""Rewrite this resume to maximize ATS match for the job description below.

Rules:
- Inject these keywords naturally where relevant: {', '.join(keywords)}
- Preserve ALL factual information — do not invent experience or skills
- Strengthen action verbs and quantify achievements where possible
- Keep the same overall structure (summary, experience, education, skills)
- Do not add fake companies, roles, or dates

Job Description:
---
{jd_text[:2000]}
---

Original Resume:
---
{resume_text[:4000]}
---

Return the full rewritten resume text only. No commentary, no markdown headers."""

    return await complete(prompt, REWRITE_SYSTEM, LLMTask.WRITING)


async def optimize_resume_for_job(resume_text: str, jd_text: str) -> dict:
    score_before = score_match(resume_text, jd_text)
    keywords = await extract_keywords(jd_text)
    rewritten = await rewrite_resume(resume_text, jd_text, keywords)
    score_after = score_match(rewritten, jd_text)

    return {
        "rewritten_text": rewritten,
        "keywords": keywords,
        "ats_score_before": score_before,
        "ats_score_after": score_after,
    }
