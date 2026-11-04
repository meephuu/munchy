"""Step 4: turn free text into structured items, e.g.
"ข้าวเหนียวหมูปิ้ง 5 ไม้" -> [{"food": "ข้าวเหนียวหมูปิ้ง", "qty": 5, "unit": "ไม้"}]

The LLM only parses; it never produces nutrition numbers. Its output is forced into
the ParsedItem schema and validated again here, so any provider (Gemini now, Claude or
a self-hosted Ollama model later) can be swapped in by providing a `complete` function.
"""
from typing import Callable

from pydantic import BaseModel, Field, ValidationError, field_validator
from pydantic.json_schema import SkipJsonSchema

from src import config

SYSTEM_PROMPT = """\
You turn a short description of a meal (Thai, English or mixed) into a JSON list of food items.
You only extract what the text says. Never invent foods, never give nutrition numbers.

Each item has:
- "food": the food name, in the language it was written in. Do not translate it.
- "food_en": the same food named in plain English ("grilled pork skewer"). Copy "food" if it is already English.
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
  [{"food": "ข้าวเหนียวหมูปิ้ง", "food_en": "sticky rice with grilled pork skewers", "qty": 5, "unit": "ไม้"}]
"สลัดอกไก่ ใส่แตงกวา มะเขือเทศ ไข่ต้ม 1 ฟอง" ->
  [{"food": "สลัดอกไก่", "food_en": "chicken breast salad", "qty": null, "unit": null},
   {"food": "แตงกวา", "food_en": "cucumber", "qty": null, "unit": null},
   {"food": "มะเขือเทศ", "food_en": "tomato", "qty": null, "unit": null},
   {"food": "ไข่ต้ม", "food_en": "boiled egg", "qty": 1, "unit": "ฟอง"}]
"cheese mashed potato with gravy sauce" ->
  [{"food": "cheese mashed potato with gravy sauce", "food_en": "cheese mashed potato with gravy sauce",
    "qty": null, "unit": null}]
"caesar salad with boiled shrimp" ->
  [{"food": "caesar salad", "food_en": "caesar salad", "qty": null, "unit": null},
   {"food": "boiled shrimp", "food_en": "boiled shrimp", "qty": null, "unit": null}]
"nutella" ->
  [{"food": "nutella", "food_en": "chocolate hazelnut spread", "qty": null, "unit": null}]
"""

# Second, separate call: what does a dish usually contain? Kept apart from the parse because a
# small model follows one narrow task much better than two at once.
PARTS_PROMPT = """\
You are given the name of one dish or food (Thai or English). Decide what it is made of.
Return JSON with two lists:

"similar": 0 to 3 generic English names of the SINGLE closest foods a nutrition table lists as one
entry, most similar first. Use it only when the dish is a variation of a common food ("chocolate chip
bread" -> "sweet bread", "iced latte" -> "latte"). Leave it empty for dishes made of separate foods
and for plain single foods.

"components": 2 to 6 parts the dish usually contains, each {"name", "role"}:
- "name": the plainest common form, as a nutrition table names it ("wheat flour", "white sugar",
  "butter", "romaine lettuce", "caesar dressing"). Not brand or compound product names.
- "role": base (rice, noodles, bread, flour, dough, potato), protein (meat, fish, egg, tofu, beans),
  vegetable, filling (fruit, chocolate, cheese, nuts, anything mixed in), sauce (sauce, dressing,
  oil, butter, milk, sugar), topping (garnish, crumbs, seeds) or other.
Include the carbohydrate base, the main protein, and the usual sauce, dressing or topping.
Return an empty "components" list for a single food or drink (egg, banana, white rice, plain
yogurt, chocolate spread, beer, milk) and for anything that is not food.
Never return amounts, calories or any numbers.

Examples:
"caesar salad" -> {"similar": [], "components": [{"name": "romaine lettuce", "role": "vegetable"},
  {"name": "caesar dressing", "role": "sauce"}, {"name": "croutons", "role": "topping"},
  {"name": "parmesan cheese", "role": "topping"}]}
"chocolate chip bread" -> {"similar": ["sweet bread"], "components": [{"name": "wheat flour",
  "role": "base"}, {"name": "white sugar", "role": "sauce"}, {"name": "butter", "role": "sauce"},
  {"name": "semisweet chocolate", "role": "filling"}]}
"ผัดกะเพราไก่ไข่ดาว" -> {"similar": [], "components": [{"name": "stir-fried chicken with basil",
  "role": "protein"}, {"name": "steamed rice", "role": "base"}, {"name": "fried egg", "role": "protein"}]}
"greek yogurt" -> {"similar": [], "components": []}
"banana" -> {"similar": [], "components": []}
"""


class ParsedItem(BaseModel):
    food: str = Field(min_length=1)
    food_en: str | None = None   # English name, for display; matching tries `food` first
    components: SkipJsonSchema[list[str]] = Field(default_factory=list)   # typical parts of a dish; filled by the pipeline
    part_roles: SkipJsonSchema[list[str]] = Field(default_factory=list)   # role of each part (same order), when known
    implied_for: SkipJsonSchema[str | None] = None   # set by the pipeline, never by the LLM: the dish this part was added for
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

    @field_validator("food_en")
    @classmethod
    def _blank_english_is_none(cls, v: str | None) -> str | None:
        return (v or "").strip() or None

    @property
    def label(self) -> str:
        """What to call this item when talking to the user: English if the parser gave it."""
        return self.food_en or self.food

    @field_validator("unit")
    @classmethod
    def _blank_unit_is_none(cls, v: str | None) -> str | None:
        return (v or "").strip() or None


