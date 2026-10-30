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
- [ ] 5. Matcher — BGE-M3 embeddings + cosine search, rapidfuzz fallback, confidence score
- [ ] 6. Calculator — units -> grams, scale nutrients, sum totals
- [ ] 7. CLI — `python cli.py "<dish>"` prints breakdown + totals (first working version)

## Phase 3 — Make it good
- [ ] 8. Defaults & assumptions — missing quantity, dressing, cooking oil; show assumptions in output
- [ ] 9. Low-confidence handling — flag weak matches instead of guessing silently
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
