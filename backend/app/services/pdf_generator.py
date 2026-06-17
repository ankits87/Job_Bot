"""
Generates a clean ATS-friendly resume PDF using reportlab.
No highlights, no AI note — suitable for direct submission.
"""
import io
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, ListFlowable, ListItem
)
from reportlab.lib.colors import HexColor, black, Color


ACCENT   = HexColor("#1E40AB")
SUBTEXT  = HexColor("#4B5563")
BODY_CLR = HexColor("#111827")


# ── Style definitions ─────────────────────────────────────────────────────────

def _styles(body_pt: float):
    base_font = "Helvetica"
    bold_font = "Helvetica-Bold"

    name_style = ParagraphStyle(
        "Name",
        fontName=bold_font,
        fontSize=20,
        textColor=ACCENT,
        alignment=TA_CENTER,
        spaceAfter=4,
        leading=24,
    )
    contact_style = ParagraphStyle(
        "Contact",
        fontName=base_font,
        fontSize=9,
        textColor=SUBTEXT,
        alignment=TA_CENTER,
        spaceAfter=2,
        leading=12,
    )
    section_style = ParagraphStyle(
        "Section",
        fontName=bold_font,
        fontSize=9,
        textColor=ACCENT,
        spaceBefore=12,
        spaceAfter=3,
        leading=11,
    )
    role_style = ParagraphStyle(
        "Role",
        fontName=bold_font,
        fontSize=body_pt,
        textColor=BODY_CLR,
        spaceBefore=6,
        spaceAfter=1,
        leading=body_pt + 2,
    )
    role_detail_style = ParagraphStyle(
        "RoleDetail",
        fontName="Helvetica-Oblique",
        fontSize=body_pt - 0.5,
        textColor=SUBTEXT,
        spaceAfter=2,
        leading=body_pt + 1,
    )
    body_style = ParagraphStyle(
        "Body",
        fontName=base_font,
        fontSize=body_pt,
        textColor=BODY_CLR,
        spaceBefore=1,
        spaceAfter=3,
        leading=body_pt + 3,
    )
    bullet_style = ParagraphStyle(
        "Bullet",
        fontName=base_font,
        fontSize=body_pt,
        textColor=BODY_CLR,
        spaceBefore=1,
        spaceAfter=2,
        leading=body_pt + 3,
        leftIndent=12,
        bulletIndent=0,
    )
    return {
        "name": name_style,
        "contact": contact_style,
        "section": section_style,
        "role": role_style,
        "role_detail": role_detail_style,
        "body": body_style,
        "bullet": bullet_style,
    }


# ── Line detection (same logic as docx_generator) ────────────────────────────

_KNOWN_SECTIONS = re.compile(
    r"^(summary|objective|profile|experience|work experience|employment history|"
    r"education|academic|skills|technical skills|core competencies|competencies|"
    r"certifications?|projects|achievements|awards|publications|languages|"
    r"interests|references|volunteer|activities|courses?)\s*:?\s*$",
    re.IGNORECASE,
)

def _is_section(line: str) -> bool:
    s = line.strip()
    if not s or len(s) > 60:
        return False
    if _KNOWN_SECTIONS.match(s):
        return True
    if s.isupper() and 2 < len(s) < 50:
        return True
    return False


def _is_bullet(line: str) -> bool:
    return bool(re.match(r"^\s*[•\-\*–▪]\s+", line))


def _strip_bullet(line: str) -> str:
    return re.sub(r"^\s*[•\-\*–▪]\s+", "", line).strip()


def _is_role_line(line: str) -> bool:
    s = line.strip()
    return bool(re.search(r"[|·•–—]", s)) and len(s) < 120


def _is_header_line(line: str, header_values: set) -> bool:
    s = line.strip().lower()
    if not s:
        return True
    if s in header_values:
        return True
    parts = re.split(r"[|·•·,\s]+", s)
    if all(any(p in hv or hv in p for hv in header_values) for p in parts if p):
        return True
    return False


# ── Public API ────────────────────────────────────────────────────────────────

def generate_optimized_pdf(
    rewritten_text: str,
    parsed_json: dict | None = None,
) -> bytes:
    """
    Build an ATS-friendly resume PDF.
    No highlights — clean for direct submission.

    Args:
        rewritten_text: AI-optimised resume text.
        parsed_json:    Structured data (name, email, phone, linkedin, location, experience_years).
    Returns:
        PDF as raw bytes.
    """
    parsed = parsed_json or {}
    exp_years = parsed.get("experience_years") or 0
    body_pt   = 10.0 if exp_years >= 10 else 10.5

    styles = _styles(body_pt)
    buf    = io.BytesIO()

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=1.8 * cm,
        bottomMargin=1.8 * cm,
    )

    story = []
    page_w = A4[0] - 4 * cm  # usable width

    # ── Header ────────────────────────────────────────────────────────────────
    name = (parsed.get("name") or "Your Name").strip().upper()
    story.append(Paragraph(name, styles["name"]))

    contact_parts = [
        parsed.get("email", ""),
        parsed.get("phone", ""),
        parsed.get("linkedin", ""),
        parsed.get("location", ""),
    ]
    contact_line = "  ·  ".join(p for p in contact_parts if p)
    if contact_line:
        story.append(Paragraph(contact_line, styles["contact"]))

    story.append(Spacer(1, 6))
    story.append(HRFlowable(width=page_w, thickness=1.5, color=ACCENT, spaceAfter=8))

    # ── Body ──────────────────────────────────────────────────────────────────
    header_values = {v.lower().strip() for v in parsed.values() if isinstance(v, str) and v.strip()}
    new_lines = rewritten_text.splitlines()

    # Skip leading header/contact lines
    i = 0
    while i < len(new_lines) and not _is_section(new_lines[i]) and _is_header_line(new_lines[i], header_values):
        i += 1

    while i < len(new_lines):
        line = new_lines[i]
        stripped = line.strip()

        if not stripped:
            story.append(Spacer(1, 2))
            i += 1
            continue

        if _is_section(line):
            story.append(Paragraph(stripped.upper(), styles["section"]))
            story.append(HRFlowable(width=page_w, thickness=0.5, color=ACCENT, spaceAfter=3))
            i += 1

        elif _is_role_line(line) and not _is_bullet(line):
            parts = [p.strip() for p in re.split(r"[|·•–—]", stripped, maxsplit=1)]
            story.append(Paragraph(parts[0], styles["role"]))
            if len(parts) > 1:
                story.append(Paragraph(parts[1], styles["role_detail"]))
            i += 1

        elif _is_bullet(line):
            story.append(Paragraph(f"• {_strip_bullet(line)}", styles["bullet"]))
            i += 1

        else:
            story.append(Paragraph(stripped, styles["body"]))
            i += 1

    doc.build(story)
    return buf.getvalue()
