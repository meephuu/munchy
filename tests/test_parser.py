import json

import pytest

from src import config
from src.parser import LLMParser, ParseError, ParsedItem, parse


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
