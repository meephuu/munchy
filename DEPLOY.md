# Putting Munchy online

Nothing here has been run yet: it is a checklist worked out from how the code is built, to follow when you want real
users. Items marked **you** need your own accounts; the rest is already in the code.

## The three pieces

| Piece | Runs | Needs |
|-------|------|-------|
| Frontend (Next.js, `frontend/`) | Vercel | the two Supabase values, the backend's address |
| Backend (FastAPI, `backend/`) | a host that stays on | ~3 GB RAM, `data/foods.db`, a Gemini key |
| Accounts and meals (Supabase) | Supabase | the SQL files in `supabase/migrations/` run once |

The browser only ever talks to the frontend (and to Supabase for accounts and meals). The frontend's server calls the
backend, so the backend never needs to be reachable from browsers and needs no CORS setup for the web app.

## 1. Supabase (you)
1. Run every file in `supabase/migrations/` in the SQL Editor, in file-name order (profiles, meals,
   favorites/weights/dishes, birth date).
2. **Authentication → Providers → Email**: turn **Confirm email** back **on** (it is off for development).
3. **Authentication → URL Configuration**: set **Site URL** to the public address of the frontend, and add
   `https://<your-domain>/auth/callback` to **Redirect URLs**.
4. **Authentication → SMTP Settings**: Supabase's built-in sender is limited to a few emails an hour and is meant for
   testing. For real sign-ups set your own sender (Resend, Brevo, Gmail SMTP...).
5. Delete the test users (`munchy-test-…@example.com`).
6. Keep the **secret / service_role** key out of the frontend and out of git. The app only uses the URL and the
   publishable key; every table is protected by row-level security.

## 2. Backend host (you choose)
The hard part, because of the embedding model (BAAI/bge-m3, ~2.3 GB on disk, ~3 GB RAM with PyTorch).

| Option | Good | Bad |
|--------|------|-----|
| Small always-on VPS or a container host with 4 GB (Hetzner, Fly.io, Railway, Render paid tier) | simplest, unchanged code | monthly cost |
| Free tiers (512 MB to 1 GB) | free | will not fit the model |
| Swap bge-m3 for a smaller multilingual model (for example multilingual-e5-small) or a hosted embeddings API | fits small hosts | needs the matcher thresholds re-calibrated (`calibrate_matcher.py`) |

What the host needs:
- Python 3.12 and `pip install -r backend/requirements.txt` (use the CPU build of PyTorch to keep it smaller).
- `backend/data/foods.db`. It is not in git; build it on the host with `python -m src.db --seed` (needs the USDA and DoH
  downloads described in `backend/README.md`) or copy the file from your machine.
- Environment variables (see `backend/.env.example`): `GEMINI_API_KEY`, `LLM_PROVIDER=gemini`, `CORS_ORIGINS`.
- Start with `uvicorn src.api:app --host 0.0.0.0 --port 8000` (one worker: the model is loaded once per worker).
  Startup takes about 25 s while the model loads; use `GET /health` as the health check.
- Warm the cache once so common dishes answer instantly: `python warm_cache.py`. Keep `data/cache.db` on a persistent
  disk, or it is lost on every deploy.
- Put it behind HTTPS and do not publish its address; only the frontend server needs it.

Gemini free tier: it has request limits and the model is sometimes overloaded (the code falls back to a second model once).
For many users, switch to a paid key, or to the self-hosted Ollama path described in `backend/README.md`.

## 3. Frontend on Vercel (you)
1. Import the repository, set **Root Directory** to `frontend`.
2. Environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `BACKEND_URL` = the backend's HTTPS address (server-side only)
3. Deploy, then put the Vercel address into Supabase's Site URL and Redirect URLs (step 1.3).

## 4. Smoke test after deploying
- Guest: search a dish, edit amounts, "Get started", sign up, receive the confirmation email, log in.
- Member: log a meal, see it on Home, edit it, open Progress, Coach, Account; log weight.
- A second account sees none of the first account's data.
- Reload a new dish twice: the second answer is fast (cache), and with the backend stopped the page says it cannot
  reach the estimator rather than breaking.

## Before inviting people
- Estimates are approximate and the app says so; the "not medical advice" note stays on the profile screens.
- The Thai food names in the database are mostly unchecked (`backend/ROADMAP.md`), and permission to publish the DoH
  data should be confirmed.
- Add a privacy note: the app stores email, profile (body numbers, date of birth), meals and weights in Supabase, and
  sends dish text (never account data) to Google's Gemini API.
