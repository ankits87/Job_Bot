"""
LinkedIn job scraper — public search, no login required.
Runs Playwright in a subprocess to avoid Windows asyncio/uvicorn thread pool issues.
"""
import asyncio
import json
import subprocess
import sys
import tempfile
from pathlib import Path

COOKIES_PATH = Path("uploads/linkedin_cookies.json")

# Industry keyword expansion — when user adds a broad interest, expand to related terms
INDUSTRY_EXPANSIONS: dict[str, list[str]] = {
    "banking":            ["banking", "financial services", "fintech", "neobanking", "digital banking"],
    "insurance":          ["insurance", "insurtech", "insuretech", "reinsurance"],
    "fintech":            ["fintech", "financial technology", "payments", "neobank", "wealthtech"],
    "financial services": ["financial services", "banking", "fintech", "capital markets", "asset management"],
    "finance":            ["finance", "financial services", "fintech", "banking"],
    "healthcare":         ["healthcare", "healthtech", "medtech", "health IT", "digital health"],
    "edtech":             ["edtech", "education technology", "e-learning", "online education"],
    "retail":             ["retail", "e-commerce", "retail tech", "D2C"],
    "ecommerce":          ["ecommerce", "e-commerce", "retail tech", "marketplace"],
    "logistics":          ["logistics", "supply chain", "logistics tech", "last mile delivery"],
    "real estate":        ["real estate", "proptech", "real estate tech"],
    "ai":                 ["AI", "artificial intelligence", "machine learning", "generative AI"],
    "saas":               ["SaaS", "B2B software", "enterprise software", "cloud software"],
    "cybersecurity":      ["cybersecurity", "information security", "cloud security"],
    "crypto":             ["crypto", "blockchain", "web3", "DeFi"],
    "climate":            ["climate tech", "cleantech", "sustainability", "green energy"],
}


def expand_interests(interests: list[str]) -> list[str]:
    """Expand broad interest terms into related industry keywords."""
    expanded: list[str] = []
    seen: set[str] = set()
    for interest in interests:
        key = interest.lower().strip()
        terms = INDUSTRY_EXPANSIONS.get(key, [interest])
        for term in terms:
            if term.lower() not in seen:
                seen.add(term.lower())
                expanded.append(term)
    return expanded


SCRAPER_SCRIPT = """
import json, sys, time, urllib.parse
from playwright.sync_api import sync_playwright

keywords    = sys.argv[1].split(",")
location    = sys.argv[2]
max_jobs    = int(sys.argv[3])
start       = int(sys.argv[4]) if len(sys.argv) > 4 else 0
easy_apply  = sys.argv[5].lower() == "true" if len(sys.argv) > 5 else False

query = " ".join(k.strip() for k in keywords[:4])
params = {
    "keywords": query,
    "location": location,
    "start": str(start),
    "f_TPR": "r864000",   # 10 days
    "sortBy": "R",        # relevance
}
if easy_apply:
    params["f_EA"] = "true"

url = "https://www.linkedin.com/jobs/search/?" + urllib.parse.urlencode(params)

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

jobs = []

with sync_playwright() as pw:
    browser = pw.chromium.launch(
        headless=True,
        args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
    )
    ctx = browser.new_context(
        user_agent=UA, viewport={"width": 1280, "height": 800}, locale="en-US",
        extra_http_headers={"Accept-Language": "en-US,en;q=0.9"},
    )
    ctx.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")
    page = ctx.new_page()

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
    except Exception:
        print(json.dumps([]), flush=True)
        sys.exit(0)

    for _ in range(4):
        page.keyboard.press("End")
        time.sleep(1.2)

    cards = []
    for sel in ["li.jobs-search-results__list-item", "div.base-card", "li[data-occludable-job-id]"]:
        cards = page.query_selector_all(sel)
        if cards:
            break

    for card in cards[:max_jobs]:
        try:
            title_el    = card.query_selector("h3.base-search-card__title, a.job-card-list__title, span[aria-hidden='true']")
            company_el  = card.query_selector("h4.base-search-card__subtitle, a.job-card-container__company-name, .job-card-container__primary-description")
            location_el = card.query_selector("span.job-search-card__location, .job-card-container__metadata-item")
            link_el     = card.query_selector("a.base-card__full-link, a.job-card-list__title")
            date_el     = card.query_selector("time, .job-search-card__listdate, .job-card-container__listed-status")

            if not title_el or not link_el:
                continue

            title   = title_el.inner_text().strip()
            company = company_el.inner_text().strip() if company_el else ""
            loc     = location_el.inner_text().strip() if location_el else ""
            href    = (link_el.get_attribute("href") or "").split("?")[0]

            # Posting date — prefer datetime attr, fall back to visible text
            posted_at = None
            if date_el:
                posted_at = (
                    date_el.get_attribute("datetime")
                    or date_el.inner_text().strip()
                    or None
                )

            if title and href:
                jobs.append({
                    "title": title,
                    "company": company,
                    "location": loc,
                    "url": href,
                    "is_easy_apply": easy_apply,
                    "jd_text": "",
                    "posted_at": posted_at,
                })
        except Exception:
            continue

    # Fetch JD + detect Easy Apply button on detail page
    detail = ctx.new_page()
    for job in jobs:
        try:
            detail.goto(job["url"], wait_until="domcontentloaded", timeout=20000)
            time.sleep(1.2)

            jd_el = detail.query_selector(".description__text, .show-more-less-html__markup")
            job["jd_text"] = jd_el.inner_text().strip() if jd_el else ""

            # Detect Easy Apply from detail page (more reliable than search results flag)
            ea_btn = detail.query_selector("button.jobs-apply-button, .jobs-s-apply button")
            if ea_btn:
                btn_text = ea_btn.inner_text().strip().lower()
                job["is_easy_apply"] = "easy apply" in btn_text

            # Pick up posting date from detail page if missing
            if not job.get("posted_at"):
                dt_el = detail.query_selector("span.posted-time-ago__text, .jobs-unified-top-card__posted-date")
                if dt_el:
                    job["posted_at"] = dt_el.inner_text().strip()

        except Exception:
            pass
        time.sleep(0.8)

    ctx.close()

print(json.dumps(jobs), flush=True)
"""


