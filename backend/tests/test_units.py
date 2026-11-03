import sqlite3
from contextlib import closing

import pytest

from src.db import connect, seed_db
from src.units import MAX_UNITS, label, unit_options, units_for


def test_thai_units_get_english_labels_and_unknown_ones_are_kept():
    assert [label(u) for u in ("ฟอง", "ไม้", "ช้อนโต๊ะ", "จาน")] == ["egg", "skewer", "tbsp", "plate"]
    assert label("tbsp") == "tbsp" and label(" cup ") == "cup" and label("ลูกพิเศษ") == "ลูกพิเศษ"


def test_unit_options_drop_grams_catch_alls_and_bad_weights():
    rows = [("g", 1), ("unit", 30), ("item", 30), ("cup", 0), ("cup", -5), ("slice", 28.0)]
    assert unit_options(rows) == [("slice", 28.0)]


def test_unit_options_keep_one_entry_per_label_the_first():
    assert unit_options([("ชิ้น", 30), ("piece", 99), ("แผ่น", 20), ("slice", 25)]) == [("piece", 30.0), ("slice", 20.0)]


def test_unit_options_are_capped_and_keep_their_order():
    rows = [(f"u{i}", 10.0 + i) for i in range(10)]
    out = unit_options(rows)
    assert len(out) == MAX_UNITS and [u for u, _ in out] == [f"u{i}" for i in range(MAX_UNITS)]


@pytest.fixture(scope="module")
def conn(tmp_path_factory):
    path = tmp_path_factory.mktemp("db") / "foods.db"
    seed_db(path)
    with closing(connect(path)) as c:
        yield c


def ids(conn, *names):
    return [conn.execute("SELECT id FROM foods WHERE name_en = ?", (n,)).fetchone()[0] for n in names]


def test_units_for_reads_a_foods_units_in_english(conn):
    egg, pork, bare = ids(conn, "boiled egg", "grilled pork skewer", "vegetable oil")
    got = units_for(conn, [egg, pork, bare])
    assert got[egg] == [("egg", 50.0)]
    assert got[pork] == [("skewer", 30.0), ("piece", 30.0)]
    assert isinstance(got[bare], list)


def test_units_for_nothing_is_empty(conn):
    assert units_for(conn, []) == {}
