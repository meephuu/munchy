# Munchy roadmap

Each step ends with something runnable/checkable before moving on.
Tick a box only when the step is done and verified.

## Phase 1 — Foundation
- [x] 1. Project setup — folders, venv, dependencies, `.env`, `check_setup.py`
      _(verify: `python check_setup.py` prints "ready for step 2")_
- [x] 2. Nutrition data schema — SQLite tables: foods (nutrients per 100 g),
      units (ไม้/ฟอง/จาน… -> grams per food), combo dishes (dish -> components + default servings)
      _(decided: 4 tables `foods`, `food_units`, `food_aliases`, `combo_components`; combo quantity attaches via `takes_user_qty`; parser returns the combo name, code does the split; raw/cooked are separate rows)_
- [x] 3. Seed database — ~30-50 hand-entered common foods covering the 3 reference inputs,
      loaded by a script so the DB is rebuildable
      _(decided: seed data lives in `data/seed/*.csv`, loaded by `seed_db()`; values are approximate placeholders with `source='seed'`, replaced at step 11)_

## Phase 2 — Core pipeline
- [x] 4. Parser — LLM text -> JSON items (`food`, `qty`, `unit`), Pydantic-validated
      _(decided: Gemini (`gemini-3.5-flash-lite`, set in `.env`) behind a `complete(text) -> json` function so other providers can be swapped in; combo names stay whole, the DB splits them; live tests run with `pytest -m live`)_
- [x] 5. Matcher — BGE-M3 embeddings + cosine search, rapidfuzz fallback, confidence score
      _(decided: exact match -> embeddings -> fuzzy only when embedding is weak; returns top-k per-food matches; embeddings cached in `data/processed/`; raw cosine is poorly calibrated on 34 foods (nonsense scores ~0.5-0.6), so step 9 should use the top-1/top-2 margin and tune thresholds in step 13; real-model tests run with `pytest -m slow`)_
- [x] 6. Calculator — units -> grams, scale nutrients, sum totals
      _(decided: a user-named item replaces the matching default component of a combo; qty with no unit = default servings; unknown unit falls back to servings with a visible warning)_
- [x] 7. CLI — `python cli.py "<dish>"` prints breakdown + totals (first working version)
      _(decided: orchestration lives in `src/pipeline.py` so FastAPI can reuse it; CLI prints each match's method + confidence but does not flag weak matches yet (step 9))_

## Phase 3 — Make it good
- [x] 8. Defaults & assumptions — missing quantity, dressing, cooking oil; show assumptions in output
      _(decided: missing quantity/dressing were already covered by steps 6-7; cooking oil is a per-food `oil_note` shown as an assumption; assumptions stay plain strings until the API step)_
- [x] 9. Low-confidence handling — flag weak matches instead of guessing silently
      _(decided: `classify()` -> ok / uncertain / no_match; no_match items are left out of totals with a "totals incomplete" warning, uncertain ones are counted but warned; thresholds LOW 0.65 / HIGH 0.80 / MARGIN 0.05 chosen with `calibrate_matcher.py` on `data/eval/match_queries.csv`; on that set 1 wrong match and 2 unknown foods still pass silently — re-run the script after step 11)_
- [x] 10. Cache — store parse results so repeated dishes skip the LLM
      _(decided: separate `data/cache.db` (survives re-seeding); key = hash of normalised text + provider + model + system prompt, so prompt/model changes miss automatically; only validated parses are stored; `--no-cache` flag; a hit needs no API key)_

## Phase 4 — Real data & evaluation
- [x] 11. Import real datasets — clean INMU Thai FCD + USDA FoodData Central with pandas, load into DB
      _(decided: INMU is not downloadable (all rights reserved), so the Dept. of Health 2018 Thai table (scanned PDF) is the Thai source: transcribed with a vision model and checked in code (energy vs macros, garbled-name check), 1,169 foods of which 1,115 are imported (40 flagged rows left out); 14 seed placeholders are linked to real rows, 25 dish aliases added, dessert serving sizes come from the table; the transcribed table stays gitignored because its licence is unclear; USDA SR Legacy is used as the independent reference for evaluation (step 12), not imported)_
- [x] 12. Evaluation set — CSV of dishes with known nutrition + script reporting average error
      _(decided: 21 dishes whose expected kcal/macros come from USDA SR Legacy x explicit grams (independent of our DB; spec in `data/eval/dishes_spec.csv`, built by `build_eval_set.py`); `python evaluate.py` runs the real pipeline and reports mean/median % error; references must compare like with like — the first fries reference was oven-heated frozen fries vs our deep-fried seed and looked like a 111% error)_
- [x] 13. Improve — tune thresholds, add units/combos based on failures
      _(decided: matcher thresholds re-picked on the ~1,150-food table (LOW 0.68 / HIGH 0.80 / MARGIN 0.08): on the 65 calibration queries top-1 is right for 43/43 known foods, no wrong match passes unflagged and 0/22 unknown foods slip through unflagged; aliases added for the reference dishes and popular Thai dishes; the evaluation's mean error is 11.7% vs 3.9% for the old placeholders — NOT a regression: the placeholders were written from the same USDA-style numbers the evaluation uses as truth, while the Thai table differs for real reasons (more oil in Thai fried egg, Thai bread, steamed sticky rice 230 vs USDA 97 kcal/100 g), so the evaluation shows where sources disagree, not which is right for Thai foods)_

## Phase 5 — Ready for the app
- [x] 14. FastAPI wrapper — `POST /estimate`
      _(decided: embedding model loaded once at startup; partial results return 200 with `complete: false` + warnings; pipeline errors map to 422/500/502/503 without leaking provider details; CORS origins from `CORS_ORIGINS`; verified against a real running server)_
- [x] 15. (Optional) Swap LLM parser for self-hosted Qwen/Typhoon via Ollama
      _(done as code + mocked tests only: `LLM_PROVIDER=ollama` with `OLLAMA_MODEL`; not run against a real Ollama server because it is not installed here — accuracy of a local model on the eval set is still unmeasured)_

## Where we are: all 15 steps done; known follow-ups
- **Thai names are unverified for most imported rows.** Numbers are checked in code (energy vs
  macros) and were read correctly in every spot check, but the lite vision model sometimes
  garbles a Thai letter (page 66: 1 of 13 names, e.g. ปลากดทะเล read as ปลาดุกทะเล). The English
  names are right and are matched too. Rows are marked in `foods.notes` ("Thai name not verified").
  To fix: when the Gemini free-tier quota allows, re-read pages with the better model, e.g.
  `python extract_doh_table.py --pages 9-88 --model gemini-flash-latest` (a few pages at a time;
  `gemini-3.5-flash` allows only ~20 requests/day, `gemini-flash-latest` a similar amount), then
  `python extract_doh_table.py --build` and `python -m src.db --seed`. Dish pages 89-100 are already
  read by the better model; pages 101-108 are not.
- 40 rows are still excluded (printed values missing or inconsistent); see the `review` column of
  `data/processed/doh2018/foods.csv`.
- Re-run `python calibrate_matcher.py` and `python evaluate.py` after any change to the food table.
- Ask the Bureau of Nutrition (Dept. of Health) for permission before publishing the database or
  the transcribed table; credit them in the app.
- Next ideas: more combos/units for common dishes, a real-world eval set of Thai dishes with
  weighed portions, a Next.js frontend that calls `POST /estimate`.

## Decisions log
- Hybrid design: LLM parses only; nutrition numbers come from our DB + code.
- Python-only backend for now; SQLite until the web app exists.
