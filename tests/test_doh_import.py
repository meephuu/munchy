import csv
from contextlib import closing

import pytest

from src.db import connect, seed_db
from src.doh_import import group_of

HEADER = ["food_id", "name_th", "name_en", "kcal", "protein_g", "fat_g", "carbs_g", "fibre_g",
          "calculated_values", "pdf_page", "model", "review"]


def doh_row(food_id, name_th, kcal, protein, fat, carbs, page, review="", name_en=""):
    return dict(food_id=food_id, name_th=name_th, name_en=name_en, kcal=kcal, protein_g=protein,
                fat_g=fat, carbs_g=carbs, fibre_g="", calculated_values=0, pdf_page=page,
                model="gemini-3.5-flash", review=review)


def write_csv(path, header, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header)
        w.writeheader()
        w.writerows(rows)
    return path


@pytest.fixture
def seed_dir(tmp_path):
    """The real seed CSVs plus a doh_links.csv that points two seed foods at DoH rows."""
    import shutil
    from src.db import SEED_DIR
    dest = tmp_path / "seed"
    shutil.copytree(SEED_DIR, dest)
    write_csv(dest / "doh_links.csv", ["seed_food", "doh_food_id", "note"], [
        dict(seed_food="หมูปิ้ง", doh_food_id="5001", note=""),
        dict(seed_food="ไข่ต้ม", doh_food_id="5002", note="row is flagged, so unresolved"),
    ])
    return dest


@pytest.fixture
def doh_csv(tmp_path):
    return write_csv(tmp_path / "foods.csv", HEADER, [
        doh_row("11069", "ข้าวราดผัดผักรวม", 118, 3.12, 2.1, 21.61, 96, name_en="Rice with veg"),
        doh_row("11070", "ข้าวราดผัดแปลก", 300, 3, 2, 20, 96, review="energy 300 vs 110 from macros"),
        doh_row("1001", "กล้วยหอม", 85, 1, 0.2, 22, 47),                 # fruit page
        doh_row("1002", "ข้าวสวย", 130, 2.7, 0.3, 28, 10),               # same Thai name as a seed food
        doh_row("5001", "หมูย่างเสียบไม้", 220, 21, 14, 3, 61),           # linked to seed หมูปิ้ง
        doh_row("5002", "ไข่ต้มเค็ม", 160, 12, 11, 1, 77, review="missing value"),
    ])


@pytest.fixture
def counts(tmp_path, seed_dir, doh_csv):
    return seed_db(tmp_path / "foods.db", seed_dir, doh_csv)


@pytest.fixture
def db(tmp_path, counts):
    with closing(connect(tmp_path / "foods.db")) as conn:
        yield conn


def food(db, name):
    return db.execute("SELECT * FROM foods WHERE name_th = ?", (name,)).fetchone()


def test_group_servings_follow_the_page():
    assert group_of(96) == ("dishes", 300)
    assert group_of(47) == ("fruits", 100)
    assert group_of(10) == ("cereals", 100)
    assert group_of(999)[0] == "miscellaneous"


def test_clean_rows_are_added_with_group_serving_and_provenance(db):
    row = food(db, "ข้าวราดผัดผักรวม")
    assert (row["kcal_100g"], row["protein_100g"], row["fat_100g"], row["carbs_100g"]) == (118, 3.12, 2.1, 21.61)
    assert row["default_serving_g"] == 300 and row["source"] == "doh2018" and row["kind"] == "ingredient"
    assert "11069" in row["notes"] and "guess" in row["notes"]
    assert food(db, "กล้วยหอม")["default_serving_g"] == 100
    plate = db.execute("SELECT grams FROM food_units WHERE food_id = ? AND unit = 'จาน'",
                       (row["id"],)).fetchone()
    assert plate["grams"] == 300                                    # dishes can be counted in plates
    fruit = food(db, "กล้วยหอม")
    assert db.execute("SELECT COUNT(*) FROM food_units WHERE food_id = ?", (fruit["id"],)).fetchone()[0] == 0


