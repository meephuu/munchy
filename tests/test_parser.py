import json

import pytest

from src import config
from src.parser import LLMParser, ParseError, ParsedItem, parse


GOOD_OLLAMA = json.dumps({"items": [{"food": "หมูปิ้ง", "qty": 5, "unit": "ไม้"}]}, ensure_ascii=False)


def fake(*outputs: str):
    """A `complete` function that returns the given raw outputs in order."""
    calls = iter(outputs)

    def complete(text: str) -> str:
        return next(calls)

    return complete


def items_json(*items: dict) -> str:
    return json.dumps({"items": list(items)}, ensure_ascii=False)


def test_valid_output_is_parsed():
    raw = items_json({"food": "หมูปิ้ง ", "qty": 5, "unit": "ไม้"}, {"food": "แตงกวา"})
    items = LLMParser(fake(raw)).parse("x")
    assert items == [ParsedItem(food="หมูปิ้ง", qty=5, unit="ไม้"),
                     ParsedItem(food="แตงกวา", qty=None, unit=None)]


def test_blank_unit_becomes_none():
    raw = items_json({"food": "ไข่ต้ม", "qty": 1, "unit": "  "})
    assert LLMParser(fake(raw)).parse("x")[0].unit is None


@pytest.mark.parametrize("bad", [
    "not json at all",
    items_json(),                                          # empty list
    items_json({"food": "หมูปิ้ง", "qty": -1, "unit": "ไม้"}),
    items_json({"food": "หมูปิ้ง", "qty": 0, "unit": "ไม้"}),
    items_json({"food": "", "qty": 1, "unit": "ไม้"}),
    json.dumps({"foods": []}),                             # wrong shape
])
def test_invalid_output_raises_after_retry(bad):
    with pytest.raises(ParseError):
        LLMParser(fake(bad, bad)).parse("x")


def test_retry_recovers_from_one_bad_output():
    good = items_json({"food": "ข้าวสวย", "qty": 1, "unit": "จาน"})
    assert LLMParser(fake("oops", good)).parse("x")[0].food == "ข้าวสวย"


def test_blank_input_never_calls_llm():
    def boom(text):
        raise AssertionError("LLM should not be called")

    with pytest.raises(ParseError):
        LLMParser(boom).parse("   ")


# --- Ollama backend (mocked HTTP) -------------------------------------------------------

def ollama_client(handler):
    import httpx
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_ollama_sends_schema_and_prompt_and_returns_the_message_content():
    import httpx
    from src.parser import SYSTEM_PROMPT, ParseResult, ollama_complete

    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"message": {"role": "assistant", "content": GOOD_OLLAMA}})

    complete = ollama_complete("qwen2.5:7b", "http://ollama:11434/", ollama_client(handler))
    items = LLMParser(complete).parse("หมูปิ้ง 5 ไม้")
    assert items == [ParsedItem(food="หมูปิ้ง", qty=5, unit="ไม้")]
    assert seen["url"] == "http://ollama:11434/api/chat"
    body = seen["body"]
    assert body["model"] == "qwen2.5:7b" and body["stream"] is False
    assert body["format"] == ParseResult.model_json_schema()
    assert body["messages"] == [{"role": "system", "content": SYSTEM_PROMPT},
                                {"role": "user", "content": "หมูปิ้ง 5 ไม้"}]
    assert body["options"]["temperature"] == 0


def test_ollama_unreachable_server_is_a_setup_error():
    import httpx
    from src.parser import ollama_complete

    def handler(request):
        raise httpx.ConnectError("connection refused")

    with pytest.raises(RuntimeError, match="is it running"):
        ollama_complete("m", "http://localhost:11434", ollama_client(handler))("x")


def test_ollama_missing_model_tells_you_to_pull_it():
    import httpx
    from src.parser import ollama_complete

    complete = ollama_complete("typhoon", "http://x", ollama_client(lambda r: httpx.Response(404)))
    with pytest.raises(RuntimeError, match="ollama pull typhoon"):
        complete("x")


def test_ollama_bad_output_still_goes_through_validation_and_retry():
    import httpx
    from src.parser import ollama_complete

    replies = iter(["not json", GOOD_OLLAMA])
    complete = ollama_complete("m", "http://x", ollama_client(
        lambda r: httpx.Response(200, json={"message": {"content": next(replies)}})))
    assert LLMParser(complete).parse("x")[0].food == "หมูปิ้ง"


def test_provider_selection_follows_the_config(monkeypatch):
    from src import parser as parser_module

    monkeypatch.setattr(config, "LLM_PROVIDER", "ollama")
    monkeypatch.setattr(config, "OLLAMA_MODEL", "qwen2.5:7b")
    assert parser_module.model_id() == "qwen2.5:7b"
    assert isinstance(parser_module.get_parser(), LLMParser)       # no server needed to build it
    monkeypatch.setattr(config, "LLM_PROVIDER", "nope")
    with pytest.raises(RuntimeError, match="gemini, ollama"):
        parser_module.get_parser()


# --- real API: run with `pytest -m live` ---------------------------------------------

needs_key = pytest.mark.skipif(not config.GEMINI_API_KEY, reason="no GEMINI_API_KEY in .env")


@pytest.mark.live
@needs_key
def test_live_input1_combo_stays_whole():
    items = parse("ข้าวเหนียวหมูปิ้ง 5 ไม้")
    assert [(i.food, i.qty, i.unit) for i in items] == [("ข้าวเหนียวหมูปิ้ง", 5, "ไม้")]


@pytest.mark.live
@needs_key
def test_live_input2_salad_with_extras():
    items = parse("สลัดอกไก่ ใส่แตงกวา มะเขือเทศ ไข่ต้ม 1 ฟอง")
    assert [i.food for i in items] == ["สลัดอกไก่", "แตงกวา", "มะเขือเทศ", "ไข่ต้ม"]
    egg = items[-1]
    assert (egg.qty, egg.unit) == (1, "ฟอง")
    assert all(i.qty is None for i in items[:-1])


@pytest.mark.live
@needs_key
def test_live_input3_english_dish_stays_whole():
    items = parse("cheese mashed potato with gravy sauce")
    assert len(items) == 1
    assert items[0].food.lower() == "cheese mashed potato with gravy sauce"
    assert items[0].qty is None


def test_english_name_is_optional_and_cleaned():
    assert ParsedItem(food="ไข่ต้ม").food_en is None and ParsedItem(food="ไข่ต้ม").label == "ไข่ต้ม"
    item = ParsedItem(food="ไข่ต้ม", food_en="  boiled egg ")
    assert item.food_en == "boiled egg" and item.label == "boiled egg"
    assert ParsedItem(food="ไข่ต้ม", food_en="  ").food_en is None