def _run_scraper_subprocess(
    keywords_str: str, location: str, max_jobs: int, start: int = 0, easy_apply: bool = False
) -> list[dict]:
    import logging
    logger = logging.getLogger(__name__)

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
        f.write(SCRAPER_SCRIPT)
        script_path = f.name

    try:
        result = subprocess.run(
            [sys.executable, script_path, keywords_str, location, str(max_jobs), str(start), str(easy_apply)],
            capture_output=True, text=True, timeout=180,
        )
        logger.info(f"Scraper exit={result.returncode} loc={location} start={start} ea={easy_apply}")
        if result.stderr:
            logger.warning(f"Scraper stderr: {result.stderr[:500]}")
        output = result.stdout.strip()
        if not output:
            return []
        return json.loads(output)
    except Exception as e:
        logger.error(f"Subprocess failed: {e}")
        return []
    finally:
        Path(script_path).unlink(missing_ok=True)


def _build_search_queries(
    target_roles: list[str],
    interests: list[str],
    max_queries: int = 6,
) -> list[str]:
    """
    Build one query per target role, optionally appending the top interest.
    E.g. roles=["PM", "Head of Product"], interests=["Fintech", "Banking"]
    → ["PM Fintech", "PM Banking", "Head of Product Fintech", "Head of Product Banking"]
    Capped at max_queries to limit LinkedIn exposure.
    """
    queries: list[str] = []
    top_interests = interests[:2]  # at most 2 interest suffixes per role
    for role in target_roles:
        if top_interests:
            for interest in top_interests:
                queries.append(f"{role} {interest}")
                if len(queries) >= max_queries:
                    return queries
        else:
            queries.append(role)
            if len(queries) >= max_queries:
                return queries
    return queries or (target_roles[:1] if target_roles else ["Product Manager"])


async def scrape_jobs(
    target_roles: list[str],
    interests: list[str],
    locations: list[str],
    max_jobs: int = 10,
    start: int = 0,
    easy_apply: bool = False,
    max_queries: int = 6,
) -> list[dict]:
    import logging
    logger = logging.getLogger(__name__)

    if not locations:
        locations = ["India"]

    queries = _build_search_queries(target_roles, interests)[:max_queries]
    logger.info(f"Search queries ({len(queries)}): {queries}")

    # Per search: fetch enough to get max_jobs unique results after dedup
    per_query = max(5, max_jobs)
    loop = asyncio.get_event_loop()

    seen_urls: set[str] = set()
    merged: list[dict] = []

    for i, query in enumerate(queries):
        # Polite delay between searches to avoid bot detection (skip first)
        if i > 0:
            await asyncio.sleep(4)

        keywords_str = query.replace(" ", ",")
        for loc in locations:
            try:
                batch = await loop.run_in_executor(
                    None, _run_scraper_subprocess, keywords_str, loc, per_query, start, easy_apply
                )
                for job in batch:
                    if job["url"] not in seen_urls:
                        seen_urls.add(job["url"])
                        merged.append(job)
                logger.info(f"Query '{query}' @ '{loc}': {len(batch)} results, {len(merged)} unique total")
            except Exception as e:
                logger.error(f"Scraper failed for query='{query}' loc='{loc}': {e}")

    return merged


def save_session(cookies: list[dict]) -> None:
    COOKIES_PATH.parent.mkdir(parents=True, exist_ok=True)
    COOKIES_PATH.write_text(json.dumps(cookies))
