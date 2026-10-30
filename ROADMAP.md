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
- [ ] 10. Cache — store parse results so repeated dishes skip the LLM

## Phase 4 — Real data & evaluation
- [ ] 11. Import real datasets — clean INMU Thai FCD + USDA FoodData Central with pandas, load into DB
- [ ] 12. Evaluation set — CSV of dishes with known nutrition + script reporting average error
- [ ] 13. Improve — tune thresholds, add units/combos based on failures

## Phase 5 — Ready for the app
- [ ] 14. FastAPI wrapper — `POST /estimate`
- [ ] 15. (Optional) Swap LLM parser for self-hosted Qwen/Typhoon via Ollama

## Decisions log
- Hybrid design: LLM parses only; nutrition numbers come from our DB + code.
- Python-only backend for now; SQLite until the web app exists.
