"""Step 6: parsed items + matches -> grams -> nutrients -> totals. Pure, deterministic code.

Rules for turning a quantity into grams (every guess is recorded as an assumption):
  - g / กรัม / kg / กก.            -> used directly
  - a unit in food_units            -> qty * grams-per-unit      (ไม้, ฟอง, จาน, ...)
  - no qty and no unit              -> 1 default serving
  - qty without a unit              -> qty default servings
  - a unit the food doesn't have    -> qty default servings, with a visible warning
A combo item expands into its components: the component flagged takes_user_qty gets the
user's quantity, the others use their defaults. If the user also names a food that is a
component of the combo, the user's item replaces that default component.
"""
import sqlite3
from contextlib import closing
from dataclasses import dataclass, field
from pathlib import Path

from src import config
from src.db import connect
from src.matcher import Match
from src.parser import ParsedItem

GRAM_UNITS = {"g", "gram", "grams", "กรัม", "ก."}
KILOGRAM_UNITS = {"kg", "kilogram", "kilograms", "กก.", "กิโลกรัม", "กิโล"}
MAX_COMBO_DEPTH = 5


class CalcError(Exception):
    pass


@dataclass
class Line:
    food_id: int
    name: str
    grams: float
    kcal: float
    protein: float
    fat: float
    carbs: float
    item_text: str                    # the user's text this line came from
    via_combo: str | None = None      # combo name if this line is a component of one
    assumptions: list[str] = field(default_factory=list)


@dataclass
class Estimate:
    lines: list[Line]
    notes: list[str] = field(default_factory=list)   # estimate-level assumptions (replacements)
    matches: list[tuple[ParsedItem, Match]] = field(default_factory=list)  # how each input matched

    @property
    def kcal(self) -> float:
        return sum(l.kcal for l in self.lines)

    @property
    def protein(self) -> float:
        return sum(l.protein for l in self.lines)

    @property
    def fat(self) -> float:
        return sum(l.fat for l in self.lines)

    @property
    def carbs(self) -> float:
        return sum(l.carbs for l in self.lines)

    @property
    def assumptions(self) -> list[str]:
        return [a for l in self.lines for a in l.assumptions] + self.notes


def _unit_key(unit: str | None) -> str | None:
    return unit.strip().casefold() if unit and unit.strip() else None


def _grams(conn: sqlite3.Connection, food: sqlite3.Row,
           qty: float | None, unit: str | None) -> tuple[float, str | None]:
    """Return (grams, assumption or None) for qty+unit of one ingredient."""
    name, serving = food["name_th"] or food["name_en"], food["default_serving_g"]
    u = _unit_key(unit)

    def serving_grams(n: float) -> float:
        if serving is None:
            raise CalcError(f"{name} has no default_serving_g")
        return n * serving

    if qty is None and u is None:
        return serving_grams(1), f"assumed 1 serving of {name} ({serving_grams(1):g} g)"
    if qty is None:                      # unit without a number, e.g. "ไข่ต้ม ฟอง"
        qty, said_one = 1.0, True
    else:
        said_one = False

    if u in GRAM_UNITS:
        return qty, None
    if u in KILOGRAM_UNITS:
        return qty * 1000, None
    if u is not None:
        row = conn.execute("SELECT grams FROM food_units WHERE food_id = ? AND unit = ?",
                           (food["id"], unit.strip())).fetchone()
        if row:
            note = f"assumed 1 {unit.strip()} of {name}" if said_one else None
            return qty * row["grams"], note
        g = serving_grams(qty)
        return g, (f"unit '{unit.strip()}' is not known for {name}; "
                   f"treated {qty:g} as servings ({g:g} g)")
    g = serving_grams(qty)
    return g, f"assumed {qty:g} serving(s) of {name} ({g:g} g)"


def _line(food: sqlite3.Row, grams: float, item_text: str, *,
          via_combo: str | None = None, assumptions: list[str] | None = None) -> Line:
    k = grams / 100
    assumptions = list(assumptions or [])
    if food["oil_note"]:
        assumptions.append(f"{food['name_th'] or food['name_en']}: {food['oil_note']}")
    return Line(food["id"], food["name_th"] or food["name_en"], grams,
                food["kcal_100g"] * k, food["protein_100g"] * k,
                food["fat_100g"] * k, food["carbs_100g"] * k,
                item_text, via_combo, assumptions)


def _expand_combo(conn: sqlite3.Connection, combo: sqlite3.Row, qty: float | None,
                  unit: str | None, item_text: str, depth: int = 0) -> list[Line]:
    if depth >= MAX_COMBO_DEPTH:
        raise CalcError(f"combo nesting too deep (cycle?) at {combo['name_th']}")
    combo_name = combo["name_th"] or combo["name_en"]
    comps = conn.execute(
        """SELECT c.*, f.* FROM combo_components c JOIN foods f ON f.id = c.component_id
           WHERE c.combo_id = ? ORDER BY c.sort_order""", (combo["id"],)).fetchall()
    if not comps:
        raise CalcError(f"combo {combo_name} has no components")

    user_gave_qty = qty is not None or _unit_key(unit) is not None
    out: list[Line] = []
    for c in comps:
        takes_user = bool(c["takes_user_qty"]) and user_gave_qty
        c_qty, c_unit = (qty, unit) if takes_user else (c["default_qty"], c["default_unit"])
        if c["kind"] == "combo":
            lines = _expand_combo(conn, c, c_qty, c_unit, item_text, depth + 1)
            for l in lines:
                l.via_combo = l.via_combo or combo_name
            if not takes_user and c["assumption_note"] and lines:
                lines[0].assumptions.insert(0, c["assumption_note"])
            out += lines
            continue
        grams, note = _grams(conn, c, c_qty, c_unit)
        notes = [] if takes_user else [c["assumption_note"] or note or
                                       f"assumed default amount of {c['name_th']}"]
        if takes_user and note:
            notes.append(note)
        out.append(_line(c, grams, item_text, via_combo=combo_name, assumptions=notes))

    if user_gave_qty and not any(c["takes_user_qty"] for c in comps):
        out[0].assumptions.append(
            f"quantity for {combo_name} ignored: none of its components takes a user quantity")
    return out


def calculate(pairs: list[tuple[ParsedItem, Match]],
              db_path: Path = config.DB_PATH) -> Estimate:
    """pairs: each parsed item with its chosen match. Returns lines, totals and assumptions."""
    with closing(connect(db_path)) as conn:
        lines: list[Line] = []
        standalone_ids: dict[int, str] = {}      # ingredient food_id -> name the user gave
        for item, match in pairs:
            food = conn.execute("SELECT * FROM foods WHERE id = ?", (match.food_id,)).fetchone()
            if food["kind"] == "combo":
                lines += _expand_combo(conn, food, item.qty, item.unit, item.food)
            else:
                grams, note = _grams(conn, food, item.qty, item.unit)
                lines.append(_line(food, grams, item.food, assumptions=[note] if note else []))
                standalone_ids[food["id"]] = item.food

        # The user's own item beats a default component of a combo.
        notes: list[str] = []
        kept: list[Line] = []
        for l in lines:
            if l.via_combo and l.food_id in standalone_ids:
                notes.append(f"used your '{standalone_ids[l.food_id]}' instead of the "
                             f"default {l.name} in {l.via_combo}")
            else:
                kept.append(l)
        return Estimate(kept, notes, list(pairs))
