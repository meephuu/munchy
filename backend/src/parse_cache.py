"""Step 10: remember parse results so a repeated dish skips the LLM call.

Stored in its own SQLite file (not foods.db, which is wiped on every re-seed). The key
hashes the normalised text together with the provider, model and system prompt, so
changing any of them misses the cache instead of serving a stale parse.
"""
import hashlib
import sqlite3
from contextlib import closing
from pathlib import Path

from pydantic import ValidationError

from src import config, parser
from src.parser import Decomposition, ParsedItem, ParseResult
from src.textutil import normalize

SCHEMA = """
CREATE TABLE IF NOT EXISTS parse_cache (
    key         TEXT PRIMARY KEY,
    text        TEXT NOT NULL,          -- original input, for debugging
    result      TEXT NOT NULL,          -- ParseResult as JSON
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS parts_cache (
    key         TEXT PRIMARY KEY,
    dish        TEXT NOT NULL,
    result      TEXT NOT NULL,          -- Decomposition as JSON
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
"""


def cache_key(text: str, provider: str, model: str, prompt: str) -> str:
    raw = "\x1f".join((normalize(text), provider, model, prompt))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class ParseCache:
    def __init__(self, path: Path = config.CACHE_PATH):
        self.path = Path(path)

    def _connect(self) -> sqlite3.Connection:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.path)
        conn.executescript(SCHEMA)
        return conn

    def get(self, key: str) -> list[ParsedItem] | None:
        with closing(self._connect()) as conn:
            row = conn.execute("SELECT result FROM parse_cache WHERE key = ?", (key,)).fetchone()
        if row is None:
            return None
        try:
            return ParseResult.model_validate_json(row[0]).items
        except ValidationError:          # corrupt or from an older schema: treat as a miss
            return None

    def put(self, key: str, text: str, items: list[ParsedItem]) -> None:
        result = ParseResult(items=items).model_dump_json()
        with closing(self._connect()) as conn, conn:
            conn.execute("INSERT OR REPLACE INTO parse_cache (key, text, result) VALUES (?, ?, ?)",
                         (key, text, result))

    def get_parts(self, key: str) -> list[str] | None:
        with closing(self._connect()) as conn:
            row = conn.execute("SELECT result FROM parts_cache WHERE key = ?", (key,)).fetchone()
        if row is None:
            return None
        try:
            return Decomposition.model_validate_json(row[0]).components
        except ValidationError:
            return None

    def put_parts(self, key: str, dish: str, components: list[str]) -> None:
        result = Decomposition(components=components).model_dump_json()
        with closing(self._connect()) as conn, conn:
            conn.execute("INSERT OR REPLACE INTO parts_cache (key, dish, result) VALUES (?, ?, ?)",
                         (key, dish, result))


def cached_decompose(dish: str, *, use_cache: bool = True,
                     cache: ParseCache | None = None) -> list[str]:
    """parser.decompose() with a cache in front (a dish's typical parts do not change)."""
    if not use_cache:
        return parser.decompose(dish)
    cache = cache or ParseCache()
    key = cache_key(dish, config.LLM_PROVIDER, parser.model_id(), parser.PARTS_PROMPT)
    parts = cache.get_parts(key)
    if parts is None:
        parts = parser.decompose(dish)
        cache.put_parts(key, dish, parts)
    return parts


def cached_parse(text: str, *, use_cache: bool = True,
                 cache: ParseCache | None = None) -> list[ParsedItem]:
    """parser.parse() with a cache in front. A hit needs no API key and no network.

    Only successful, validated parses are stored: if the LLM call or validation raises,
    nothing is written.
    """
    if not use_cache:
        return parser.parse(text)
    cache = cache or ParseCache()
    key = cache_key(text, config.LLM_PROVIDER, parser.model_id(), parser.SYSTEM_PROMPT)
    items = cache.get(key)
    if items is None:
        items = parser.parse(text)
        cache.put(key, text, items)
    return items
