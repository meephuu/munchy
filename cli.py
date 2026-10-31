"""Step 7: type a dish, get kcal and macros back.

Usage: python cli.py "ข้าวเหนียวหมูปิ้ง 5 ไม้"
"""
import argparse
import sys
from typing import Callable

from google.genai import errors as genai_errors

from src import config
from src.nutrition import CalcError, Estimate
from src.parser import ParseError


def format_estimate(text: str, est: Estimate) -> str:
    out = [f"Input: {text}", "", "Matched"]
    for item, m in est.matches:
        qty = " ".join(str(x) for x in (f"{item.qty:g}" if item.qty is not None else None, item.unit) if x)
        shown = f"{item.label} {qty}".strip()
        out.append(f"  {shown}  ->  {m.name}  ({m.method} {m.confidence:.2f})")

    out += ["", "Breakdown"]
    for l in est.lines:
        origin = f" [{l.via_combo}]" if l.via_combo else ""
        out.append(f"  - {l.name}{origin}: {l.grams:g} g, {l.kcal:.0f} kcal "
                   f"(P {l.protein:.1f} / F {l.fat:.1f} / C {l.carbs:.1f} g)")

    out += ["", f"Total: {est.kcal:.0f} kcal | protein {est.protein:.1f} g | "
                f"fat {est.fat:.1f} g | carbs {est.carbs:.1f} g"]

    if est.warnings:
        out += ["", "Warnings"] + [f"  ! {w}" for w in est.warnings]
    if est.assumptions:
        out += ["", "Assumptions"] + [f"  - {a}" for a in est.assumptions]
    out += ["", "Estimates are approximate: portion size and cooking oil dominate the error."]
    return "\n".join(out)


def main(argv: list[str] | None = None,
         estimate_fn: Callable[[str], Estimate] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):          # Thai output on Windows consoles
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    ap = argparse.ArgumentParser(description="Estimate calories and macros for a dish.")
    ap.add_argument("text", nargs="+", help="dish and details, e.g. ข้าวเหนียวหมูปิ้ง 5 ไม้")
    ap.add_argument("--no-cache", action="store_true",
                    help="always call the LLM instead of reusing a cached parse")
    args = ap.parse_args(argv)
    text = " ".join(args.text)

    if estimate_fn is None:
        if not config.DB_PATH.exists():
            print(f"Database not found at {config.DB_PATH}. Build it first:\n"
                  "  python -m src.db --seed", file=sys.stderr)
            return 1
        from functools import partial

        from src.pipeline import estimate
        estimate_fn = partial(estimate, use_cache=not args.no_cache)

    try:
        est = estimate_fn(text)
    except ParseError as e:
        print(f"Could not understand the input: {e}", file=sys.stderr)
        return 1
    except CalcError as e:
        print(f"Could not calculate: {e}", file=sys.stderr)
        return 1
    except genai_errors.APIError as e:
        print(f"The LLM request failed: {e}", file=sys.stderr)
        return 1
    except RuntimeError as e:                        # e.g. missing GEMINI_API_KEY
        print(f"Setup problem: {e}", file=sys.stderr)
        return 1

    if not est.lines:                                # every item was left unmatched
        print("Nothing could be matched to the food database.", file=sys.stderr)
        for w in est.warnings:
            print(f"  ! {w}", file=sys.stderr)
        return 1

    print(format_estimate(text, est))
    return 0


if __name__ == "__main__":
    sys.exit(main())
