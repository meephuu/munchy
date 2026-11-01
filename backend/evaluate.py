"""Run the whole pipeline on data/eval/dishes.csv and report how far off it is (roadmap step 12).

Expected values come from USDA SR Legacy via build_eval_set.py, so this checks our database and
portion assumptions against an independent source, not just the code. LLM parses are cached
(data/cache.db), so re-runs are free and fast; use --no-cache to re-parse.

Usage:
  python evaluate.py                 # all dishes, summary + worst cases
  python evaluate.py --only rice,milk
  python evaluate.py --no-cache
Writes the per-dish results to data/processed/eval_report.csv.
"""
import argparse
import csv
import statistics
import sys

from src import config
from src.matcher import Matcher
from src.pipeline import estimate

DISHES = config.ROOT / "data" / "eval" / "dishes.csv"
REPORT = config.ROOT / "data" / "processed" / "eval_report.csv"


def run(only: set[str] | None = None, use_cache: bool = True) -> list[dict]:
    with open(DISHES, encoding="utf-8-sig", newline="") as f:
        dishes = [d for d in csv.DictReader(f) if not only or d["id"] in only]
    matcher = Matcher(config.DB_PATH)
    results = []
    for d in dishes:
        res = {"id": d["id"], "text": d["text"], "note": d["note"]}
        for k in ("kcal", "protein", "fat", "carbs"):
            res[f"expected_{k}"] = float(d[f"expected_{k}"])
        try:
            est = estimate(d["text"], matcher=matcher, use_cache=use_cache)
        except Exception as e:                                   # report, keep going
            res.update(error=f"{type(e).__name__}: {str(e)[:100]}")
            results.append(res)
            continue
        res.update(kcal=est.kcal, protein=est.protein, fat=est.fat, carbs=est.carbs,
                   matched=" + ".join(f"{m.name}({m.confidence:.2f})" for _, m in est.matches),
                   warnings=" | ".join(est.warnings), complete=not est.unmatched)
        res["kcal_err_pct"] = 100 * (est.kcal - res["expected_kcal"]) / res["expected_kcal"]
        res["error"] = ""
        results.append(res)
    return results


def summarize(results: list[dict]) -> str:
    ok = [r for r in results if not r.get("error")]
    failed = [r for r in results if r.get("error")]
    lines = [f"{len(ok)}/{len(results)} dishes ran"
             + (f"; {len(failed)} FAILED: " + ", ".join(f"{r['id']} ({r['error']})" for r in failed) if failed else "")]
    if ok:
        ape = [abs(r["kcal_err_pct"]) for r in ok]
        lines += [
            f"kcal error: mean {statistics.mean(ape):.1f}%  median {statistics.median(ape):.1f}%  "
            f"worst {max(ape):.0f}%",
            f"within 10%: {sum(a <= 10 for a in ape)}/{len(ok)}   within 20%: {sum(a <= 20 for a in ape)}/{len(ok)}   "
            f"within 50%: {sum(a <= 50 for a in ape)}/{len(ok)}",
            "macro error (mean absolute, g): " + "  ".join(
                f"{k} {statistics.mean(abs(r[k] - r['expected_' + k]) for r in ok):.1f}"
                for k in ("protein", "fat", "carbs")),
            f"dishes with warnings: {sum(bool(r['warnings']) for r in ok)}/{len(ok)}",
            "", f"{'dish':24} {'expected':>8} {'got':>7} {'err':>7}  matched",
        ]
        for r in sorted(ok, key=lambda r: -abs(r["kcal_err_pct"])):
            lines.append(f"{r['id']:24} {r['expected_kcal']:8.0f} {r['kcal']:7.0f} {r['kcal_err_pct']:+6.0f}%  "
                         f"{r['matched']}" + (f"   !! {r['warnings'][:70]}" if r["warnings"] else ""))
    return "\n".join(lines)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--only", help="comma-separated dish ids")
    ap.add_argument("--no-cache", action="store_true", help="re-parse with the LLM")
    args = ap.parse_args()
    results = run(set(args.only.split(",")) if args.only else None, not args.no_cache)
    print(summarize(results))
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    fields = sorted({k for r in results for k in r}, key=lambda k: (k not in ("id", "text"), k))
    with open(REPORT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(results)
    print(f"\nper-dish results: {REPORT}")


if __name__ == "__main__":
    main()
