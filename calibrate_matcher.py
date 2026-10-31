"""Choose the matcher's confidence thresholds from data (roadmap step 9).

Runs every query in data/eval/match_queries.csv through the real matcher, prints the
score of each, then sweeps LOW / HIGH / MARGIN and reports how each setting would have
classified the queries. Re-run after changing the food table (step 11) or the model.

Usage: python calibrate_matcher.py
"""
import csv
import itertools
import sys

from src import config
from src.matcher import HIGH, LOW, MARGIN, Matcher, classify

CSV_PATH = config.ROOT / "data" / "eval" / "match_queries.csv"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        queries = list(csv.DictReader(f))

    matcher = Matcher()
    results = [(q, matcher.match(q["query"], top_k=3)) for q in queries]

    def right(q, m) -> bool:
        """expected may list several acceptable foods separated by '|' (the table has
        near-duplicates); a trailing '*' accepts any food whose name starts with that text."""
        names = [n for n in (m[0].name_th, m[0].name) if n]      # labels may be Thai or English
        return any(any(n.startswith(e[:-1]) for n in names) if e.endswith("*") else e in names
                   for e in q["expected"].split("|"))

    print(f"{'query':32} {'expected':16} {'top1':16} {'conf':>5} {'gap':>5}  method")
    for q, m in results:
        gap = m[0].confidence - m[1].confidence if len(m) > 1 else 1.0
        mark = "" if not q["expected"] else ("  ok" if right(q, m) else "  WRONG")
        print(f"{q['query']:32} {q['expected'] or '-':16} {m[0].name:16} "
              f"{m[0].confidence:5.2f} {gap:5.2f}  {m[0].method}{mark}")

    known = [(q, m) for q, m in results if q["expected"]]
    unknown = [(q, m) for q, m in results if not q["expected"]]
    top1_right = sum(right(q, m) for q, m in known)
    print(f"\ntop-1 correct for known foods: {top1_right}/{len(known)}")
    print(f"\n{'LOW':>5} {'HIGH':>5} {'GAP':>5} | known: ok-right  unsure  no-match  ok-WRONG |"
          f" unknown: no-match  unsure  ok-WRONG(false accept)")

    def tally(low, high, gap):
        k = {"right": 0, "unsure": 0, "none": 0, "wrong": 0}
        for q, m in known:
            s = classify(m, low, high, gap)
            if s == "no_match":
                k["none"] += 1
            elif s == "uncertain":
                k["unsure"] += 1
            elif right(q, m):
                k["right"] += 1
            else:
                k["wrong"] += 1
        u = {"no_match": 0, "uncertain": 0, "ok": 0}
        for _, m in unknown:
            u[classify(m, low, high, gap)] += 1
        return k, u

    def show(low, high, gap, tag=""):
        k, u = tally(low, high, gap)
        print(f"{low:5.2f} {high:5.2f} {gap:5.2f} | {k['right']:>14} {k['unsure']:>7} {k['none']:>9} "
              f"{k['wrong']:>9} | {u['no_match']:>16} {u['uncertain']:>7} {u['ok']:>9}  {tag}")

    show(LOW, HIGH, MARGIN, "<- current settings in src/matcher.py")
    rows = []
    for low, high, gap in itertools.product(
            (0.60, 0.65, 0.68, 0.70, 0.72), (0.75, 0.80, 0.83, 0.85), (0.0, 0.03, 0.05, 0.08)):
        if high < low:
            continue
        k, u = tally(low, high, gap)
        rows.append((k["wrong"] + u["ok"], k["none"], low, high, gap))
    print("\nbest by fewest silent errors (ok-WRONG + false accepts), then fewest real foods rejected:")
    for _, _, low, high, gap in sorted(rows)[:30]:
        show(low, high, gap)
    print("\nNote: zero silent errors needs HIGH ~0.85, which flags over half of the correct matches.")


if __name__ == "__main__":
    main()
