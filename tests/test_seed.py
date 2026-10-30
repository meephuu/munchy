import shutil
from contextlib import closing

import pytest

from src.db import SEED_DIR, connect, seed_db


@pytest.fixture(scope="module")
def db(tmp_path_factory):
    path = tmp_path_factory.mktemp("db") / "foods.db"
    seed_db(path)
    with closing(connect(path)) as conn:
        yield conn


def food(db, name):
    return db.execute(
        "SELECT * FROM foods WHERE name_th = ? OR name_en = ?", (name, name)).fetchone()


def components(db, combo):
    return db.execute(
        """SELECT f.name_th, c.* FROM combo_components c
           JOIN foods f ON f.id = c.component_id
           WHERE c.combo_id = ? ORDER BY c.sort_order""",
        (food(db, combo)["id"],)).fetchall()


def has_unit(db, name, unit):
    return db.execute("SELECT 1 FROM food_units WHERE food_id = ? AND unit = ?",
                      (food(db, name)["id"], unit)).fetchone() is not None


def test_seed_size(db):
    assert db.execute("SELECT COUNT(*) FROM foods").fetchone()[0] >= 30
    assert db.execute("SELECT COUNT(*) FROM foods WHERE kind='combo'").fetchone()[0] == 3


def test_no_dangling_references(db):
    assert db.execute("PRAGMA foreign_key_check").fetchall() == []


def test_every_combo_has_components_with_assumptions(db):
    for combo in db.execute("SELECT name_th FROM foods WHERE kind='combo'"):
        rows = components(db, combo["name_th"])
        assert rows, f"{combo['name_th']} has no components"
        assert all(r["assumption_note"] for r in rows)


def test_default_units_exist_for_components(db):
    for r in db.execute("""SELECT c.default_unit, f.name_th FROM combo_components c
                           JOIN foods f ON f.id = c.component_id
                           WHERE c.default_unit IS NOT NULL"""):
        assert has_unit(db, r["name_th"], r["default_unit"]), (r["name_th"], r["default_unit"])


def test_input1_sticky_rice_pork_skewers(db):
    rows = components(db, "ข้าวเหนียวหมูปิ้ง")
    assert [r["name_th"] for r in rows if r["takes_user_qty"]] == ["หมูปิ้ง"]
    assert {r["name_th"] for r in rows} == {"ข้าวเหนียวนึ่ง", "หมูปิ้ง"}
    assert has_unit(db, "หมูปิ้ง", "ไม้")


def test_input2_chicken_salad(db):
    assert {r["name_th"] for r in components(db, "สลัดอกไก่")} >= {"อกไก่ย่าง", "น้ำสลัดครีม"}
    assert has_unit(db, "ไข่ต้ม", "ฟอง")
    assert food(db, "แตงกวา") and food(db, "มะเขือเทศ")


def test_input3_cheese_mashed_potato_by_alias(db):
    row = db.execute(
        """SELECT f.name_th, f.kind FROM food_aliases a JOIN foods f ON f.id = a.food_id
           WHERE a.alias = 'cheese mashed potato with gravy sauce'""").fetchone()
    assert row["kind"] == "combo"
    assert len(components(db, row["name_th"])) == 3


def test_unknown_food_name_fails_loudly(tmp_path):
    seed = tmp_path / "seed"
    shutil.copytree(SEED_DIR, seed)
    with open(seed / "food_units.csv", "a", encoding="utf-8") as f:
        f.write("ไม่มีอาหารนี้,ชิ้น,10\n")
    with pytest.raises(ValueError, match="unknown food"):
        seed_db(tmp_path / "x.db", seed)
