"""
LLM provider abstraction.
- Groq (Qwen3-32B): 500K TPD free tier — used for scoring, extraction, suggestions, match analysis
- Gemini Flash Lite: better long-form writing — used for resume rewriting
"""
from enum import Enum
from groq import AsyncGroq
from google import genai
from app.config import get_settings

settings = get_settings()

_groq_client = AsyncGroq(api_key=settings.groq_api_key)
_gemini_client = genai.Client(api_key=settings.gemini_api_key)


class LLMTask(str, Enum):
    FAST = "fast"       # Groq — scoring, extraction, suggestions
    WRITING = "writing" # Gemini — resume rewriting, outreach messages


async def complete(prompt: str, system: str = "", task: LLMTask = LLMTask.FAST) -> str:
    if task == LLMTask.FAST:
        return await _groq_complete(prompt, system)
    return await _gemini_complete(prompt, system)


async def _groq_complete(prompt: str, system: str) -> str:
    import re
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    response = await _groq_client.chat.completions.create(
        model="qwen/qwen3-32b",
        messages=messages,
        temperature=0.3,
        max_tokens=4096,
    )
    content = response.choices[0].message.content or ""
    # Strip <think>...</think> reasoning blocks emitted by Qwen3
    content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
    return content


async def _gemini_complete(prompt: str, system: str) -> str:
    full_prompt = f"{system}\n\n{prompt}" if system else prompt
    response = await _gemini_client.aio.models.generate_content(
        model="gemini-3.1-flash-lite",
        contents=full_prompt,
    )
    return response.text
