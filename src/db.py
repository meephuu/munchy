"""Step 2-3: SQLite schema + seed data for foods, units and combo dishes."""
import argparse
import csv
import sqlite3
from contextlib import closing
from pathlib import Path

from src.config import DB_PATH, ROOT

SEED_DIR = ROOT / "data" / "seed"

SCHEMA = """
-- One row per edible thing. Plain ingredients/dishes carry nutrients per 100 g;
-- combos (kind='combo') have none: their totals are computed from components.
CREATE TABLE IF NOT EXISTS foods (
    id                 INTEGER PRIMARY KEY,
    name_th            TEXT,
    name_en            TEXT,
    kind               TEXT NOT NULL DEFAULT 'ingredient'
                       CHECK (kind IN ('ingredient', 'combo')),
    kcal_100g          REAL,
    protein_100g       REAL,
    fat_100g           REAL,
    carbs_100g         REAL,
    default_serving_g  REAL,
    source             TEXT NOT NULL DEFAULT 'seed',   -- 'seed' | 'inmu' | 'usda'
    notes              TEXT,
    oil_note           TEXT,   -- set when the per-100 g values include cooking oil; shown as an assumption
    CHECK (name_th IS NOT NULL OR name_en IS NOT NULL),
    CHECK (kind = 'combo' OR (kcal_100g IS NOT NULL AND protein_100g IS NOT NULL
                              AND fat_100g IS NOT NULL AND carbs_100g IS NOT NULL))
);

-- Grams per count unit, per food (a จาน of rice != a จาน of salad).
-- 'g' / 'กรัม' are handled in code and need no rows.
CREATE TABLE IF NOT EXISTS food_units (
    food_id  INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
    unit     TEXT NOT NULL,
    grams    REAL NOT NULL CHECK (grams > 0),
    PRIMARY KEY (food_id, unit)
);

-- Extra names (Thai/English) the matcher embeds and fuzzy-matches against.
CREATE TABLE IF NOT EXISTS food_aliases (
    id       INTEGER PRIMARY KEY,
    food_id  INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
    alias    TEXT NOT NULL,
    lang     TEXT CHECK (lang IN ('th', 'en')),
    UNIQUE (food_id, alias)
);
CREATE INDEX IF NOT EXISTS idx_aliases_food ON food_aliases(food_id);

-- Combo dish -> its parts. takes_user_qty marks the component that a
-- user-given quantity attaches to (e.g. "5 ไม้" -> หมูปิ้ง, not the rice).
CREATE TABLE IF NOT EXISTS combo_components (
    combo_id         INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
    component_id     INTEGER NOT NULL REFERENCES foods(id),
    default_qty      REAL NOT NULL DEFAULT 1,
    default_unit     TEXT,              -- NULL = use the component's default_serving_g
    takes_user_qty   INTEGER NOT NULL DEFAULT 0 CHECK (takes_user_qty IN (0, 1)),
    assumption_note  TEXT,              -- reported when the default is used
    sort_order       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (combo_id, component_id),
    CHECK (combo_id != component_id)
);
"""


def connect(path: Path = DB_PATH) -> sqlite3.Connection:
    """Open the DB with foreign keys enforced (SQLite has them off by default)."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(path: Path = DB_PATH, reset: bool = False) -> None:
    """Create the tables. reset=True deletes the file first (DB is rebuildable)."""
    if reset:
        Path(path).unlink(missing_ok=True)
    with connect(path) as conn:
        conn.executescript(SCHEMA)


def _read_csv(seed_dir: Path, name: str) -> list[dict]:
    # utf-8-sig so files saved from Excel (with a BOM) still load
    with open(seed_dir / name, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def _num(value: str | None) -> float | None:
    return float(value) if value not in (None, "") else None


def seed_db(path: Path = DB_PATH, seed_dir: Path = SEED_DIR) -> dict[str, int]:
    """Rebuild the DB from the CSVs in seed_dir. Returns row counts per table.

    Units, aliases and components refer to foods by name (name_th or name_en);
    an unknown or ambiguous name raises ValueError so typos fail loudly.
    """
    init_db(path, reset=True)
    with closing(connect(path)) as conn, conn:
        ids: dict[str, int] = {}
        for row in _read_csv(seed_dir, "foods.csv"):
            cur = conn.execute(
                """INSERT INTO foods (name_th, name_en, kind, kcal_100g, protein_100g,
                       fat_100g, carbs_100g, default_serving_g, notes, oil_note)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (row["name_th"] or None, row["name_en"] or None, row["kind"],
                 _num(row["kcal_100g"]), _num(row["protein_100g"]),
                 _num(row["fat_100g"]), _num(row["carbs_100g"]),
                 _num(row["default_serving_g"]), row["notes"] or None,
                 row["oil_note"] or None),
            )
            for name in (row["name_th"], row["name_en"]):
                if name:
                    if name in ids:
                        raise ValueError(f"foods.csv: duplicate food name {name!r}")
                    ids[name] = cur.lastrowid

        def food_id(name: str, file: str) -> int:
            if name not in ids:
                raise ValueError(f"{file}: unknown food {name!r}")
            return ids[name]

        for row in _read_csv(seed_dir, "food_units.csv"):
            conn.execute(
                "INSERT INTO food_units (food_id, unit, grams) VALUES (?, ?, ?)",
                (food_id(row["food"], "food_units.csv"), row["unit"], float(row["grams"])),
            )

        for row in _read_csv(seed_dir, "food_aliases.csv"):
            fid = food_id(row["food"], "food_aliases.csv")
            if ids.get(row["alias"], fid) != fid:
                raise ValueError(
                    f"food_aliases.csv: alias {row['alias']!r} is already another food's name")
            conn.execute(
                "INSERT INTO food_aliases (food_id, alias, lang) VALUES (?, ?, ?)",
                (fid, row["alias"], row["lang"] or None),
            )

        for row in _read_csv(seed_dir, "combo_components.csv"):
            conn.execute(
                """INSERT INTO combo_components (combo_id, component_id, default_qty,
                       default_unit, takes_user_qty, assumption_note, sort_order)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (food_id(row["combo"], "combo_components.csv"),
                 food_id(row["component"], "combo_components.csv"),
                 float(row["default_qty"]), row["default_unit"] or None,
                 int(row["takes_user_qty"]), row["assumption_note"] or None,
                 int(row["sort_order"] or 0)),
            )

        return {t: conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
                for t in ("foods", "food_units", "food_aliases", "combo_components")}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create or seed the Munchy database.")
    parser.add_argument("--seed", action="store_true",
                        help="rebuild foods.db from data/seed/*.csv (deletes the old file)")
    args = parser.parse_args()

    if args.seed:
        for table, n in seed_db().items():
            print(f"{table:18} {n}")
    else:
        init_db()
        with closing(connect()) as conn:
            tables = [r["name"] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
        print(f"{DB_PATH}: {', '.join(tables)}")
