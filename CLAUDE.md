# Munchy — project context for Claude Code

## What this is
Munchy is the estimation engine for a future "eating coach" web app. It takes a
dish name plus a little free-text detail and returns calories and macros.

Input examples (these are the reference test cases):
- `ข้าวเหนียวหมูปิ้ง 5 ไม้`
- `สลัดอกไก่ ใส่แตงกวา มะเขือเทศ ไข่ต้ม 1 ฟอง`
- `cheese mashed potato with gravy sauce`

Output: total kcal, protein (g), fat (g), carbs (g), plus a per-item breakdown and
any assumptions made (e.g. "assumed 1 serving of sticky rice", "assumed default dressing").

Current scope: **backend only, no UI.** A CLI first, a FastAPI endpoint later
(the future frontend will be Next.js on Vercel and will call that endpoint).

## Core design decisions (already agreed — don't redesign without asking)
1. **Hybrid pipeline.** An LLM is used ONLY to parse free text into structured
   items. It never produces nutrition numbers.
2. **Numbers come from our own nutrition database + deterministic code**, so
   results are grounded, explainable and editable.
3. The parser's output is a fixed JSON schema, so the LLM can later be swapped
   for a self-hosted open model (Qwen, or Typhoon for Thai) via Ollama without
   touching the rest of the pipeline.
4. The owner wants the non-LLM parts (database, matching, portions, later any
   trained models) to be their own work — it's a portfolio project.
5. Estimates are approximate by nature (oil and portion size dominate the error),
   so always surface assumptions and low-confidence matches instead of hiding them.

## Pipeline
```
text
 -> parser.py     LLM -> [{"food": "หมูปิ้ง", "qty": 5, "unit": "ไม้"}, ...]  (Pydantic-validated)
 -> matcher.py    each food name -> DB entry (BGE-M3 embeddings + rapidfuzz fallback), with a confidence score
 -> nutrition.py  qty + unit -> grams -> scale nutrients per 100 g -> sum totals
 -> cli.py        print breakdown + totals + assumptions
```

Known tricky cases the design must handle:
- **Combo dishes**: in `ข้าวเหนียวหมูปิ้ง 5 ไม้` the "5 ไม้" applies to หมูปิ้ง, not the
  sticky rice. Combo dishes are stored as components; the quantity attaches to the
  right component and the others use default servings.
- **Thai count units**: ไม้, ฟอง, จาน, ถ้วย, ห่อ, ช้อน… each food stores grams per unit.
- **Missing info**: no quantity -> default serving; salad with no dressing stated ->
  default dressing assumption. Report every assumption.
- **Mixed Thai/English input**: BGE-M3 embeds both into one space.

## Stack
- Python 3.12 (Windows), virtual env in `.venv/`
- pydantic, python-dotenv
- sentence-transformers (model `BAAI/bge-m3`), numpy (plain cosine similarity is
  enough; FAISS only if the food table gets large), rapidfuzz
- pandas for cleaning datasets
- SQLite (`data/foods.db`); move to Postgres/Supabase only when the web app exists
- pytest
- LLM provider for the parser: **not decided yet** (Gemini free tier vs Claude API).
  Ask the user at step 4.
- Later: FastAPI, Ollama

Nutrition data sources (step 11): Thai Food Composition Database (INMU, Mahidol)
for Thai dishes/ingredients, USDA FoodData Central for raw ingredients and Western food.

## Project layout
```
data/raw/          original downloaded datasets (gitignored)
data/processed/    cleaned CSVs (gitignored)
data/foods.db      SQLite database (gitignored, rebuildable from code)
src/config.py      loads .env (API keys, EMBEDDING_MODEL, DB_PATH)
src/db.py          schema + seed data            (step 2-3)
src/parser.py      text -> structured items      (step 4)
src/matcher.py     food name -> DB entry         (step 5)
src/nutrition.py   portions -> totals            (step 6)
src/pipeline.py    parse -> match -> calculate   (step 7; shared by cli.py and the future API)
src/parse_cache.py cache of LLM parse results    (step 10; data/cache.db)
src/doh_import.py  Dept. of Health Thai food table -> DB (step 11); extract_doh_table.py transcribes the PDF
src/api.py         FastAPI app, POST /estimate    (step 14)
evaluate.py        pipeline error vs USDA reference dishes (step 12); build_eval_set.py builds the CSV
src/textutil.py    shared text normalisation
calibrate_matcher.py  picks matcher thresholds from data/eval/match_queries.csv (step 9)
data/eval/         evaluation/calibration queries (tracked in git)
cli.py             entry point                   (step 7)
check_setup.py     verifies the environment
tests/
ROADMAP.md         step list with progress checkboxes
```

## How to work with the owner (important)
- **Build step by step.** Do only the step the user asks for. Before writing code
  for a step, briefly explain the plan (tables, functions, trade-offs) and wait for
  the user's OK. After the step, show how to run/verify it, then stop.
- The owner is a Computer Engineering student who wants to understand what's being
  built, not just receive code — explain the "why" concisely.
- Direct, peer-like tone. Reply in whatever language the user writes in (English or Thai).
- When a step is finished and verified, tick it in `ROADMAP.md` and add a one-line note
  if a decision was made.
- Environment: Windows + PowerShell, VS Code. Activate with `.venv\Scripts\activate`.
  Run things from the project root. Conda `(base)` may also be active; `.venv` on top is fine.
- Never commit or print secrets from `.env`. Keep `.env.example` in sync when adding settings.
- Keep `foods.db` rebuildable from code/CSV (seed scripts), never hand-edited only.
- Add/keep pytest cases for the three reference inputs as the pipeline comes together.
