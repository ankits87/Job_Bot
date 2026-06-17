"""
Connection search via Playwright subprocess (Windows asyncio compatible).
Navigates to linkedin.com/company/{slug}/people/ for reliable results.
"""
import asyncio
import json
import logging
import subprocess
import sys
import tempfile
from pathlib import Path

from app.services.llm_service import complete, LLMTask

logger = logging.getLogger(__name__)
COOKIES_PATH = Path("uploads/linkedin_cookies.json")

PEOPLE_SCRIPT = """
import json, sys, time, re, tempfile, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

company      = sys.argv[1]
cookies_file = sys.argv[2]

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

STEALTH_JS = '''
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3,4,5]});
Object.defineProperty(navigator, 'languages', {get: () => ['en-US','en']});
window.chrome = {runtime: {}};
'''

def log(msg):
    print(msg, file=sys.stderr, flush=True)

results = []

# Use a temp user-data-dir so Playwright behaves like a real persistent profile
tmp_profile = tempfile.mkdtemp(prefix="pw_li_")
try:
  with sync_playwright() as pw:
    ctx = pw.chromium.launch_persistent_context(
        tmp_profile,
        headless=True,
        user_agent=UA,
        viewport={"width": 1280, "height": 800},
        args=[
            "--no-sandbox",
            "--disable-blink-features=AutomationControlled",
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process",
        ],
        extra_http_headers={"Accept-Language": "en-US,en;q=0.9"},
        ignore_default_args=["--enable-automation"],
    )
    ctx.add_init_script(STEALTH_JS)

    page = ctx.new_page()

    # Establish domain context first, then inject cookies
    page.goto("https://www.linkedin.com/robots.txt", wait_until="commit", timeout=15000)
    time.sleep(1)

    try:
        cookies = json.loads(Path(cookies_file).read_text())
        ctx.add_cookies(cookies)
        log(f"Loaded {len(cookies)} cookies")
    except Exception as e:
        log(f"Cookie load error: {e}")

    # ── Step 1: Find company slug via LinkedIn company search ──────────────────
    search_url = f"https://www.linkedin.com/search/results/companies/?keywords={company.replace(' ', '%20')}"
    log(f"Searching for company: {search_url}")
    page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
    time.sleep(2)

    if any(x in page.url for x in ["linkedin.com/login", "authwall", "signup"]) or "sign up" in page.title().lower():
        log("SESSION_EXPIRED")
        print(json.dumps([]), flush=True)
        sys.exit(0)

    # Find first company result link
    company_slug = None
    for sel in [
        "a.app-aware-link[href*='/company/']",
        ".entity-result__title-text a[href*='/company/']",
        "a[href*='/company/']",
    ]:
        links = page.query_selector_all(sel)
        for link in links:
            href = link.get_attribute("href") or ""
            m = re.search(r"/company/([^/?]+)", href)
            if m:
                company_slug = m.group(1)
                log(f"Found company slug: {company_slug}")
                break
        if company_slug:
            break

    if not company_slug:
        log("Could not find company slug — falling back to keyword slug")
        company_slug = company.lower().strip().replace(" ", "-")

    # ── Step 2: Navigate to company people page ────────────────────────────────
    people_url = f"https://www.linkedin.com/company/{company_slug}/people/"
    log(f"Navigating to people page: {people_url}")
    page.goto(people_url, wait_until="networkidle", timeout=45000)
    time.sleep(2)

    # Wait for any SPA redirects to settle
    try:
        page.wait_for_load_state("networkidle", timeout=10000)
    except Exception:
        pass

    log(f"People page title: {page.title()}")

    if any(x in page.url for x in ["linkedin.com/login", "authwall", "signup"]) or "sign up" in page.title().lower():
        log("SESSION_EXPIRED")
        print(json.dumps([]), flush=True)
        sys.exit(0)

    # Scroll to load more people
    for _ in range(3):
        page.keyboard.press("End")
        time.sleep(1.5)

    # ── Step 3: Scrape people cards ────────────────────────────────────────────
    cards = []
    for sel in [
        ".org-people-profile-card__profile-info",
        ".artdeco-card.org-people-profile-card",
        "[data-member-id]",
        ".scaffold-finite-scroll__content li",
    ]:
        try:
            cards = page.query_selector_all(sel)
            if cards:
                log(f"Found {len(cards)} people cards with: {sel}")
                break
        except Exception as e:
            log(f"Selector {sel} error: {e}")
            continue

    if not cards:
        log("No people cards found — dumping page snippet")
        try:
            log(page.content()[:2000])
        except Exception:
            pass

    for card in cards[:15]:
        try:
            name_el  = card.query_selector(
                ".org-people-profile-card__profile-title, "
                ".artdeco-entity-lockup__title, "
                "div[aria-label] span[aria-hidden='true']"
            )
            title_el = card.query_selector(
                ".artdeco-entity-lockup__subtitle, "
                ".org-people-profile-card__profile-position"
            )
            link_el  = card.query_selector("a[href*='/in/']")
            degree_el = card.query_selector(
                ".dist-value, "
                "[aria-label*='degree'], "
                ".member-insights__reason"
            )

            if not name_el:
                continue

            name  = name_el.inner_text().strip()
            title = title_el.inner_text().strip() if title_el else ""
            href  = (link_el.get_attribute("href") if link_el else "") or ""
            href  = href.split("?")[0]
            lid   = href.rstrip("/").split("/")[-1]

            # Parse degree from badge text
            degree = 3
            if degree_el:
                dt = degree_el.inner_text().strip().lower()
                if "1st" in dt or "1 st" in dt:
                    degree = 1
                elif "2nd" in dt or "2 nd" in dt:
                    degree = 2

            if name:
                results.append({
                    "name": name, "title": title,
                    "profile_url": href, "linkedin_id": lid,
                    "degree": degree,
                })
        except Exception as e:
            log(f"Card parse error: {e}")
            continue

    log(f"Total people found: {len(results)}")
    ctx.close()
finally:
  shutil.rmtree(tmp_profile, ignore_errors=True)

print(json.dumps(results), flush=True)
"""


