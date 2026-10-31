"""Load generic foods from USDA FoodData Central "SR Legacy" (public domain, CC0) into the DB.

Why: the Thai table has almost no Western foods (yogurt, dressings, chocolate spread...). SR Legacy
is the generic, lab-analysed part of USDA's data, so it is a good fit; branded products, baby
food, restaurant/fast-food items and the like are left out, because they would add thousands of
near-identical entries that only confuse the matcher.

Input: the unzipped SR Legacy CSV folder (data/raw/usda_sr_legacy_csv/..., not in git).
"""
import csv
import re
import sqlite3
from pathlib import Path

from src import config

USDA_DIR = (config.ROOT / "data" / "raw" / "usda_sr_legacy_csv"
            / "FoodData_Central_sr_legacy_food_csv_2018-04")

# food_category ids that are skipped: baby foods, fast foods, regional foods, restaurant foods,
# branded products, quality-control samples.
SKIP_CATEGORIES = {"3", "21", "24", "25", "26", "27"}
NUTRIENTS = {"1008": "kcal", "2047": "kcal_atwater", "1003": "protein", "1004": "fat", "1005": "carbs"}

# Variants of the same food that differ only in these words are collapsed into one entry.
VARIANT_WORDS = re.compile(r",\s*(?:trimmed to [^,]*|choice|select|prime|all grades|grade [^,]*)", re.I)
BRAND_WORD = re.compile(r"\b[A-Z][A-Z'&\-]{3,}\b")        # ALL-CAPS words are brand names in SR
PAREN_NOTE = re.compile(r"\s*\((?:Includes|Formerly|Shaker)[^)]*\)", re.I)

# measure words in food_portion.modifier that we keep as units, written as stored in food_units
UNIT_ALIASES = {"tablespoon": "tbsp", "teaspoon": "tsp", "pieces": "piece", "slices": "slice",
                "cups": "cup", "cookies": "cookie", "crackers": "cracker", "fillets": "fillet"}
KEEP_UNITS = {"cup", "tbsp", "tsp", "slice", "piece", "serving", "can", "bar", "patty", "cookie",
              "cracker", "fillet", "large", "medium", "small", "container", "package", "jar",
              "bottle", "packet", "scoop", "wing", "thigh", "drumstick", "breast", "fruit",
              "item", "unit", "chop", "steak"}


def _read(path: Path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f)


def clean_name(description: str) -> str:
    return PAREN_NOTE.sub("", description).strip()


def _variant_key(name: str) -> str:
    return VARIANT_WORDS.sub("", name.lower())


def _unit_of(modifier: str) -> str | None:
    m = re.match(r"[a-z]+", modifier.strip().lower())
    word = UNIT_ALIASES.get(m.group(0), m.group(0)) if m else None
    return word if word in KEEP_UNITS else None


def default_serving(plist: list[tuple[float, str | None, str]]) -> float:
    """Grams for 'one serving'. USDA's first portion is often a cup (100 g of grated parmesan), so
    when it is big and the food also has a slice / piece / tablespoon portion, that one is used."""
    if not plist:
        return 100.0
    first = plist[0][0]
    if first > 60:
        for grams, unit, _ in plist:
            if unit in ("slice", "piece", "tbsp") and grams < first:
                return round(grams, 1)
    return round(first, 1)


def import_usda(conn: sqlite3.Connection, usda_dir: Path = USDA_DIR) -> dict[str, int]:
    """Add the filtered SR Legacy foods as ingredients with source='usda'."""
    categories = {r["id"]: r["description"] for r in _read(usda_dir / "food_category.csv")}
    counts = {"usda_added": 0, "usda_skipped_category": 0, "usda_skipped_brand": 0,
              "usda_skipped_variant": 0, "usda_skipped_incomplete": 0, "usda_skipped_name_taken": 0}

    foods = {}
    for r in _read(usda_dir / "food.csv"):
        if r["food_category_id"] in SKIP_CATEGORIES:
            counts["usda_skipped_category"] += 1
        elif BRAND_WORD.search(clean_name(r["description"])):   # after dropping the '(... USDA ...)' notes
            counts["usda_skipped_brand"] += 1
        else:
            foods[r["fdc_id"]] = r

    values: dict[str, dict[str, float]] = {}
    for r in _read(usda_dir / "food_nutrient.csv"):
        key = NUTRIENTS.get(r["nutrient_id"])
        if key and r["fdc_id"] in foods and r["amount"]:
            values.setdefault(r["fdc_id"], {})[key] = float(r["amount"])

    portions: dict[str, list[tuple[float, str | None, str]]] = {}   # fdc_id -> (grams per 1, unit, text)
    for r in sorted(_read(usda_dir / "food_portion.csv"), key=lambda r: int(r["seq_num"] or 0)):
        if r["fdc_id"] in foods and r["gram_weight"] and float(r["amount"] or 0) > 0:
            grams = float(r["gram_weight"]) / float(r["amount"])
            portions.setdefault(r["fdc_id"], []).append((grams, _unit_of(r["modifier"]), r["modifier"]))

    taken = {r[0] for r in conn.execute("SELECT name_th FROM foods WHERE name_th IS NOT NULL")} | \
            {r[0] for r in conn.execute("SELECT name_en FROM foods WHERE name_en IS NOT NULL")}
    seen_variants: set[str] = set()

    # shortest description first, so "..., separable lean and fat" style variants lose to the plain one
    for fdc_id, r in sorted(foods.items(), key=lambda kv: (len(kv[1]["description"]), kv[1]["description"])):
        v = values.get(fdc_id, {})
        kcal = v.get("kcal", v.get("kcal_atwater"))
        if kcal is None:
            counts["usda_skipped_incomplete"] += 1
            continue
        name = clean_name(r["description"])
        key = _variant_key(name)
        if key in seen_variants:
            counts["usda_skipped_variant"] += 1
            continue
        if name in taken:
            counts["usda_skipped_name_taken"] += 1
            continue
        seen_variants.add(key)
        taken.add(name)

        plist = portions.get(fdc_id, [])
        serving = default_serving(plist)
        cur = conn.execute(
            """INSERT INTO foods (name_th, name_en, kind, kcal_100g, protein_100g, fat_100g,
                   carbs_100g, default_serving_g, source, notes, food_group)
               VALUES (NULL, ?, 'ingredient', ?, ?, ?, ?, ?, 'usda', ?, ?)""",
            (name, kcal, v.get("protein", 0.0), v.get("fat", 0.0), v.get("carbs", 0.0), serving,
             f"USDA SR Legacy fdc_id {fdc_id}; group: {categories.get(r['food_category_id'], '?')}; "
             + ("default serving comes from the USDA portions" if plist
                else "no portion data, default serving is 100 g"),
             categories.get(r["food_category_id"])))
        added: set[str] = set()
        for grams, unit, _ in plist:
            if unit and unit not in added:
                added.add(unit)
                conn.execute("INSERT INTO food_units (food_id, unit, grams) VALUES (?, ?, ?)",
                             (cur.lastrowid, unit, round(grams, 1)))
        counts["usda_added"] += 1
    return counts
