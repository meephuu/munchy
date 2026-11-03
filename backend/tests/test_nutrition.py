import csv
import shutil
from contextlib import closing

import pytest

from src.db import SEED_DIR, connect, display_name, seed_db
from src.matcher import Match
from src.nutrition import CalcError, calculate
from src.parser import ParsedItem


def _seed_english() -> dict[str, str]:
    with open(SEED_DIR / "foods.csv", encoding="utf-8-sig", newline="") as f:
        return {r["name_th"]: r["name_en"] for r in csv.DictReader(f) if r["name_th"] and r["name_en"]}


EN = _seed_english()                      # results show English names; tests are written in Thai
TH = {en: th for th, en in EN.items()}


@pytest.fixture(scope="module")
def db_path(tmp_path_factory):
    path = tmp_path_factory.mktemp("db") / "foods.db"
    seed_db(path)
    return path


def pair(db_path, food, qty=None, unit=None, text=None):
    """(ParsedItem, Match) as the pipeline would produce for an exactly matched name."""
    with closing(connect(db_path)) as conn:
        r = conn.execute("SELECT * FROM foods WHERE name_th = ?", (food,)).fetchone()
    return (ParsedItem(food=text or food, qty=qty, unit=unit),
            Match(r["id"], display_name(r), r["kind"], 1.0, "exact", food))


def estimate(db_path, *specs):
    return calculate([pair(db_path, *s) for s in specs], db_path)


def by_name(est):
    return {TH[l.name]: l for l in est.lines}      # keyed by the Thai seed name


# --- reference input 1: ข้าวเหนียวหมูปิ้ง 5 ไม้ ---------------------------------------------

def test_input1_quantity_attaches_to_pork_not_rice(db_path):
    est = estimate(db_path, ("ข้าวเหนียวหมูปิ้ง", 5, "ไม้"))
    lines = by_name(est)
    assert lines["หมูปิ้ง"].grams == 150          # 5 sticks x 30 g
    assert lines["ข้าวเหนียวนึ่ง"].grams == 90    # default 1 ห่อ
    assert est.kcal == pytest.approx(150 * 2.5 + 90 * 1.69)          # 527.1
    assert est.protein == pytest.approx(150 * 0.20 + 90 * 0.038)
    assert est.fat == pytest.approx(150 * 0.17 + 90 * 0.004)
    assert est.carbs == pytest.approx(150 * 0.05 + 90 * 0.37)


def test_input1_reports_rice_assumption_but_not_pork(db_path):
    est = estimate(db_path, ("ข้าวเหนียวหมูปิ้ง", 5, "ไม้"))
    assert any("sticky rice" in a for a in est.assumptions)
    assert by_name(est)["หมูปิ้ง"].assumptions == []


def test_combo_without_quantity_uses_all_defaults(db_path):
    est = estimate(db_path, ("ข้าวเหนียวหมูปิ้ง",))
    assert by_name(est)["หมูปิ้ง"].grams == 90       # 3 sticks
    assert len(est.assumptions) == 2


# --- reference input 2: salad with extras ---------------------------------------------

def test_input2_salad_defaults_plus_user_extras(db_path):
    est = estimate(db_path, ("สลัดอกไก่",), ("แตงกวา",), ("มะเขือเทศ",), ("ไข่ต้ม", 1, "ฟอง"))
    lines = by_name(est)
    assert {n: l.grams for n, l in lines.items()} == {
        "ผักสลัด": 100, "อกไก่ย่าง": 120, "น้ำสลัดครีม": 30,   # combo defaults (2 tbsp = 30 g)
        "แตงกวา": 50, "มะเขือเทศ": 60,                        # default servings
        "ไข่ต้ม": 50,                                         # 1 ฟอง
    }
    assert any("default dressing" in a for a in est.assumptions)
    assert lines["ไข่ต้ม"].assumptions == []               # user gave qty and unit


def test_user_item_replaces_matching_combo_component(db_path):
    est = estimate(db_path, ("สลัดอกไก่",), ("อกไก่ย่าง", 2, "ชิ้น"))
    chicken = [l for l in est.lines if l.name == EN["อกไก่ย่าง"]]
    assert [l.grams for l in chicken] == [240]
    assert any("instead of the default" in a for a in est.notes)


# --- reference input 3 ----------------------------------------------------------------

def test_input3_cheese_mashed_potato_defaults(db_path):
    est = estimate(db_path, ("มันบดชีสราดเกรวี่",))
    assert {n: l.grams for n, l in by_name(est).items()} == {
        "มันฝรั่งบด": 150, "ชีสเชดดาร์": 20, "เกรวี่": 30}
    assert len(est.assumptions) == 3


def test_combo_quantity_goes_to_the_flagged_component(db_path):
    est = estimate(db_path, ("มันบดชีสราดเกรวี่", 2, "จาน"))
    assert by_name(est)["มันฝรั่งบด"].grams == 300


# --- unit rules on a plain ingredient -------------------------------------------------

@pytest.mark.parametrize("qty, unit, grams, assumed", [
    (2, "ฟอง", 100, False),
    (80, "g", 80, False),
    (80, "กรัม", 80, False),
    (0.2, "kg", 200, False),
    (None, None, 50, True),        # default serving
    (3, None, 150, True),          # qty without unit = servings
    (None, "ฟอง", 50, True),       # unit without number = 1 of it
    (2, "ลูกบาศก์", 100, True),    # unknown unit -> servings, with a warning
])
def test_unit_rules(db_path, qty, unit, grams, assumed):
    est = estimate(db_path, ("ไข่ต้ม", qty, unit))
    assert est.lines[0].grams == grams
    assert bool(est.assumptions) is assumed