class ParseResult(BaseModel):
    items: list[ParsedItem] = Field(min_length=1)


PART_ROLES = ("base", "protein", "vegetable", "filling", "sauce", "topping", "other")


class Part(BaseModel):
    name: str
    role: str = "other"   # one of PART_ROLES; anything else is read as "other" (a small model may slip)

    @field_validator("role")
    @classmethod
    def _known_role(cls, v: str) -> str:
        v = (v or "").strip().lower()
        return v if v in PART_ROLES else "other"


class Decomposition(BaseModel):
    """What the second LLM call returns: closest single foods, and typical parts with a role each
    (the role lets code split the dish's weight over its parts; the LLM gives no amounts)."""
    similar: list[str] = Field(default_factory=list, max_length=3)
    components: list[Part] = Field(default_factory=list, max_length=8)

    @field_validator("components", mode="before")
    @classmethod
    def _bare_names(cls, v):
        # a plain string is a part with no known role
        return [{"name": x} if isinstance(x, str) else x for x in v] if isinstance(v, list) else v

    @field_validator("components")
    @classmethod
    def _clean_parts(cls, v: list[Part]) -> list[Part]:
        return [Part(name=p.name.strip(), role=p.role) for p in v if p.name.strip()]

    @field_validator("similar")
    @classmethod
    def _clean_similar(cls, v: list[str]) -> list[str]:
        return [c.strip() for c in v if c and c.strip()]

    @property
    def names(self) -> list[str]:
        return [p.name for p in self.components]

    @property
    def roles(self) -> list[str]:
        return [p.role for p in self.components]


class ParseError(Exception):
    """The LLM never produced output that passes validation."""


Complete = Callable[[str], str]  # user text -> raw JSON string matching ParseResult


class LLMParser:
    def __init__(self, complete: Complete, retries: int = 1, complete_parts: Complete | None = None):
        self._complete = complete
        self._complete_parts = complete_parts
        self._retries = retries

    def decompose(self, dish: str) -> Decomposition:
        """Closest single foods and typical parts (generic English names with a role) of a dish;
        no parts for a single food."""
        if self._complete_parts is None:
            raise RuntimeError("this parser has no decomposition backend")
        last_error: ValidationError | None = None
        for _ in range(self._retries + 1):
            try:
                return Decomposition.model_validate_json(self._complete_parts(dish))
            except ValidationError as e:
                last_error = e
        raise ParseError(f"LLM output failed validation: {last_error}")

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


RETRY_STATUSES = {429, 500, 503, 504}   # overloaded or rate-limited: worth one try on the fallback model


def gemini_complete(api_key: str, model: str, prompt: str = SYSTEM_PROMPT,
                    schema: type[BaseModel] = ParseResult, fallback_model: str | None = None) -> Complete:
    """Build a `complete` function backed by the Gemini API (schema-constrained JSON). If the main model
    answers with an overload / rate-limit error, the same request is tried once on `fallback_model`."""
    from google import genai
    from google.genai import errors, types

    client = genai.Client(api_key=api_key)
    cfg = types.GenerateContentConfig(
        system_instruction=prompt,
        response_mime_type="application/json",
        response_schema=schema,
        temperature=0,
    )

    def call(name: str, text: str) -> str:
        return client.models.generate_content(model=name, contents=text, config=cfg).text

    def complete(text: str) -> str:
        try:
            return call(model, text)
        except errors.APIError as e:
            if not fallback_model or fallback_model == model or e.code not in RETRY_STATUSES:
                raise
            return call(fallback_model, text)

    return complete


def ollama_complete(model: str, base_url: str, client: "httpx.Client | None" = None,
                    prompt: str = SYSTEM_PROMPT, schema: type[BaseModel] = ParseResult) -> Complete:
    """Build a `complete` function backed by a local Ollama server (self-hosted models such as
    Qwen or Typhoon). Ollama constrains the output to our JSON schema, same as Gemini does."""
    import httpx

    http = client or httpx.Client(timeout=120)
    json_schema = schema.model_json_schema()

    def complete(text: str) -> str:
        body = {"model": model, "stream": False, "format": json_schema, "options": {"temperature": 0},
                "messages": [{"role": "system", "content": prompt},
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
        fallback = config.GEMINI_FALLBACK_MODEL or None
        return LLMParser(gemini_complete(config.GEMINI_API_KEY, config.GEMINI_MODEL, fallback_model=fallback),
                         complete_parts=gemini_complete(config.GEMINI_API_KEY, config.GEMINI_MODEL,
                                                        PARTS_PROMPT, Decomposition, fallback_model=fallback))
    if config.LLM_PROVIDER == "ollama":
        return LLMParser(ollama_complete(config.OLLAMA_MODEL, config.OLLAMA_URL),
                         complete_parts=ollama_complete(config.OLLAMA_MODEL, config.OLLAMA_URL,
                                                        prompt=PARTS_PROMPT, schema=Decomposition))
    raise RuntimeError(f"Unknown LLM_PROVIDER {config.LLM_PROVIDER!r} (supported: gemini, ollama)")


def parse(text: str) -> list[ParsedItem]:
    return get_parser().parse(text)


def decompose(dish: str) -> Decomposition:
    return get_parser().decompose(dish)