def _run_people_search(company: str) -> list[dict]:
    if not COOKIES_PATH.exists():
        logger.warning("No LinkedIn cookies file found")
        return []

    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as cf:
        cf.write(COOKIES_PATH.read_text())
        cookies_file = cf.name

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as sf:
        sf.write(PEOPLE_SCRIPT)
        script_path = sf.name

    try:
        result = subprocess.run(
            [sys.executable, script_path, company, cookies_file],
            capture_output=True, text=True, timeout=120,
        )
        if result.stderr:
            print(f"\n=== People search [{company}] ===\n{result.stderr}\n===", flush=True)
            if "SESSION_EXPIRED" in result.stderr:
                print("LinkedIn blocked the headless browser (bot detection or expired session)", flush=True)
                raise ValueError("SESSION_EXPIRED")
        output = result.stdout.strip()
        print(f"People search stdout: {output[:300]}", flush=True)
        if not output:
            return []
        return json.loads(output)
    except ValueError:
        raise  # propagate SESSION_EXPIRED to the router
    except Exception as e:
        print(f"People search FAILED: {e}", flush=True)
        return []
    finally:
        Path(script_path).unlink(missing_ok=True)
        Path(cookies_file).unlink(missing_ok=True)


async def _generate_outreach(person: dict, company: str, role: str) -> str:
    prompt = (
        f"Write a short LinkedIn connection request message (under 300 characters) "
        f"to ask {person['name']} ({person.get('title', '')}) at {company} "
        f"for a referral for a {role} role. Be warm and professional. "
        f"Return only the message text."
    )
    return await complete(prompt, task=LLMTask.WRITING)


async def find_referrals(company: str, target_role: str) -> list[dict]:
    loop = asyncio.get_event_loop()
    people = await loop.run_in_executor(None, _run_people_search, company)  # raises ValueError("SESSION_EXPIRED") if expired
    logger.info(f"find_referrals: {len(people)} people found at '{company}'")

    for person in people[:10]:
        person["outreach_message"] = await _generate_outreach(person, company, target_role)

    return people
