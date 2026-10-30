"""Transcribe the Department of Health "Food Composition Table of Thai Foods" (2018) into CSV.

The source is a scanned PDF (data/raw/anamai_thai_nutrition/table2018.pdf, not in git).
A vision model only TRANSCRIBES the printed numbers; it never estimates anything. Every row
is then checked in code (energy vs 4*protein + 4*carbs + 9*fat) and suspicious rows are
flagged for manual review. Raw per-page model output is cached so a run can be resumed.

Model choice (measured on two pages against a verified transcription): the lite model gets
every number right but sometimes garbles Thai characters in names; the full model does not.
The full model's free tier is only ~20 requests/day, so --auto uses it for the dish section
(the names users type most) and the lite model for everything else.

Usage:
  python extract_doh_table.py --pages 96-97     # trial run on a few PDF pages
  python extract_doh_table.py --auto            # unattended: all pages, waits out daily quotas
  python extract_doh_table.py --build           # cached pages -> data/processed/doh2018/foods.csv
"""
import argparse
import csv
import json
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import httpx
import pymupdf
from google import genai
from google.genai import errors, types
from pydantic import BaseModel

from src import config

PDF_PATH = config.ROOT / "data" / "raw" / "anamai_thai_nutrition" / "table2018.pdf"
OUT_DIR = config.ROOT / "data" / "processed" / "doh2018"
MODELS_FILE = OUT_DIR / "models.json"   # page -> model that transcribed it
FIRST_PAGE, LAST_PAGE = 9, 123          # PDF pages holding the food tables (printed 7-121)
DISH_PAGES = range(89, 109)             # printed 87-106: one-plate dishes, main dishes, local foods
FULL_MODEL = "gemini-3.5-flash"
LITE_MODEL = "gemini-3.5-flash-lite"
WORKERS = 2

PROMPT = """\
This image is one page of a Thai food composition table. Transcribe every food row on the page.
The numeric columns appear in this order, left to right, right after the two name columns:
Energy (kcal) | Water (g) | Protein (g) | Fat (g) | Carbohydrate (g) | Dietary fibre (g) | Ash (g) | minerals...
Use the column HEADERS to place each number: Water is usually the largest number in the row
(often 50-95) and is NOT protein. For each row return exactly what is printed:
- food_id: the Food ID number
- name_th: the Thai name
- name_en: the English description (join wrapped lines with a space)
- energy: Energy (kcal)
- water: Water (g)
- protein: Protein (g)
- fat: Fat (g)
- carbs: Carbohydrate (g)
- fibre: Dietary fibre (g)
Copy numbers exactly as printed, INCLUDING any parentheses, e.g. "(15.36)". A dash "-" or an
empty cell is null. Do not calculate, correct or guess anything. Skip headers and footers.
If the page has no food rows, return an empty list."""


class Row(BaseModel):
    food_id: str | None = None
    name_th: str | None = None
    name_en: str | None = None
    energy: str | None = None
    water: str | None = None
    protein: str | None = None
    fat: str | None = None
    carbs: str | None = None
    fibre: str | None = None


class PageRows(BaseModel):
    rows: list[Row]


def page_path(p: int):
    return OUT_DIR / f"page_{p:03d}.json"


_models_lock = threading.Lock()


def recorded_models() -> dict[int, str]:
    """Which model produced each cached page. Pages cached before this index existed
    were all made by the full model."""
    known = {int(k): v for k, v in json.loads(MODELS_FILE.read_text()).items()} if MODELS_FILE.exists() else {}
    for path in OUT_DIR.glob("page_*.json"):
        known.setdefault(int(path.stem.split("_")[1]), FULL_MODEL)
    return known


def record_model(p: int, model: str) -> None:
    with _models_lock:
        known = json.loads(MODELS_FILE.read_text()) if MODELS_FILE.exists() else {}
        known[str(p)] = model
        MODELS_FILE.write_text(json.dumps(known), encoding="utf-8")


def render(doc: pymupdf.Document, page_no: int) -> bytes:
    return doc[page_no - 1].get_pixmap(dpi=150).tobytes("png")


class DailyQuotaExceeded(Exception):
    """The free tier's per-day request limit is used up; retrying now is pointless."""

    def __init__(self, message: str):
        super().__init__(message)
        m = re.search(r"retry in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s", message)
        h, mi, s = (float(x) if x else 0 for x in m.groups()) if m else (1, 0, 0)
        self.wait_seconds = h * 3600 + mi * 60 + s


