"""Step 11: load the transcribed Department of Health Thai food table into the database.

Input is data/processed/doh2018/foods.csv, produced by extract_doh_table.py (not in git:
the table's licence is unclear, see CLAUDE.md). Two things happen:
  1. every row that passed the energy-vs-macros check is added as an ingredient with
     source='doh2018';
  2. data/seed/doh_links.csv maps hand-seeded placeholder foods to their DoH row, whose
     real values then replace the placeholders (combos keep pointing at the same food).
The table has no portion sizes, so default servings come from the food group: a rough,
documented guess that the CLI reports as an assumption whenever it is used.
"""
import csv
import sqlite3
from pathlib import Path

from src import config

DOH_CSV = config.ROOT / "data" / "processed" / "doh2018" / "foods.csv"
LINKS_CSV = config.ROOT / "data" / "seed" / "doh_links.csv"
ALIASES_CSV = config.ROOT / "data" / "seed" / "doh_aliases.csv"   # popular dish names -> DoH ids
ENGLISH_CSV = config.ROOT / "data" / "seed" / "doh_english.csv"   # English names missing in the table

# (first PDF page, last PDF page, group, default serving in grams). PDF page = printed page + 2.
# Serving sizes are guesses for "one typical portion", not measured data.
GROUPS = [
    (9, 14, "cereals", 100), (15, 18, "starchy roots", 100), (19, 24, "pulses, seeds, nuts", 50),
    (25, 44, "vegetables", 80), (45, 58, "fruits", 100), (59, 64, "meat and poultry", 100),
    (65, 74, "fish and seafood", 100), (75, 78, "eggs", 50), (79, 84, "milk products", 200),
    (85, 88, "spices and condiments", 10), (89, 108, "dishes", 300),
    (109, 116, "desserts and bakery", 80), (117, 118, "insects", 30), (119, 130, "miscellaneous", 50),
]


def group_of(pdf_page: int) -> tuple[str, float]:
    for first, last, name, serving in GROUPS:
        if first <= pdf_page <= last:
            return name, serving
    return "miscellaneous", 50


def _read(path: Path) -> list[dict]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def import_doh(conn: sqlite3.Connection, doh_csv: Path = DOH_CSV,
               links_csv: Path = LINKS_CSV, aliases_csv: Path | None = None) -> dict[str, int]:
    """Add DoH foods, apply the seed links and extra aliases. Returns counts (and what was
    left out). aliases_csv defaults to doh_aliases.csv next to links_csv."""
    aliases_csv = aliases_csv or links_csv.with_name(ALIASES_CSV.name)
    rows = _read(doh_csv)
    by_id = {r["food_id"]: r for r in rows}
    links = _read(links_csv) if links_csv.exists() else []
    linked_ids = {l["doh_food_id"] for l in links}

    english_csv = links_csv.with_name(ENGLISH_CSV.name)   # names the transcription left empty
    english = {e["doh_food_id"]: e["name_en"] for e in _read(english_csv)} if english_csv.exists() else {}

    taken = {r[0] for r in conn.execute(
        "SELECT name_th FROM foods WHERE name_th IS NOT NULL")}
    counts = {"doh_added": 0, "doh_skipped_review": 0, "doh_links_applied": 0,
              "doh_links_unresolved": 0, "doh_aliases_added": 0, "doh_aliases_skipped": 0}
    inserted: dict[str, int] = {}            # DoH food id -> foods.id of the row we created

    for r in rows:
        if r["review"] or not r["kcal"]:
            counts["doh_skipped_review"] += 1
            continue
        if r["food_id"] in linked_ids:       # its values go onto the seed food instead
            continue
        name = r["name_th"]
        if name in taken:                    # the table repeats some Thai names for different foods
            name = f"{name} ({r['food_id']})"
        taken.add(name)
        group, serving = group_of(int(r["pdf_page"]))
        if r.get("serving_g"):               # the table printed a serving size for this food
            serving = float(r["serving_g"])
            serving_note = "serving size from the DoH table"
        else:
            serving_note = "default serving is a group-level guess"
        unverified = ("; Thai name not verified (read by the lite model)"
                      if r.get("name_verified", "1") == "0" else "")
        cur = conn.execute(
            """INSERT INTO foods (name_th, name_en, kind, kcal_100g, protein_100g, fat_100g,
                   carbs_100g, default_serving_g, source, notes)
               VALUES (?, ?, 'ingredient', ?, ?, ?, ?, ?, 'doh2018', ?)""",
            (name, r["name_en"] or english.get(r["food_id"]) or None, float(r["kcal"]), float(r["protein_g"]),
             float(r["fat_g"]), float(r["carbs_g"]), serving,
             f"DoH 2018 table id {r['food_id']}; group: {group}; {serving_note}{unverified}"))
        inserted[r["food_id"]] = cur.lastrowid
        if group == "dishes":                # a dish's default serving is one plate
            conn.execute("INSERT INTO food_units (food_id, unit, grams) VALUES (?, 'จาน', ?)",
                         (cur.lastrowid, serving))
        counts["doh_added"] += 1

    for a in (_read(aliases_csv) if aliases_csv.exists() else []):
        food_id = inserted.get(a["doh_food_id"])
        clash = conn.execute("SELECT 1 FROM foods WHERE name_th = ?1 OR name_en = ?1 "
                             "UNION SELECT 1 FROM food_aliases WHERE alias = ?1", (a["alias"],)).fetchone()
        if food_id is None or clash:         # the DoH row was flagged, or the name is already taken
            counts["doh_aliases_skipped"] += 1
            continue
        conn.execute("INSERT INTO food_aliases (food_id, alias, lang) VALUES (?, ?, ?)",
                     (food_id, a["alias"], a["lang"] or None))
        counts["doh_aliases_added"] += 1

    for link in links:
        row = by_id.get(link["doh_food_id"])
        if row is None or row["review"] or not row["kcal"]:
            counts["doh_links_unresolved"] += 1
            continue
        cur = conn.execute(
            """UPDATE foods SET kcal_100g = ?, protein_100g = ?, fat_100g = ?, carbs_100g = ?,
                   source = 'doh2018',
                   notes = trim(coalesce(notes, '') || '; values from DoH 2018 id ' || ?, '; ')
               WHERE name_th = ? OR name_en = ?""",
            (float(row["kcal"]), float(row["protein_g"]), float(row["fat_g"]),
             float(row["carbs_g"]), row["food_id"], link["seed_food"], link["seed_food"]))
        if cur.rowcount != 1:
            raise ValueError(f"doh_links.csv: seed food {link['seed_food']!r} matched "
                             f"{cur.rowcount} rows")
        counts["doh_links_applied"] += 1
    return counts
