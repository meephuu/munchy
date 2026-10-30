"""Decision logic of the DoH table extraction (no PDF, no API)."""
import pytest

from extract_doh_table import (DailyQuotaExceeded, attach_serving_rows, check, name_problem,
                               number, parse_range)


@pytest.mark.parametrize("text, expected", [
    ("105", (105.0, False)), ("(15.36)", (15.36, True)), (" 4.29 ", (4.29, False)),
    ("1,234", (1234.0, False)), ("-", (None, False)), (None, (None, False)), ("(-)", (None, True)),
])
def test_number(text, expected):
    assert number(text) == expected


def test_check_accepts_consistent_rows_and_counts_fibre():
    assert check(105, 4.29, 2.92, 15.36, None) == ""
    assert check(61, 2.0, 0.3, 8.0, 7.0) == ""           # fibre adds ~2 kcal/g: 8+1.2... +2.7+14
    assert check(61, 2.0, 0.3, 8.0, None) != ""          # without the fibre it would not add up


@pytest.mark.parametrize("args, reason", [
    ((None, 1, 1, 1, None), "missing"),
    ((80, 85, 10, 15, None), "exceed"),                  # water read as protein: 110 g in 100 g
    ((80, 85, 7, 5, 1.8), "energy"),                     # ...or a smaller shift that the energy check catches
    ((300, 3, 2, 20, None), "energy"),
])
def test_check_flags_bad_rows(args, reason):
    assert reason in check(*args)


@pytest.mark.parametrize("name, flagged", [
    ("ข้าวราดผัดผักรวม", False), ("ปลาทูน่า, ในน้ำมันพืช", False), ("Pad Thai", False),
    ("มะม่วง, แก้ว, ดິບ", True),            # Lao letters in a Thai name
    ("ข้าว่่ผัด", True),                     # doubled tone marks
    ("่ข้าว", True),                    # starts with a combining mark
])
def test_name_problem(name, flagged):
    assert bool(name_problem(name)) is flagged


def row(food_id, page, kcal, protein, fat, carbs):
    return {"food_id": food_id, "pdf_page": page, "kcal": kcal, "protein_g": protein,
            "fat_g": fat, "carbs_g": carbs, "review": ""}


def test_serving_row_becomes_serving_size_and_is_dropped():
    rows = attach_serving_rows([row("12001", 110, 315, 2.3, 15.9, 37.8),
                                row("12001", 110, 85, 0.62, 4.29, 10.21)])   # "1 piece (27 g)"
    assert len(rows) == 1 and rows[0]["serving_g"] == 27 and rows[0]["review"] == ""


def test_inconsistent_duplicate_keeps_its_flag():
    rows = attach_serving_rows([row("1", 110, 300, 10, 10, 40), row("1", 110, 90, 1, 1, 80)])
    assert len(rows) == 2 and "duplicate" in rows[1]["review"] and rows[0]["serving_g"] == ""


def test_same_id_on_another_page_is_a_duplicate_not_a_serving():
    rows = attach_serving_rows([row("7", 20, 100, 5, 2, 10), row("7", 30, 50, 2.5, 1, 5)])
    assert len(rows) == 2 and "duplicate" in rows[1]["review"]


def test_rows_without_a_duplicate_are_untouched():
    rows = attach_serving_rows([row("1", 5, 100, 1, 1, 1), row("2", 5, 50, 1, 1, 1)])
    assert [r["serving_g"] for r in rows] == ["", ""]


def test_parse_range_accepts_lists_and_ranges():
    assert parse_range("96-97") == [96, 97]
    assert parse_range("23,31,89-91") == [23, 31, 89, 90, 91]
    with pytest.raises(Exception):
        parse_range("a-b")


def test_daily_quota_wait_is_read_from_the_error_message():
    e = DailyQuotaExceeded("limit exceeded. Please retry in 15h13m20.79s.")
    assert e.wait_seconds == pytest.approx(15 * 3600 + 13 * 60 + 20.79)
    assert DailyQuotaExceeded("no hint here").wait_seconds == 3600
