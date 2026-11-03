"""Units a food can be measured in (food_units table), shaped for a client's amount picker.

The table mixes Thai count units (ฟอง, ไม้, จาน...) with USDA ones (cup, tbsp, slice...). Clients get
English labels and a short, de-duplicated list; grams are always available on top of these.
"""
import sqlite3

# Thai unit -> English label shown to the user. Unknown units keep their own spelling.
LABELS = {
    "ฟอง": "egg", "ไม้": "skewer", "ห่อ": "pack", "จาน": "plate", "ถ้วย": "bowl",
    "ช้อนโต๊ะ": "tbsp", "ช้อนชา": "tsp", "ชิ้น": "piece", "แผ่น": "slice", "แว่น": "slice",
    "ลูก": "piece", "ตัว": "piece", "แก้ว": "glass", "หัว": "head", "ฝัก": "pod",
    "ทัพพี": "ladle", "ซอง": "sachet", "กล่อง": "box",
}
SKIP = {"unit", "item"}       # USDA's catch-all portions: they tell the user nothing
MAX_UNITS = 6


def label(unit: str) -> str:
    return LABELS.get(unit.strip(), unit.strip())


def unit_options(rows: list[tuple[str, float]]) -> list[tuple[str, float]]:
    """[(label, grams per 1), ...] from raw (unit, grams) rows: English labels, no 'g', no catch-alls,
    no non-positive weights, one entry per label (the first), at most MAX_UNITS."""
    out: list[tuple[str, float]] = []
    seen = {"g"}
    for unit, grams in rows:
        name = label(unit)
        if grams <= 0 or name in seen or name in SKIP:
            continue
        seen.add(name)
        out.append((name, float(grams)))
        if len(out) == MAX_UNITS:
            break
    return out


def units_for(conn: sqlite3.Connection, food_ids: list[int]) -> dict[int, list[tuple[str, float]]]:
    """unit_options for each food id (an empty list for foods with no units)."""
    if not food_ids:
        return {}
    marks = ",".join("?" * len(food_ids))
    raw: dict[int, list[tuple[str, float]]] = {i: [] for i in food_ids}
    for r in conn.execute(f"SELECT food_id, unit, grams FROM food_units WHERE food_id IN ({marks}) "
                          f"ORDER BY rowid", list(food_ids)):
        raw[r["food_id"]].append((r["unit"], r["grams"]))
    return {i: unit_options(rows) for i, rows in raw.items()}
