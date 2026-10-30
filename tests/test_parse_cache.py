import json
import sqlite3
from contextlib import closing

import pytest

import cli
from src import config, parser, pipeline
from src.nutrition import Estimate
from src.parse_cache import ParseCache, cache_key, cached_parse
from src.parser import LLMParser, ParsedItem, ParseError

GOOD = json.dumps({"items": [{"food": "หมูปิ้ง", "qty": 5, "unit": "ไม้"}]}, ensure_ascii=False)


@pytest.fixture
def cache(tmp_path):
    return ParseCache(tmp_path / "cache.db")


@pytest.fixture
def llm(monkeypatch):
    """Replace the real LLM with a counter; `llm.output` is what it will 'return'."""
    class Fake:
        calls = 0
        output = GOOD

    fake = Fake()

    def complete(text):
        fake.calls += 1
        return fake.output

    monkeypatch.setattr(parser, "get_parser", lambda: LLMParser(complete))
    return fake


def test_second_call_is_served_from_cache(cache, llm):
    first = cached_parse("หมูปิ้ง 5 ไม้", cache=cache)
    second = cached_parse("หมูปิ้ง 5 ไม้", cache=cache)
    assert llm.calls == 1
    assert first == second == [ParsedItem(food="หมูปิ้ง", qty=5, unit="ไม้")]


def test_trivial_spelling_differences_share_an_entry(cache, llm):
    cached_parse("Cheese  mashed potato", cache=cache)
    cached_parse("  cheese mashed POTATO ", cache=cache)
    assert llm.calls == 1


def test_different_text_is_a_miss(cache, llm):
    cached_parse("หมูปิ้ง 5 ไม้", cache=cache)
    cached_parse("หมูปิ้ง 6 ไม้", cache=cache)
    assert llm.calls == 2


def test_changed_prompt_or_model_is_a_miss(cache, llm, monkeypatch):
    cached_parse("x", cache=cache)
    monkeypatch.setattr(parser, "SYSTEM_PROMPT", parser.SYSTEM_PROMPT + "\nnew rule")
    cached_parse("x", cache=cache)
    assert llm.calls == 2
    monkeypatch.setattr(config, "GEMINI_MODEL", "some-other-model")
    cached_parse("x", cache=cache)
    assert llm.calls == 3


def test_entries_survive_a_new_cache_object(tmp_path, llm):
    cached_parse("x", cache=ParseCache(tmp_path / "c.db"))
    cached_parse("x", cache=ParseCache(tmp_path / "c.db"))
    assert llm.calls == 1


def test_failed_parse_is_not_cached(cache, llm):
    llm.output = "not json"
    with pytest.raises(ParseError):
        cached_parse("x", cache=cache)
    llm.output = GOOD
    assert cached_parse("x", cache=cache)[0].food == "หมูปิ้ง"   # asked the LLM again
    with closing(sqlite3.connect(cache.path)) as conn:
        assert conn.execute("SELECT COUNT(*) FROM parse_cache").fetchone()[0] == 1


def test_use_cache_false_bypasses_reads_and_writes(cache, llm):
    cached_parse("x", use_cache=False, cache=cache)
    cached_parse("x", use_cache=False, cache=cache)
    assert llm.calls == 2
    assert not cache.path.exists()


def test_cache_hit_needs_no_api_key(cache, monkeypatch):
    key = cache_key("x", config.LLM_PROVIDER, parser.model_id(), parser.SYSTEM_PROMPT)
    cache.put(key, "x", [ParsedItem(food="ไข่ต้ม", qty=1, unit="ฟอง")])

    def no_key():
        raise RuntimeError("GEMINI_API_KEY is empty")

    monkeypatch.setattr(parser, "get_parser", no_key)
    assert cached_parse("x", cache=cache)[0].food == "ไข่ต้ม"


def test_corrupt_entry_is_treated_as_a_miss_and_repaired(cache, llm):
    cached_parse("x", cache=cache)
    with closing(sqlite3.connect(cache.path)) as conn, conn:
        conn.execute("UPDATE parse_cache SET result = '{broken'")
    assert cached_parse("x", cache=cache)[0].food == "หมูปิ้ง"
    assert llm.calls == 2
    cached_parse("x", cache=cache)
    assert llm.calls == 2                                      # repaired entry now hits


# --- wiring ---------------------------------------------------------------------------

def test_pipeline_passes_use_cache_through(monkeypatch):
    seen = {}

    def fake_cached_parse(text, *, use_cache=True):
        seen["use_cache"] = use_cache
        return []

    monkeypatch.setattr(pipeline, "cached_parse", fake_cached_parse)
    monkeypatch.setattr(pipeline, "Matcher", lambda db_path: None)
    monkeypatch.setattr(pipeline, "calculate", lambda pairs, db_path: Estimate([]))
    pipeline.estimate("x", use_cache=False)
    assert seen == {"use_cache": False}
    pipeline.estimate("x")
    assert seen == {"use_cache": True}


@pytest.mark.parametrize("flags, expected", [([], True), (["--no-cache"], False)])
def test_cli_no_cache_flag(flags, expected, monkeypatch, tmp_path, capsys):
    seen = {}

    def fake_estimate(text, *, use_cache=True):
        seen["use_cache"] = use_cache
        return Estimate([])

    db = tmp_path / "foods.db"
    db.touch()
    monkeypatch.setattr(config, "DB_PATH", db)
    monkeypatch.setattr(pipeline, "estimate", fake_estimate)
    cli.main(["x", *flags])
    assert seen["use_cache"] is expected