def test_aliases_attach_to_imported_rows_and_skip_flagged_or_taken_names(tmp_path, seed_dir, doh_csv):
    write_csv(seed_dir / "doh_aliases.csv", ["doh_food_id", "alias", "lang"], [
        dict(doh_food_id="11069", alias="ข้าวผัดผักรวมราดข้าว", lang="th"),    # imported row
        dict(doh_food_id="11069", alias="mixed vegetable rice", lang="en"),
        dict(doh_food_id="11070", alias="ข้าวราดผัดแปลกๆ", lang="th"),          # row was flagged -> skipped
        dict(doh_food_id="11069", alias="ข้าวสวย", lang="th"),                  # already a food's name -> skipped
    ])
    path = tmp_path / "a.db"
    counts = seed_db(path, seed_dir, doh_csv)
    assert counts["doh_aliases_added"] == 2 and counts["doh_aliases_skipped"] == 2
    with closing(connect(path)) as conn:
        owner = conn.execute("""SELECT f.name_th FROM food_aliases a JOIN foods f ON f.id = a.food_id
                                WHERE a.alias = 'mixed vegetable rice'""").fetchone()
        assert owner["name_th"] == "ข้าวราดผัดผักรวม"
        assert conn.execute("PRAGMA foreign_key_check").fetchall() == []


def test_printed_serving_size_beats_the_group_guess(tmp_path, seed_dir):
    rows = [dict(doh_row("12001", "กล้วยแขก", 315, 2.3, 15.9, 37.8, 110), serving_g=27),
            dict(doh_row("12002", "ขนมกล้วย", 182, 1.3, 2.7, 37.9, 110), serving_g="")]
    csv_path = write_csv(tmp_path / "foods3.csv", HEADER + ["serving_g"], rows)
    path = tmp_path / "s.db"
    seed_db(path, seed_dir, csv_path)
    with closing(connect(path)) as conn:
        assert food(conn, "กล้วยแขก")["default_serving_g"] == 27
        assert "serving size from the DoH table" in food(conn, "กล้วยแขก")["notes"]
        assert food(conn, "ขนมกล้วย")["default_serving_g"] == 80          # desserts group guess


def test_rows_with_unverified_thai_names_are_marked(tmp_path, seed_dir):
    rows = [dict(doh_row("2001", "ปลาทุน่า", 120, 20, 4, 1, 99), name_verified=0),
            dict(doh_row("2002", "ปลาทูน่า", 120, 20, 4, 1, 99), name_verified=1)]
    csv_path = write_csv(tmp_path / "foods2.csv", HEADER + ["name_verified"], rows)
    path = tmp_path / "v.db"
    seed_db(path, seed_dir, csv_path)
    with closing(connect(path)) as conn:
        assert "not verified" in food(conn, "ปลาทุน่า")["notes"]
        assert "not verified" not in food(conn, "ปลาทูน่า")["notes"]


def test_flagged_rows_are_not_imported(db, counts):
    assert food(db, "ข้าวราดผัดแปลก") is None
    assert counts["doh_skipped_review"] == 2             # the flagged dish and the flagged egg


def test_duplicate_thai_name_is_disambiguated_not_dropped(db):
    assert food(db, "ข้าวสวย")["source"] == "seed"           # the seed food keeps its name
    assert food(db, "ข้าวสวย (1002)")["kcal_100g"] == 130


def test_link_replaces_placeholder_values_but_keeps_the_seed_food(db):
    pork = food(db, "หมูปิ้ง")
    assert (pork["kcal_100g"], pork["protein_100g"], pork["fat_100g"], pork["carbs_100g"]) == (220, 21, 14, 3)
    assert pork["source"] == "doh2018" and "5001" in pork["notes"]
    assert pork["default_serving_g"] == 30                    # seed serving and units are kept
    assert food(db, "หมูย่างเสียบไม้") is None                # not added a second time
    n_units = db.execute("SELECT COUNT(*) FROM food_units WHERE food_id = ?", (pork["id"],)).fetchone()[0]
    assert n_units == 2


def test_link_to_a_flagged_row_is_left_unresolved_and_the_placeholder_stays(db, counts):
    assert food(db, "ไข่ต้ม")["source"] == "seed"
    assert counts["doh_links_applied"] == 1 and counts["doh_links_unresolved"] == 1


def test_combos_still_work_after_import(db):
    rows = db.execute("""SELECT COUNT(*) FROM combo_components c
                         JOIN foods f ON f.id = c.component_id""").fetchone()[0]
    assert rows == 8
    assert db.execute("PRAGMA foreign_key_check").fetchall() == []


def test_link_to_an_unknown_seed_food_fails_loudly(tmp_path, seed_dir, doh_csv):
    write_csv(seed_dir / "doh_links.csv", ["seed_food", "doh_food_id", "note"],
              [dict(seed_food="ไม่มีอาหารนี้", doh_food_id="5001", note="")])
    with pytest.raises(ValueError, match="matched 0 rows"):
        seed_db(tmp_path / "x.db", seed_dir, doh_csv)


def test_seed_without_doh_is_unchanged(tmp_path, seed_dir):
    counts = seed_db(tmp_path / "plain.db", seed_dir)
    assert counts["foods"] == 34 and "doh_added" not in counts
