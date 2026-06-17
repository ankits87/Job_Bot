import json
import io
import pdfplumber
from docx import Document
from app.services.llm_service import complete, LLMTask

SYSTEM = "You are a resume parser. Extract structured data from resume text accurately."

SCHEMA = """{
  "name": "string",
  "email": "string",
  "phone": "string or null",
  "location": "string or null — current city/country from resume header",
  "skills": ["list of skill strings"],
  "experience": [{"title": "string", "company": "string", "duration": "string", "bullets": ["string"]}],
  "education": [{"degree": "string", "institution": "string", "year": "string or null"}],
  "summary": "string or null",
  "experience_years": "integer — total years of professional experience calculated from all roles",
  "target_roles": ["2-4 role titles that best describe this candidate based on their experience, e.g. Product Manager, Senior Software Engineer"],
  "interests": ["3-6 domain interests inferred from experience and skills, e.g. Fintech, AI/ML, SaaS, E-commerce"]
}"""


def extract_text_pdf(file_bytes: bytes) -> str:
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)


def extract_text_docx(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs)


async def parse_resume(file_bytes: bytes, file_type: str) -> dict:
    if file_type == "pdf":
        raw_text = extract_text_pdf(file_bytes)
    else:
        raw_text = extract_text_docx(file_bytes)

    prompt = f"""Parse this resume and return structured JSON matching this schema exactly:
{SCHEMA}

Resume text:
---
{raw_text[:6000]}
---

Return ONLY valid JSON. No markdown, no explanation."""

    response = await complete(prompt, SYSTEM, LLMTask.FAST)
    try:
        start = response.index("{")
        end = response.rindex("}") + 1
        return {"parsed": json.loads(response[start:end]), "raw_text": raw_text}
    except (ValueError, json.JSONDecodeError):
        return {"parsed": {}, "raw_text": raw_text}