def test_unknown_unit_warning_names_the_unit(db_path):
    est = estimate(db_path, ("ไข่ต้ม", 2, "ลูกบาศก์"))
    assert "ลูกบาศก์" in est.assumptions[0]


def test_english_mass_units_and_synonyms(db_path):
    assert estimate(db_path, ("ไข่ต้ม", 2, "oz")).lines[0].grams == pytest.approx(56.699)
    assert estimate(db_path, ("ไข่ต้ม", 1, "lb")).lines[0].grams == pytest.approx(453.592)


def test_unit_synonym_finds_the_stored_unit(db_path, tmp_path):
    path = edited_db(db_path, tmp_path, "INSERT INTO food_units (food_id, unit, grams) "
                     "SELECT id, 'tbsp', 14 FROM foods WHERE name_th = 'น้ำมันพืช'")
    est = calculate([pair(path, "น้ำมันพืช", 2, "Tablespoons")], path)
    assert est.lines[0].grams == 28 and est.assumptions == []


def test_nutrients_scale_per_100g(db_path):
    est = estimate(db_path, ("ไข่ต้ม", 100, "g"))
    assert (est.kcal, est.protein, est.fat, est.carbs) == pytest.approx((155, 12.6, 10.6, 1.1))


# --- cooking oil ----------------------------------------------------------------------

def test_fried_food_reports_that_its_values_include_oil(db_path):
    est = estimate(db_path, ("ไข่ดาว", 2, "ฟอง"))
    assert est.lines[0].grams == 92
    assert any(EN["ไข่ดาว"] in a and "frying oil" in a for a in est.assumptions)


def test_oil_note_comes_in_addition_to_other_assumptions(db_path):
    est = estimate(db_path, ("ไก่ทอด",))          # no quantity -> default serving AND oil note
    assert len(est.assumptions) == 2


def test_boiled_or_grilled_food_has_no_oil_note(db_path):
    assert estimate(db_path, ("ไข่ต้ม", 1, "ฟอง")).assumptions == []


def test_oil_note_follows_a_food_used_as_combo_component(db_path, tmp_path):
    path = edited_db(db_path, tmp_path,
                     "UPDATE foods SET oil_note = 'values include oil' WHERE name_th = 'หมูปิ้ง'")
    est = calculate([pair(path, "ข้าวเหนียวหมูปิ้ง", 5, "ไม้")], path)
    assert by_name(est)["หมูปิ้ง"].assumptions == [f"{EN['หมูปิ้ง']}: values include oil"]


# --- edge cases that need a modified DB -----------------------------------------------

def edited_db(db_path, tmp_path, sql, *params):
    path = tmp_path / "edited.db"
    shutil.copy(db_path, path)
    with closing(connect(path)) as conn, conn:
        conn.execute(sql, params)
    return path


def test_combo_quantity_is_reported_ignored_when_no_component_takes_it(db_path, tmp_path):
    path = edited_db(db_path, tmp_path, "UPDATE combo_components SET takes_user_qty = 0")
    est = calculate([pair(path, "สลัดอกไก่", 2, "ชิ้น")], path)
    assert any("ignored" in a for a in est.assumptions)
    assert by_name(est)["อกไก่ย่าง"].grams == 120


def test_nested_combo_is_expanded(db_path, tmp_path):
    # make มันบดชีสราดเกรวี่ a component of สลัดอกไก่
    path = edited_db(
        db_path, tmp_path,
        """INSERT INTO combo_components (combo_id, component_id, default_qty, default_unit,
               takes_user_qty, assumption_note, sort_order)
           SELECT a.id, b.id, 1, NULL, 0, 'assumed a side of mashed potato', 9
           FROM foods a, foods b WHERE a.name_th = 'สลัดอกไก่' AND b.name_th = 'มันบดชีสราดเกรวี่'""")
    est = calculate([pair(path, "สลัดอกไก่")], path)
    assert by_name(est)["มันฝรั่งบด"].grams == 150
    assert any("side of mashed potato" in a for a in est.assumptions)


def test_combo_cycle_raises(db_path, tmp_path):
    path = edited_db(
        db_path, tmp_path,
        """INSERT INTO combo_components (combo_id, component_id, default_qty, takes_user_qty)
           SELECT a.id, b.id, 1, 0 FROM foods a, foods b
           WHERE (a.name_th, b.name_th) IN (('สลัดอกไก่', 'มันบดชีสราดเกรวี่'),
                                            ('มันบดชีสราดเกรวี่', 'สลัดอกไก่'))""")
    with pytest.raises(CalcError, match="too deep"):
        calculate([pair(path, "สลัดอกไก่")], path)


def test_lines_carry_the_units_their_food_is_counted_in(db_path):
    est = estimate(db_path, ("ข้าวเหนียวหมูปิ้ง", 5, "ไม้"))
    by = {l.name: l.units for l in est.lines}
    assert by[EN["หมูปิ้ง"]] == [("skewer", 30.0), ("piece", 30.0)]
    assert dict(by[EN["ข้าวเหนียวนึ่ง"]]).get("pack") == 90
