import re
import json
from app.services.llm_service import complete, LLMTask
from app.services.match_scorer import score_match


# ── Section headers that signal company/culture content to drop ───────────────

_NOISE_SECTIONS = re.compile(
    r"^\s*(about\s+(us|the\s+company|our\s+team|bluevine|snapmint|\w+)|"
    r"who\s+we\s+are|our\s+(culture|values|mission|story|vision|team|office)|"
    r"why\s+(join|work\s+(at|with|for))\s*\w*|"
    r"what\s+we\s+offer|perks\s+(&|and)\s+benefits?|benefits?|"
    r"compensation|salary\s+range|"
    r"awards?|recognition|accolades?|"
    r"equal\s+opportunity|diversity|inclusion|eeo|"
    r"our\s+investors?|backed\s+by|funded\s+by|"
    r"note\s*:|disclaimer|"
    r"apply\s+now|how\s+to\s+apply)\s*:?\s*$",
    re.IGNORECASE | re.MULTILINE,
)

_ROLE_SECTIONS = re.compile(
    r"^\s*(responsibilities|what\s+you.ll\s+do|role\s+overview|"
    r"job\s+(description|summary|overview)|"
    r"key\s+(responsibilities|duties|accountabilities)|"
    r"requirements?|qualifications?|"
    r"what\s+(we.re\s+looking\s+for|you.ll\s+bring|you\s+bring|you\s+need)|"
    r"must\s+have|nice\s+to\s+have|preferred|"
    r"skills?(\s+required)?|technical\s+skills?|"
    r"experience(\s+required)?|education|"
    r"minimum\s+qualifications?|basic\s+qualifications?)\s*:?\s*$",
    re.IGNORECASE | re.MULTILINE,
)


def _extract_role_content(jd_text: str) -> str:
    """
    Keep only sections that describe the role, requirements, and qualifications.
    Drops company intro, culture, benefits, awards, etc.

    Strategy:
    1. Split into sections on blank lines or known headers.
    2. Include a section if it starts with a known role header OR
       comes before the first noise section.
    3. Cap at 800 chars to control token usage.
    """
    if not jd_text:
        return ""

    lines = jd_text.splitlines()
    kept: list[str] = []
    current_block: list[str] = []
    in_noise = False
    found_first_role_header = False

    for line in lines:
        stripped = line.strip()

        if _NOISE_SECTIONS.match(stripped):
            # Flush current block if it was role content
            if not in_noise and current_block:
                kept.extend(current_block)
            current_block = []
            in_noise = True
            continue

        if _ROLE_SECTIONS.match(stripped):
            in_noise = False
            found_first_role_header = True
            current_block.append(line)
            continue

        if in_noise:
            # Skip noise section lines
            continue

        current_block.append(line)

        # If no explicit role header found yet, keep content until first noise section
        if not found_first_role_header:
            kept.extend(current_block)
            current_block = []

    # Flush remaining role block
    if not in_noise:
        kept.extend(current_block)

    cleaned = "\n".join(kept).strip()

    # If cleaning removed everything (badly structured JD), fall back to raw text
    if len(cleaned) < 100:
        cleaned = jd_text

    return cleaned[:800]


def _tfidf_scores(jobs: list[dict], profile: dict) -> list[float]:
    skills_text = " ".join(profile.get("skills", []) + profile.get("target_roles", []))
    return [
        score_match(skills_text, _extract_role_content(job.get("jd_text", "")) or job.get("title", ""))
        for job in jobs
    ]


async def rank_jobs(jobs: list[dict], profile: dict) -> list[dict]:
    """Score all jobs in a single LLM call. Falls back to TF-IDF on rate limit."""
    if not jobs:
        return []

    jobs_block = "\n".join(
        f"{i+1}. {job['title']} at {job['company']}\n{_extract_role_content(job.get('jd_text', ''))}"
        for i, job in enumerate(jobs)
    )

    prompt = f"""Score each job's relevance to this candidate. Return ONLY a JSON array of floats (0.0-1.0), one per job, in the same order.

Candidate:
- Target roles: {', '.join(profile.get('target_roles', []))}
- Skills: {', '.join(profile.get('skills', []))}
- Experience: {profile.get('experience_years', 0)} years
- Interests: {', '.join(profile.get('interests', []))}

Score based ONLY on: role responsibilities, required skills, qualifications, and years of experience.
Ignore company descriptions, culture, benefits, or awards.

Jobs:
{jobs_block}

Return ONLY a JSON array like [0.85, 0.60, ...]. No explanation."""

    try:
        raw = await complete(prompt, task=LLMTask.FAST)
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        scores = json.loads(cleaned)
        if not isinstance(scores, list) or len(scores) != len(jobs):
            raise ValueError("Bad response shape")
        scores = [round(float(s), 4) for s in scores]
    except Exception:
        scores = _tfidf_scores(jobs, profile)

    for job, score in zip(jobs, scores):
        job["relevance_score"] = score

    return sorted(jobs, key=lambda j: j["relevance_score"], reverse=True)
