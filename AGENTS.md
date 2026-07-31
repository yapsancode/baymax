# AGENTS.md

Quick orientation for coding agents. **CLAUDE.md is the deep reference** (full architecture, request flow, env var list) — this file holds the traps and non-obvious facts. Where they disagree, trust the code.

- The root `README.md` is the default GitLab template — it has no project information.
- `learning/` is generated curriculum material, not application code.

## Layout

Monorepo, two deployable units. **Run every install/server/test command inside the subpackage dir, never at the repo root** (the stray root `package-lock.json` and `.venv/` are accidents — don't add to them).

- `baymax-extension/` — Chrome MV3 extension (Vite + React 19, JSX, Tailwind 4)
- `baymax-backend/` — FastAPI + LangChain/Gemini service (Python 3.12), deployed to Cloud Run from its `Dockerfile`

## Commands

Backend — always from `baymax-backend/`:

```bash
source venv/bin/activate   # first time: python -m venv venv && pip install -r requirements.txt
uvicorn main:app --reload  # → http://127.0.0.1:8000/docs
pytest tests/ -v           # full suite — needs NO database and NO Gemini key
pytest tests/test_smoke.py # fastest check: imports + route registration
```

- **CWD matters:** the backend uses bare imports (`from config import settings`, `import db_call`) and pydantic-settings resolves `.env` from the current directory. From the repo root, imports happen to work (conftest fixes `sys.path`) but settings silently miss `.env`.
- Runtime needs `baymax-backend/.env` (Supabase, `DATABASE_URL`, `GEMINI_API_KEY`, ...). Never commit it — CI runs secret detection and `.env` is gitignored.
- Docker: `docker build -t baymax-backend . && docker run --rm -p 8080:8080 --env-file .env baymax-backend` (container listens on `$PORT`, default 8080).

Frontend — always from `baymax-extension/`:

```bash
npm run dev    # localhost UI dev only — this is NOT the extension
npm run build  # → dist/, then chrome://extensions → Load unpacked → select dist/
npm run lint   # eslint
npm run format # prettier
```

- **The extension only works from a build.** Reload it at `chrome://extensions` after every `npm run build`. `npm run dev` cannot exercise the side panel or content scripts.

## Backend rules (layering is by convention — follow it)

Golden rule: `routers/ = HTTP · schemas/ = API shape (Pydantic) · models.py = DB shape (SQLAlchemy) · db_call.py = every DB read/write · services/ = external calls only (Supabase/Gemini) · config.py = env vars`.

- Never `db.add()`/`select()` in a router; never put DB code in `services/`.
- Never `os.getenv` — add a typed field to `Settings` in `config.py`.
- New router file → register it with `app.include_router(...)` in `main.py`, or routes silently 404.
- Full recipe with worked example: `baymax-backend/ADDING_AN_ENDPOINT.md`.
- Auth: JWTs are verified against the Supabase JWKS endpoint (accept `["ES256", "RS256"]`) by `get_current_user` in `services/auth_service.py`. There is no shared JWT secret — don't add one.
- `DATABASE_URL` (Postgres connection string, SQLAlchemy) ≠ `SUPABASE_URL` (https API URL, supabase client + JWKS). Don't mix them up.
- A guide becomes `is_official` ONLY via `python data/seed_official_guide.py <guide.json> --email <owner>`. The API can never set it (POST /guides strips it; DELETE can't touch official guides).
- Chat's deterministic path is a keyword matcher over `data/gcp_recipes.json` (`services/rag_service.py`) — official-guide matches bypass the LLM.

## Frontend / extension rules

- Three contexts: side panel (React app) ↔ content scripts ↔ background worker. **Only the side panel calls the backend**, via `src/lib/api.js` (attaches the Supabase bearer token). Keep all API functions in that file. `public/background.js` does no API work; content scripts never call the API.
- `public/*.js` (`guide-overlay.js`, `voice-listener.js`, `background.js`) are **plain bundler-free JS** — no imports, Vite does not process them. `manifest.json` + `background.js` are static-copied into `dist/`; the other `public/` files are copied by Vite's public-dir behavior.
- The GCP Console renders most pages in same-origin iframes → the side panel broadcasts `chrome.tabs.sendMessage` to **every frame** (`src/lib/guide.js`). Don't send to frame 0 only.
- Steps are intents, not selectors (`{role, name, text, selector, ...}` scored by `guide-overlay.js`). The backend's copy of a step is lossy (progress tracking only) — the full local steps drive navigation; never swap to the backend copy mid-run.
- Build output file names are intentionally **unhashed** (`vite.config.js`) so `manifest.json`/`dashboard.html` can reference fixed paths — don't re-enable hashing.
- Frontend env lives in `baymax-extension/.env` (gitignored): `VITE_API_BASE_URL` (default `http://127.0.0.1:8000`), `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Publishable key only — never the secret key.
- The extension origin must be in the backend's `ALLOWED_ORIGINS` (`chrome-extension://<id>`) or every call is CORS-blocked.

## Known drift in CLAUDE.md

CLAUDE.md predates a few changes — verify against code:

- Newer services exist beyond its list: `services/refine_service.py` (`POST /guidance/refine`), `services/rag_service.py`, `services/embedding_service.py`; second official guide `data/official_cloud_sql_guide.json`.
- `GEMINI_FALLBACK_MODELS` default is `gemini-2.5-flash-lite,gemini-2.5-pro`; extra settings `REFINE_RATE_LIMIT`, `REFINE_SEARCH_GROUNDING` exist.
- Frontend env file is `.env` (CLAUDE.md says `.env.local`).
