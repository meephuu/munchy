"""Step 4: turn free text into structured items, e.g.
"ข้าวเหนียวหมูปิ้ง 5 ไม้" -> [{"food": "ข้าวเหนียวหมูปิ้ง", "qty": 5, "unit": "ไม้"}]

The LLM only parses; it never produces nutrition numbers. Its output is forced into
the ParsedItem schema and validated again here, so any provider (Gemini now, Claude or
a self-hosted Ollama model later) can be swapped in by providing a `complete` function.
"""
from typing import Callable

from pydantic import BaseModel, Field, ValidationError, field_validator

from src import config

SYSTEM_PROMPT = """\
You turn a short description of a meal (Thai, English or mixed) into a JSON list of food items.
You only extract what the text says. Never invent foods, never give nutrition numbers.

Each item has:
- "food": the food name, in the language it was written in. Do not translate it.
- "qty": the number the user gave for that food, or null if none was given.
- "unit": the counting unit exactly as written (ไม้, ฟอง, จาน, ถ้วย, ห่อ, ช้อน, piece, cup, g ...), or null.

Rules:
1. A dish name that is one known dish stays ONE item, even if it is made of several foods.
   "ข้าวเหนียวหมูปิ้ง 5 ไม้" -> one item: food "ข้าวเหนียวหมูปิ้ง", qty 5, unit "ไม้". Do not split it.
2. Split lists of extra ingredients ("ใส่ A B C", "with A and B") into separate items.
3. A number belongs to the food it is next to. Foods without a number get qty null, unit null.
4. Ignore filler words (ใส่, กับ, with, and, please).
5. Return at least one item if the text mentions any food.

Examples:
"ข้าวเหนียวหมูปิ้ง 5 ไม้" ->
  [{"food": "ข้าวเหนียวหมูปิ้ง", "qty": 5, "unit": "ไม้"}]
"สลัดอกไก่ ใส่แตงกวา มะเขือเทศ ไข่ต้ม 1 ฟอง" ->
  [{"food": "สลัดอกไก่", "qty": null, "unit": null},
   {"food": "แตงกวา", "qty": null, "unit": null},
   {"food": "มะเขือเทศ", "qty": null, "unit": null},
   {"food": "ไข่ต้ม", "qty": 1, "unit": "ฟอง"}]
"cheese mashed potato with gravy sauce" ->
  [{"food": "cheese mashed potato with gravy sauce", "qty": null, "unit": null}]
"""


class ParsedItem(BaseModel):
    food: str = Field(min_length=1)
    qty: float | None = None  # positivity checked below: Gemini's schema has no `gt`
    unit: str | None = None

    @field_validator("qty")
    @classmethod
    def _qty_positive(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("qty must be > 0")
        return v

    @field_validator("food")
    @classmethod
    def _strip_food(cls, v: str) -> str:
        return v.strip()

    @field_validator("unit")
    @classmethod
    def _blank_unit_is_none(cls, v: str | None) -> str | None:
        return (v or "").strip() or None


class ParseResult(BaseModel):
    items: list[ParsedItem] = Field(min_length=1)


class ParseError(Exception):
    """The LLM never produced output that passes validation."""


Complete = Callable[[str], str]  # user text -> raw JSON string matching ParseResult


class LLMParser:
    def __init__(self, complete: Complete, retries: int = 1):
        self._complete = complete
        self._retries = retries

    def parse(self, text: str) -> list[ParsedItem]:
        if not text.strip():
            raise ParseError("empty input")
        last_error: ValidationError | None = None
        for _ in range(self._retries + 1):
            raw = self._complete(text)
            try:
                return ParseResult.model_validate_json(raw).items
            except ValidationError as e:
                last_error = e
        raise ParseError(f"LLM output failed validation: {last_error}")


def gemini_complete(api_key: str, model: str) -> Complete:
    """Build a `complete` function backed by the Gemini API (schema-constrained JSON)."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    cfg = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        response_mime_type="application/json",
        response_schema=ParseResult,
        temperature=0,
    )

    def complete(text: str) -> str:
        return client.models.generate_content(model=model, contents=text, config=cfg).text

    return complete


def ollama_complete(model: str, base_url: str, client: "httpx.Client | None" = None) -> Complete:
    """Build a `complete` function backed by a local Ollama server (self-hosted models such as
    Qwen or Typhoon). Ollama constrains the output to our JSON schema, same as Gemini does."""
    import httpx

    http = client or httpx.Client(timeout=120)
    schema = ParseResult.model_json_schema()

    def complete(text: str) -> str:
        body = {"model": model, "stream": False, "format": schema, "options": {"temperature": 0},
                "messages": [{"role": "system", "content": SYSTEM_PROMPT},
                             {"role": "user", "content": text}]}
        try:
            resp = http.post(f"{base_url.rstrip('/')}/api/chat", json=body)
        except httpx.TransportError as e:
            raise RuntimeError(f"cannot reach Ollama at {base_url} - is it running? ({e})") from e
        if resp.status_code == 404:
            raise RuntimeError(f"Ollama does not have model {model!r} - run: ollama pull {model}")
        resp.raise_for_status()
        return resp.json()["message"]["content"]

    return complete


def model_id() -> str:
    """Name of the model behind the current provider (part of the parse-cache key)."""
    if config.LLM_PROVIDER == "gemini":
        return config.GEMINI_MODEL
    if config.LLM_PROVIDER == "ollama":
        return config.OLLAMA_MODEL
    return ""


def get_parser() -> LLMParser:
    """Pick the backend from LLM_PROVIDER in .env."""
    if config.LLM_PROVIDER == "gemini":
        if not config.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is empty - set it in .env")
        return LLMParser(gemini_complete(config.GEMINI_API_KEY, config.GEMINI_MODEL))
    if config.LLM_PROVIDER == "ollama":
        return LLMParser(ollama_complete(config.OLLAMA_MODEL, config.OLLAMA_URL))
    raise RuntimeError(f"Unknown LLM_PROVIDER {config.LLM_PROVIDER!r} (supported: gemini, ollama)")


def parse(text: str) -> list[ParsedItem]:
    return get_parser().parse(text)
