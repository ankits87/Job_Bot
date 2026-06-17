"""
Playwright-based LinkedIn automation.
Handles Easy Apply flow and 2nd/3rd degree network scraping.
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright, Page
from app.services.job_scraper import save_session

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def _load_context(playwright):
    from pathlib import Path
    import json
    browser = playwright.chromium.launch(headless=False)  # visible for login
    context = browser.new_context(user_agent=UA)
    cookies_path = Path("uploads/linkedin_cookies.json")
    if cookies_path.exists():
        context.add_cookies(json.loads(cookies_path.read_text()))
    return context

UPLOADS = Path("uploads")


class LinkedInBrowser:
    def __init__(self):
        self._pw = None
        self._context = None

    async def __aenter__(self):
        self._pw = await async_playwright().start()
        self._context = await _load_context(self._pw)
        return self

    async def __aexit__(self, *_):
        if self._context:
            await self._context.close()
        if self._pw:
            await self._pw.stop()

    # ── Easy Apply ────────────────────────────────────────────────────────────

    async def apply_to_job(self, job_url: str, resume_path: str, profile: dict) -> dict:
        """
        Attempt LinkedIn Easy Apply. Returns {"status": "applied"|"manual_required"|"failed", "error": str|None}
        """
        page = await self._context.new_page()
        try:
            await page.goto(job_url, wait_until="domcontentloaded", timeout=20000)

            easy_apply_btn = await page.query_selector("button.jobs-apply-button, .jobs-s-apply button")
            if not easy_apply_btn:
                return {"status": "manual_required", "error": "No Easy Apply button found"}

            await easy_apply_btn.click()
            await page.wait_for_selector(".jobs-easy-apply-modal", timeout=8000)

            # Step through the modal (up to 6 steps)
            for step in range(6):
                await asyncio.sleep(1)

                # Upload resume if there's a file input
                file_input = await page.query_selector("input[type='file']")
                if file_input:
                    await file_input.set_input_files(resume_path)
                    await asyncio.sleep(1)

                # Fill phone if empty
                phone_input = await page.query_selector("input[id*='phone']")
                if phone_input:
                    val = await phone_input.input_value()
                    if not val and profile.get("phone"):
                        await phone_input.fill(profile["phone"])

                # Try "Next" or "Submit" button
                next_btn = await page.query_selector("button[aria-label='Continue to next step']")
                submit_btn = await page.query_selector("button[aria-label='Submit application']")

                if submit_btn:
                    await submit_btn.click()
                    await asyncio.sleep(2)
                    return {"status": "applied", "error": None}
                elif next_btn:
                    await next_btn.click()
                else:
                    break  # Unexpected state

            return {"status": "failed", "error": "Could not complete application form"}

        except Exception as e:
            return {"status": "failed", "error": str(e)[:200]}
        finally:
            await page.close()

    # ── Network scraping ───────────────────────────────────────────────────────

    async def get_people_at_company(self, company: str, degree_filter: str = "F") -> list[dict]:
        """
        degree_filter: "F"=1st, "S"=2nd, "O"=3rd+
        Returns list of {name, title, profile_url, linkedin_id}
        """
        page = await self._context.new_page()
        people = []
        try:
            query = f"https://www.linkedin.com/search/results/people/?keywords={company.replace(' ', '%20')}&network=%5B%22{degree_filter}%22%5D&currentCompany=true"
            await page.goto(query, wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(2)

            cards = await page.query_selector_all(".entity-result__item")
            for card in cards[:10]:
                try:
                    name_el = await card.query_selector(".entity-result__title-text a")
                    title_el = await card.query_selector(".entity-result__primary-subtitle")
                    if not name_el:
                        continue
                    name = (await name_el.inner_text()).strip()
                    title = (await title_el.inner_text()).strip() if title_el else ""
                    url = await name_el.get_attribute("href") or ""
                    url = url.split("?")[0]
                    lid = url.rstrip("/").split("/")[-1]
                    people.append({"name": name, "title": title, "profile_url": url, "linkedin_id": lid})
                except Exception:
                    continue
        except Exception:
            pass
        finally:
            await page.close()
        return people
