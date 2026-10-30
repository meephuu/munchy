"""Build data/eval/dishes.csv: expected nutrition for each test dish, from USDA SR Legacy.

Each row of data/eval/dishes_spec.csv lists USDA foods and gram amounts; the expected kcal and
macros are those foods' per-100 g values (public domain, data/raw/usda_sr_legacy_csv) scaled
to the grams. The result is independent of our own database, so it can reveal data errors
and bad portion assumptions, not just code bugs. Re-run only when the spec changes.

Usage: python build_eval_set.py
"""
import csv
import sys

from src import config

SR_DIR = next((config.ROOT / "data" / "raw" / "usda_sr_legacy_csv").glob("*"))
EVAL_DIR = config.ROOT / "data" / "eval"
NUTRIENTS = {"1008": "kcal", "1003": "protein", "1004": "fat", "1005": "carbs"}


def read(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    spec = list(read(EVAL_DIR / "dishes_spec.csv"))
    wanted = {c.split(":")[0] for row in spec for c in row["components"].split("|")}
    names = {r["fdc_id"]: r["description"] for r in read(SR_DIR / "food.csv") if r["fdc_id"] in wanted}
    per100: dict[str, dict[str, float]] = {i: {} for i in wanted}
    for r in read(SR_DIR / "food_nutrient.csv"):
        if r["fdc_id"] in wanted and r["nutrient_id"] in NUTRIENTS:
            per100[r["fdc_id"]][NUTRIENTS[r["nutrient_id"]]] = float(r["amount"])

    out = []
    for row in spec:
        total = dict.fromkeys(NUTRIENTS.values(), 0.0)
        parts = []
        for comp in row["components"].split("|"):
            fdc_id, grams = comp.split(":")
            if fdc_id not in names or len(per100[fdc_id]) != 4:
                sys.exit(f"{row['id']}: USDA food {fdc_id} not found or missing nutrients")
            for k in total:
                total[k] += per100[fdc_id][k] * float(grams) / 100
            parts.append(f"{names[fdc_id]} ({fdc_id}) x {grams} g")
        out.append({"id": row["id"], "text": row["text"],
                    "expected_kcal": round(total["kcal"], 1), "expected_protein": round(total["protein"], 1),
                    "expected_fat": round(total["fat"], 1), "expected_carbs": round(total["carbs"], 1),
                    "reference": " + ".join(parts), "note": row["note"]})
    path = EVAL_DIR / "dishes.csv"
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0]))
        w.writeheader()
        w.writerows(out)
    print(f"{len(out)} dishes -> {path}")
    for r in out:
        print(f"  {r['id']:24} {r['expected_kcal']:7.1f} kcal  P {r['expected_protein']:5.1f}  "
              f"F {r['expected_fat']:5.1f}  C {r['expected_carbs']:5.1f}")


if __name__ == "__main__":
    main()