def transcribe(client: genai.Client, png: bytes, model: str = FULL_MODEL) -> PageRows:
    cfg = types.GenerateContentConfig(response_mime_type="application/json",
                                      response_schema=PageRows, temperature=0)
    for attempt in range(4):
        try:
            resp = client.models.generate_content(
                model=model, config=cfg,
                contents=[types.Part.from_bytes(data=png, mime_type="image/png"), PROMPT])
            return PageRows.model_validate_json(resp.text)
        except errors.APIError as e:
            if e.code == 429 and "per day" in str(e):
                raise DailyQuotaExceeded(str(e)) from e
            if e.code not in (429, 500, 503):
                raise
            wait = 10 * 2 ** attempt                      # overload / per-minute limit
        except ValueError:                                # model returned malformed JSON
            wait = 2
        except httpx.TransportError:                      # DNS/connection blip
            wait = 15 * (attempt + 1)
        time.sleep(wait)
    raise RuntimeError("giving up on this page after 4 attempts")


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def extract_pages(pages: list[int], model: str) -> tuple[list[int], float | None]:
    """Transcribe pages with one model. Returns (pages that failed, seconds until the daily
    quota resets if it was hit else None). Successful pages are cached immediately."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if not pages:
        return [], None
    log(f"{len(pages)} pages with {model}")
    client = genai.Client(api_key=config.GEMINI_API_KEY)
    doc = pymupdf.open(PDF_PATH)
    stop = threading.Event()
    wait: list[float] = []

    def work(p: int) -> tuple[int, str]:
        if stop.is_set():
            return p, "skipped"
        try:
            result = transcribe(client, render(doc, p), model)
        except DailyQuotaExceeded as e:
            stop.set()
            wait.append(e.wait_seconds)
            return p, "quota"
        except Exception as e:                            # keep going; the page is retried later
            return p, f"FAILED {type(e).__name__}: {str(e)[:80]}"
        page_path(p).write_text(result.model_dump_json(indent=1), encoding="utf-8")
        record_model(p, model)
        return p, f"ok ({len(result.rows)} rows)"

    failed = []
    with ThreadPoolExecutor(WORKERS) as pool:
        for p, msg in pool.map(work, pages):
            if not msg.startswith("ok"):
                failed.append(p)
            if msg != "skipped":
                log(f"  page {p}: {msg}")
    return failed, (min(wait) if wait else None)


def keep_awake() -> None:
    """Stop Windows sleeping while this process runs (does not change any setting)."""
    try:
        import ctypes
        ctypes.windll.kernel32.SetThreadExecutionState(0x80000000 | 0x00000001)
    except (AttributeError, OSError):
        pass


def auto() -> None:
    """Unattended run: dish pages with the full model, everything else with the lite model;
    sleeps through daily-quota resets and resumes until every page is cached."""
    keep_awake()
    every_page = list(range(FIRST_PAGE, LAST_PAGE + 1))
    stuck_rounds = 0
    while True:
        done = recorded_models()
        dish_todo = [p for p in DISH_PAGES if done.get(p) != FULL_MODEL]
        rest_todo = [p for p in every_page if p not in done and p not in DISH_PAGES]
        log(f"{len(done)} pages cached; to do: {len(dish_todo)} dish pages (full model), "
            f"{len(rest_todo)} other pages (lite model)")
        if not dish_todo and not rest_todo:
            break
        progress_before = len(done)
        waits = []
        for pages, model in ((dish_todo, FULL_MODEL), (rest_todo, LITE_MODEL)):
            _, quota_wait = extract_pages(pages, model)
            if quota_wait is not None:
                waits.append(quota_wait)
        # A page with no cache yet still counts as "cached by the lite model" if the full model
        # was out of quota, so fall back to lite for dish pages that have nothing at all.
        missing_dish = [p for p in DISH_PAGES if p not in recorded_models()]
        if missing_dish and waits:
            extract_pages(missing_dish, LITE_MODEL)
        if len(recorded_models()) == progress_before and not waits:
            stuck_rounds += 1
            if stuck_rounds >= 3:
                log("no progress for 3 rounds (not a quota problem); stopping")
                break
        else:
            stuck_rounds = 0
        if waits:
            sleep_for = min(max(waits), 8 * 3600) + 60
            log(f"daily quota reached; sleeping {sleep_for / 3600:.1f} h, then resuming")
            time.sleep(sleep_for)
        else:
            time.sleep(60)
    done = recorded_models()
    log(f"finished: {sum(1 for p in every_page if p in done)}/{len(every_page)} pages cached; "
        f"{sum(1 for p in DISH_PAGES if done.get(p) == FULL_MODEL)}/{len(DISH_PAGES)} dish pages "
        f"by the full model")
    build()


# --- cleaning + checks ----------------------------------------------------------------

def number(text: str | None) -> tuple[float | None, bool]:
    """'(15.36)' -> (15.36, True); '-' or None -> (None, False). Bool = was in parentheses."""
    if text is None:
        return None, False
    t = text.strip()
    in_paren = t.startswith("(")
    t = t.strip("()").replace(",", "").strip()
    try:
        return float(t), in_paren
    except ValueError:
        return None, in_paren


def check(kcal, protein, fat, carbs, fibre) -> str:
    """Return '' if the row is consistent, else a short reason for manual review."""
    if None in (kcal, protein, fat, carbs):
        return "missing value"
    if protein + fat + carbs > 105:
        return "macros exceed 100 g"
    # The table's energy counts fibre too (about 2 kcal/g), so it is part of the expectation.
    expected = 4 * protein + 9 * fat + 4 * carbs + 2 * (fibre or 0)
    if abs(kcal - expected) > max(12, 0.15 * kcal):
        return f"energy {kcal:g} vs {expected:.0f} from macros"
    return ""


_ODD_LETTERS = re.compile(r"[຀-໿Ѐ-ӿ؀-ۿ぀-ヿ一-鿿]")
_DOUBLED_MARKS = re.compile(r"[่-๋]{2}|[ัิ-ฺ]{2}")


def name_problem(name: str) -> str:
    """Spot garbled Thai (stray Lao/Cyrillic/CJK letters, doubled tone marks) from the vision
    model; the energy check cannot see wrong names."""
    if _ODD_LETTERS.search(name):
        return "non-Thai letter in name"
    if _DOUBLED_MARKS.search(name) or name[:1] in "ัิีึืุู่้๊๋":
        return "garbled Thai name"
    return ""


def attach_serving_rows(rows: list[dict]) -> list[dict]:
    """The dessert pages print two lines per food: the 100 g row and a serving row
    ("1 piece (27 g)") with the same Food ID. The serving's weight is its energy relative to the
    100 g row, so use it as the food's serving size (serving_g) and drop the extra row.
    A same-ID row that does not scale consistently stays in the list and keeps its flag."""
    by_id: dict[str, dict] = {}
    out = []
    for r in rows:
        first = by_id.get(r["food_id"])
        if first is None:
            r.setdefault("serving_g", "")
            by_id[r["food_id"]] = r
            out.append(r)
            continue
        ratio = r["kcal"] / first["kcal"] if r["kcal"] and first["kcal"] else None
        consistent = ratio is not None and 0.02 <= ratio <= 3 and first["pdf_page"] == r["pdf_page"]
        if consistent:
            for k in ("protein_g", "fat_g", "carbs_g"):
                a, b = first[k], r[k]
                if a is not None and b is not None and a > 2 and abs(b / a - ratio) > 0.25 * ratio:
                    consistent = False
        if consistent and not first["serving_g"]:
            first["serving_g"] = round(100 * ratio)
            continue
        r["serving_g"] = ""
        r["review"] = r["review"] or f"duplicate food_id (also page {first['pdf_page']})"
        out.append(r)
    return out


def build() -> None:
    models = recorded_models()
    rows = []
    for path in sorted(OUT_DIR.glob("page_*.json")):
        page = int(path.stem.split("_")[1])
        for r in PageRows.model_validate_json(path.read_text(encoding="utf-8")).rows:
            if not (r.food_id and r.name_th):
                continue
            kcal, p1 = number(r.energy)
            protein, _ = number(r.protein)
            fat, _ = number(r.fat)
            carbs, p2 = number(r.carbs)
            fibre, _ = number(r.fibre)
            problem = check(kcal, protein, fat, carbs, fibre) or name_problem(r.name_th)
            rows.append({"food_id": r.food_id.strip(), "name_th": r.name_th.strip(),
                         "name_en": (r.name_en or "").strip(), "kcal": kcal, "protein_g": protein,
                         "fat_g": fat, "carbs_g": carbs, "fibre_g": fibre,
                         "calculated_values": int(p1 or p2), "pdf_page": page,
                         "model": models.get(page, FULL_MODEL),
                         # the lite model reads numbers well but sometimes garbles Thai letters
                         "name_verified": int(models.get(page, FULL_MODEL) != LITE_MODEL),
                         "review": problem})
    rows = attach_serving_rows(rows)
    out = OUT_DIR / "foods.csv"
    with open(out, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    flagged = [r for r in rows if r["review"]]
    log(f"{len(rows)} foods -> {out}; {len(flagged)} flagged for review "
        f"({len(flagged) / len(rows):.0%})")
    for r in flagged[:40]:
        print(f"   p{r['pdf_page']:>3} {r['food_id']:>6} {r['name_th'][:28]:28} {r['review']}")


def parse_range(text: str) -> list[int]:
    """'96-97' or '23,31,35' or '89,91-95' -> list of PDF page numbers."""
    pages: list[int] = []
    for part in text.split(","):
        m = re.fullmatch(r"(\d+)(?:-(\d+))?", part.strip())
        if not m:
            raise argparse.ArgumentTypeError("use N, N-M or a comma-separated mix, e.g. 23,31,89-95")
        pages += range(int(m[1]), int(m[2] or m[1]) + 1)
    return pages


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--pages", type=parse_range, help="PDF pages, e.g. 96-97")
    ap.add_argument("--build", action="store_true", help="combine cached pages into foods.csv")
    ap.add_argument("--auto", action="store_true", help="unattended full run (see above)")
    ap.add_argument("--model", default=FULL_MODEL, help=f"model for --pages (default {FULL_MODEL})")
    args = ap.parse_args()
    if args.build:
        build()
    elif args.auto:
        auto()
    else:
        extract_pages(args.pages or list(range(FIRST_PAGE, LAST_PAGE + 1)), args.model)


if __name__ == "__main__":
    main()
