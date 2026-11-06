"""Do the estimates for common dishes land in a believable range?  (a sanity check, not a measurement)

data/eval/plausible.csv lists a low and a high kcal for ONE typical serving of each dish, from general nutrition
knowledge (restaurant and cookbook portions): it is a wide band, not a reference value. The check runs the real
pipeline (answers come from the cache once `warm_cache.py` has run) and prints the dishes that fall outside the band,
so the worst estimates can be looked at and fixed.

Usage:  python check_plausible.py
"""
import csv
import sys

from src import config
from src.matcher import Matcher
from src.pipeline import estimate

BANDS = config.ROOT / "data" / "eval" / "plausible.csv"


def verdict(kcal: float, low: float, high: float) -> str:
    return "low" if kcal < low else "high" if kcal > high else "ok"


def main() -> int:
    with open(BANDS, encoding="utf-8", newline="") as f:
        bands = list(csv.DictReader(f))
    matcher = Matcher(config.DB_PATH)
    matcher._embeddings()
    counts = {"ok": 0, "low": 0, "high": 0, "error": 0}
    for b in bands:
        low, high = float(b["low"]), float(b["high"])
        try:
            kcal = estimate(b["dish"], matcher=matcher).kcal
        except Exception as e:                      # not cached and the language model is unavailable
            counts["error"] += 1
            print(f"  ?     {b['dish']}: {type(e).__name__}")
            continue
        v = verdict(kcal, low, high)
        counts[v] += 1
        print(f"  {v.upper():5} {b['dish']}: {kcal:.0f} kcal (expected {low:.0f}-{high:.0f})")
    total = len(bands)
    print(f"\n{counts['ok']}/{total} in range, {counts['low']} too low, {counts['high']} too high, {counts['error']} not checked")
    return 0


if __name__ == "__main__":
    sys.exit(main())
