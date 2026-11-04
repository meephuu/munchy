"""Fill the parse cache for common dishes, so people searching them get an answer at once instead of waiting
~30 s for the language model. Safe to run again: dishes already cached are skipped quickly, and a failure
(quota, overload) is reported and skipped, not fatal.

Run (from backend/, venv active):
    python warm_cache.py                      # the list in data/eval/warm_dishes.txt
    python warm_cache.py my_dishes.txt        # your own list, one dish per line
    python warm_cache.py --pause 3            # wait longer between dishes (free-tier rate limits)
"""
import argparse
import sys
import time
from pathlib import Path

from src import config
from src.matcher import Matcher
from src.pipeline import estimate

DEFAULT_LIST = Path(__file__).parent / "data" / "eval" / "warm_dishes.txt"


def read_dishes(path: Path) -> list[str]:
    """One dish per line; blank lines and lines starting with # are ignored; repeats are dropped."""
    seen: set[str] = set()
    out: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        dish = line.strip()
        if dish and not dish.startswith("#") and dish.casefold() not in seen:
            seen.add(dish.casefold())
            out.append(dish)
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", nargs="?", type=Path, default=DEFAULT_LIST)
    ap.add_argument("--pause", type=float, default=1.0, help="seconds to wait between dishes")
    args = ap.parse_args(argv)

    dishes = read_dishes(args.file)
    matcher = Matcher(config.DB_PATH)
    matcher._embeddings()
    failed = 0
    for n, dish in enumerate(dishes, 1):
        started = time.time()
        try:
            est = estimate(dish, matcher=matcher)
            print(f"[{n}/{len(dishes)}] {dish}: {est.kcal:.0f} kcal ({time.time() - started:.1f}s)", flush=True)
        except Exception as e:      # quota, overload, bad output: go on with the next dish
            failed += 1
            print(f"[{n}/{len(dishes)}] {dish}: FAILED ({type(e).__name__}: {str(e)[:100]})", flush=True)
        time.sleep(args.pause)
    print(f"done: {len(dishes) - failed} cached, {failed} failed", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
