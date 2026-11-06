"""Build the dish catalog the web app's Coach screen picks meal ideas from: for each English dish in
data/eval/warm_dishes.txt, the calories and macros our own pipeline estimates for one typical serving.

Run `python warm_cache.py` first (so every dish is answered from the cache, with no language-model wait), then
    python build_catalog.py            # writes ../frontend/src/lib/catalog.json
The numbers are estimates (assumed servings, typical parts), the same ones a person would see searching the dish.
"""
import csv
import json
import re
import sys
from pathlib import Path

from src import config
from src.matcher import Matcher
from src.pipeline import estimate
from check_plausible import BANDS, verdict
from warm_cache import DEFAULT_LIST, read_dishes

OUT = Path(__file__).resolve().parent.parent / "frontend" / "src" / "lib" / "catalog.json"
THAI = re.compile(r"[฀-๿]")
MIN_KCAL, MAX_KCAL = 60, 1500      # outside this a "serving" is a sign the estimate went wrong


def entry(dish: str, est) -> dict | None:
    """The catalog row for an estimate, or None if it is not trustworthy enough to suggest."""
    if not est.lines or est.unmatched or not MIN_KCAL <= est.kcal <= MAX_KCAL:
        return None
    return {"title": dish, "kcal": round(est.kcal), "protein": round(est.protein),
            "carbs": round(est.carbs), "fat": round(est.fat)}


def bands() -> dict[str, tuple[float, float]]:
    """The believable kcal band per dish (data/eval/plausible.csv), keyed by lower-case name."""
    with open(BANDS, encoding="utf-8", newline="") as f:
        return {r["dish"].casefold(): (float(r["low"]), float(r["high"])) for r in csv.DictReader(f)}


def main() -> int:
    """Only dishes whose estimate lands inside its believable band are suggested: a suggestion with a doubtful
    number is worse than no suggestion."""
    bands_by_dish = bands()
    dishes = [d for d in read_dishes(DEFAULT_LIST) if not THAI.search(d) and d.casefold() in bands_by_dish]
    matcher = Matcher(config.DB_PATH)
    matcher._embeddings()
    rows, skipped = [], []
    for dish in dishes:
        try:
            row = entry(dish, estimate(dish, matcher=matcher))
            if row and verdict(row["kcal"], *bands_by_dish[dish.casefold()]) != "ok":
                row = None
        except Exception as e:      # not cached and the language model is down: leave it out for now
            print(f"{dish}: {type(e).__name__}", file=sys.stderr)
            row = None
        (rows if row else skipped).append(row or dish)
    OUT.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(rows)} dishes written to {OUT}; left out: {', '.join(skipped) or 'none'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
