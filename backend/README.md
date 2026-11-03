# Munchy

Estimate calories and macros from a dish name plus a bit of detail.

```
ข้าวเหนียวหมูปิ้ง 5 ไม้                       -> kcal, protein, fat, carbs
สลัดอกไก่ ใส่แตงกวา มะเขือเทศ ไข่ต้ม 1 ฟอง
cheese mashed potato with gravy sauce
```

An LLM only **parses** the text into items; every number comes from our own nutrition
database and deterministic code, so results are explainable. Estimates are approximate by
nature (portion size and cooking oil dominate the error), so assumptions and weak matches
are always shown.

## Pipeline
text -> **parser** (items + qty + unit) -> **matcher** (food DB entry) -> **nutrition** (grams -> totals)

Results are always in English. If the database has no entry for a prepared dish ("caesar salad"), a
second LLM call lists its usual parts (names only, no amounts); each part is matched, given a default
serving and reported as an assumption.

## Setup (Windows)
```powershell
cd backend                    # run everything below from backend/
py -m venv ..\.venv           # one venv at the repo root, shared by the whole project
..\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env        # then put your GEMINI_API_KEY in .env
python check_setup.py
python -m src.db --seed       # build data/foods.db from data/seed/*.csv (+ DoH and USDA data if downloaded)
```

## Use it
```powershell
python cli.py "ข้าวเหนียวหมูปิ้ง 5 ไม้"        # --no-cache forces a fresh LLM parse
uvicorn src.api:app --reload                  # API on http://127.0.0.1:8000 (docs at /docs)
```
```
POST /estimate   {"text": "ข้าวเหนียวหมูปิ้ง 5 ไม้", "use_cache": true}
-> totals, per-food lines (grams, per_100g, units), matches, assumptions, warnings, unmatched, complete
GET  /foods/search?q=egg&limit=8   -> foods to add to a meal: id, name, per_100g, default_serving_g, units
GET  /health
```

## Tests
```powershell
python -m pytest              # offline and fast
python -m pytest -m live      # real Gemini API (needs a key)
python -m pytest -m slow      # real BGE-M3 embedding model
```

## Evaluate and tune
```powershell
python evaluate.py            # 21 dishes vs USDA reference values: mean/median % error, worst cases
python calibrate_matcher.py   # re-pick the matcher's confidence thresholds from data/eval/match_queries.csv
```
The evaluation shows where our data and USDA disagree, not which one is right for Thai foods
(for example Thai steamed sticky rice is far denser than USDA's boiled rice).

## LLM provider
Gemini by default. For a self-hosted model set `LLM_PROVIDER=ollama` (and `OLLAMA_MODEL`) in
`.env` after installing Ollama and pulling the model; see `.env.example`.

## Layout
```
data/
  seed/        hand-curated foods, units, aliases, combo dishes, links to the DoH table (in git)
  eval/        calibration + evaluation queries (in git)
  raw/         downloaded datasets (gitignored)
  processed/   transcribed/cleaned data and caches (gitignored)
src/
  config.py       settings from .env
  db.py           schema + seeding
  doh_import.py   Department of Health Thai food table -> DB
  usda_import.py  generic USDA SR Legacy foods -> DB
  parser.py       text -> structured items (Gemini / Ollama)
  parse_cache.py  cache of LLM parses
  matcher.py      food name -> DB entry (BGE-M3 + fuzzy), confidence classification
  nutrition.py    portions -> totals, assumptions
  pipeline.py     parse -> match -> calculate
  api.py          FastAPI app
cli.py                 command-line entry point
extract_doh_table.py   transcribes the scanned DoH table (vision model + checks)
calibrate_matcher.py   picks matcher thresholds from data/eval/match_queries.csv
tests/
```

## Data sources
- **Department of Health, Thailand** (Bureau of Nutrition): *Food Composition Table of Thai
  Foods*, 2018. Transcribed from the published PDF; the table is **not** redistributed in this
  repo because its licence is unclear. Credit the Bureau of Nutrition when showing results.
- **USDA FoodData Central, SR Legacy** (public domain, CC0): ~5,750 generic foods (Western ingredients,
  dressings, dairy...) loaded into the DB, and reference values for evaluation. Download the SR Legacy CSV
  zip from fdc.nal.usda.gov and unzip it to `data/raw/usda_sr_legacy_csv/` before `python -m src.db --seed`.
- Hand-entered placeholder values in `data/seed/` are approximate and marked `source='seed'`.
