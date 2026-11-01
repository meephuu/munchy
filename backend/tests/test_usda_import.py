import csv
from contextlib import closing

import pytest

from src.db import SEED_DIR, connect, seed_db
from src.usda_import import clean_name, default_serving


def write(path, header, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


@pytest.fixture
def usda_dir(tmp_path):
    d = tmp_path / "usda"
    d.mkdir()
    write(d / "food_category.csv", ["id", "code", "description"],
          [[1, "0100", "Dairy and Egg Products"], [3, "0300", "Baby Foods"], [4, "0400", "Fats and Oils"]])
    write(d / "food.csv", ["fdc_id", "data_type", "description", "food_category_id", "publication_date"], [
        [1, "sr", "Yogurt, Greek, plain, nonfat (Includes foods for USDA's Food Distribution Program)", 1, ""],
        [2, "sr", "Yogurt, Greek, plain, whole milk", 1, ""],
        [3, "sr", "Yogurt, Greek, plain, CHOBANI", 1, ""],                 # brand name -> skipped
        [4, "sr", "Babyfood, apples", 3, ""],                              # skipped category
        [5, "sr", "Beef, chuck, trimmed to 1/8\" fat, choice, raw", 1, ""],
        [6, "sr", "Beef, chuck, trimmed to 0\" fat, select, raw", 1, ""],  # same food, other trim
        [7, "sr", "Oil, olive", 4, ""],
        [8, "sr", "Mystery food", 4, ""],                                  # no energy value
        [9, "sr", "boiled egg", 1, ""],                                    # name already taken by seed
    ])
    write(d / "food_nutrient.csv", ["id", "fdc_id", "nutrient_id", "amount"], [
        [1, 1, 1008, 59], [2, 1, 1003, 10.2], [3, 1, 1004, 0.4], [4, 1, 1005, 3.6],
        [5, 2, 1008, 97], [6, 2, 1003, 9], [7, 2, 1004, 5], [8, 2, 1005, 4],
        [9, 3, 1008, 70], [10, 4, 1008, 40], [11, 5, 1008, 150], [12, 6, 1008, 140],
        [13, 7, 1008, 884], [14, 7, 1004, 100],                             # no protein/carbs rows
        [15, 9, 1008, 155],
    ])
    write(d / "food_portion.csv", ["id", "fdc_id", "seq_num", "amount", "measure_unit_id",
                                   "portion_description", "modifier", "gram_weight"], [
        [1, 1, 1, 1, 9999, "", "container (6 oz)", 170],
        [2, 7, 1, 1, 9999, "", "tbsp", 13.5], [3, 7, 2, 2, 9999, "", "tablespoon", 27],
        [4, 7, 3, 1, 9999, "", "cup", 216],
    ])
    return d


@pytest.fixture
def db(tmp_path, usda_dir):
    seed_db(tmp_path / "foods.db", SEED_DIR, usda_dir=usda_dir)
    with closing(connect(tmp_path / "foods.db")) as conn:
        yield conn


def food(db, name):
    return db.execute("SELECT * FROM foods WHERE name_en = ?", (name,)).fetchone()


def test_clean_name_drops_the_usda_program_note():
    assert clean_name("Yogurt, Greek, plain, nonfat (Includes foods for USDA's Food Distribution Program)") \
        == "Yogurt, Greek, plain, nonfat"


def test_default_serving_avoids_a_huge_first_portion():
    assert default_serving([]) == 100
    assert default_serving([(244, "cup", "cup")]) == 244                         # nothing smaller to use
    assert default_serving([(100, "cup", "cup"), (5, "tbsp", "tbsp")]) == 5     # grated parmesan
    assert default_serving([(40, "cup", "cup"), (5, "tbsp", "tbsp")]) == 40     # already small
    assert default_serving([(132, "cup", "cup, diced"), (28, "slice", "slice (1 oz)")]) == 28


def test_generic_foods_are_added_with_english_names_and_provenance(db):
    y = food(db, "Yogurt, Greek, plain, nonfat")
    assert (y["kcal_100g"], y["protein_100g"], y["fat_100g"], y["carbs_100g"]) == (59, 10.2, 0.4, 3.6)
    assert y["name_th"] is None and y["source"] == "usda" and "fdc_id 1" in y["notes"]
    assert y["default_serving_g"] == 170                     # first USDA portion
    assert food(db, "Yogurt, Greek, plain, whole milk") is not None


def test_brands_baby_food_and_no_energy_rows_are_left_out(db):
    names = {r[0] for r in db.execute("SELECT name_en FROM foods WHERE source = 'usda'")}
    assert not any("CHOBANI" in n or "Babyfood" in n or n == "Mystery food" for n in names)


def test_variants_that_differ_only_in_trim_or_grade_collapse(db):
    beef = db.execute("SELECT name_en FROM foods WHERE name_en LIKE 'Beef, chuck%'").fetchall()
    assert len(beef) == 1


def test_missing_macros_become_zero_and_no_portion_means_100_g(db):
    oil = food(db, "Oil, olive")
    assert (oil["protein_100g"], oil["carbs_100g"]) == (0, 0) and oil["default_serving_g"] == 13.5


def test_units_come_from_portions_per_one_unit(db):
    units = {r["unit"]: r["grams"] for r in db.execute(
        "SELECT unit, grams FROM food_units WHERE food_id = ?", (food(db, "Oil, olive")["id"],))}
    assert units == {"tbsp": 13.5, "cup": 216}               # 'tablespoon' (2 = 27 g) is a repeat of tbsp


def test_a_name_already_in_the_table_is_not_added_twice(db, usda_dir):
    assert db.execute("SELECT COUNT(*) FROM foods WHERE name_en = 'boiled egg'").fetchone()[0] == 1
    assert food(db, "boiled egg")["source"] == "seed"


def test_foreign_keys_stay_consistent(db):
    assert db.execute("PRAGMA foreign_key_check").fetchall() == []
