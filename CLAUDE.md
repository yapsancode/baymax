# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Baymax** is an AI-powered Chrome Extension that gives developers contextual, step-by-step guidance for deploying to Google Cloud Platform (Cloud Run, Cloud SQL, IAM). A developer picks a task (e.g. "Host a backend on Cloud Run"), and Baymax overlays the live GCP Console — highlighting the exact button to click for each step, powered by LangChain + Gemini.

This is a **monorepo** containing three deployable units:
- `baymax-extension/` — the Chrome Extension (Vite + React), shipped to the Chrome Web Store
- `baymax-backend/` — the FastAPI service (LangChain + Gemini), deployed to Cloud Run
- `baymax-marketing/` — the standalone marketing website (Vite + React), a static build

The three units share nothing at runtime — they talk only over HTTP — so each builds, versions, and deploys independently.

Built as the capstone for the Gamuda AI Academy (Yayasan Gamuda × Google Cloud).

---

## Repository Structure

```
baymax/
  baymax-extension/            # Chrome Extension (Manifest V3, JavaScript/JSX)
    public/                   # Plain JS shipped as-is (no bundling) — the extension plumbing
      background.js           #   service worker: opens the side panel, relays RESUME_SESSION (12 lines — no API calls)
      guide-overlay.js        #   content script (all frames): resilient element resolver, highlight/mascot
                              #   overlay in a closed Shadow DOM, click/fill executors, page snapshot, recorder
      voice-listener.js       #   content script: microphone relay for speech-to-text (side panel can't get mic)
      theme-init.js
    src/
      main.jsx / App.jsx      # Side-panel app root (EntryGate → Home/Guidance/Recorder/Tasks)
      dashboard.jsx           # Second entry point: full-tab Dashboard app (dashboard.html)
      pages/                  # Home (chat + quick-start chips), Guidance (the guide orchestrator),
                              # Recorder, Tasks, Dashboard (History/Profile), Landing, Login, Register,
                              # Docs, About, Styleguide
      components/             # EntryGate + shared/ + ui/ (shadcn/Radix-based)
      lib/                    # api.js (the ONLY backend client), guide.js (side panel ↔ content
                              # script bridge), speech.js (STT/TTS), useRecorder.js, supabase.js,
                              # guides/ (bundled offline fallback copies of the official guides)
    manifest.json             # sidePanel + tabs + scripting + webNavigation; host: console.cloud.google.com
    index.html / dashboard.html / styleguide.html   # the three Vite entry points
    vite.config.js            # unhashed output names; static-copies manifest.json + background.js into dist/
    package.json

  baymax-backend/             # FastAPI service
    main.py                  # setup only: logging, tracing, rate limiter, CORS + include_router ×7
    config.py                # Settings(BaseSettings): the ONE typed place for every env var
    database.py              # Base + engine + get_db + init_db   (no ORM classes here)
    models.py                # SQLAlchemy ORM: User, Session, Step, RecordedGuide
    db_call.py               # data-access layer: every DB read/write (imports models)
    rate_limit.py            # slowapi limiter (keyed per user, IP fallback) + friendly 429 handler
    observability.py         # opt-in LangSmith tracing bridge (settings → os.environ)
    schemas/                 # Pydantic request/response shapes ONLY
      auth.py                #   RegisterRequest, LoginRequest, AuthResponse
      session.py             #   SessionCreate, SessionResponse, SessionStatusUpdate
      step.py                #   StepCreate, StepStatusUpdate, StepResponse (canonical)
      guide.py               #   GuideCreate, GuideSummary, GuideResponse
      guidance.py            #   RepairRequest/Response (self-heal) + RefineRequest/Response (recorded-guide polish)
      chat.py                #   ChatRequest (+ optional page_context/screenshot), ChatResponse, DeploymentPlan (Gemini tool schema)
      tts.py                 #   TTSRequest (response is raw audio/wav, no schema)
    routers/
      auth.py                # POST /auth/register, /auth/login, /auth/logout, GET /auth/google
      sessions.py            # POST/GET /sessions, GET/PATCH/DELETE /sessions/{id}
      steps.py               # POST/GET /sessions/{id}/steps, PATCH .../steps/{step_id}
      chat.py                # POST /chat  (the LangChain chatbot, SSE)
      guides.py              # POST/GET/DELETE /guides, GET /guides/{id}  (saved recorded guides)
      guidance.py            # POST /guidance/repair (self-heal) + /guidance/refine (polish a recording)
      tts.py                 # POST /tts  (Gemini TTS voice guide — returns audio/wav)
    services/
      auth_service.py        # supabase register/login/logout/google + get_current_user (JWKS)
      chat_service.py        # LangChain chatbot (dual-mode chat / deployment blueprint JSON)
      guidance_service.py    # LangChain self-heal: pick the live element a broken step maps to
      tts_service.py         # Gemini TTS (REST via httpx — LangChain has no audio modality)
    data/
      seed_guides.py         # CLOUD_SQL_POSTGRES_GUIDE (legacy fallback for bodyless POST .../steps)
      official_cloud_run_guide.json   # the curated Cloud Run guide (steps + meta)
      seed_official_guide.py # CLI: upsert an official guide from JSON (the ONLY path to is_official)
    tests/                   # pytest: smoke (imports + routes), schemas, official guides
    schema.sql
    requirements.txt
    Dockerfile
    .env

  baymax-marketing/           # Marketing website (Vite + React) — its own standalone app
    src/
      main.jsx / App.jsx      # Site root
      pages/                  # Landing, About, Docs
      components/             # shared/ + ui/ (shadcn/Radix-based)
      lib/
    index.html                # Vite entry point
    vite.config.js
    package.json

  learning/                   # LEARNING.md (curriculum prompt) + curriculum/ output

  .gitignore                  # Root-level — covers all three units

  README.md
  CLAUDE.md
```
## Backend
  models.py — new table? (only if needed — SQLAlchemy ORM)
  schemas/ — request/response shapes (Pydantic)
  db_call.py — the DB function
  routers/ — thin endpoint that calls db_call
  services/ — only if it calls something external (Supabase/Gemini)
  config.py — new env var? add it to Settings (never os.getenv)
  main.py — only if it's a brand-new router file

---

## How It Works (Request Flow)

Two ways a guide starts, both from the side panel (which calls the backend directly — the background worker does no API work):

```
A) Quick-start chip (curated guide)                B) Chat ask (AI or curated)
   side panel → GET /guides → GET /guides/{id}        side panel → POST /chat (SSE)
        ↓                                                  ↓
   official guide fetched from the DB                 deterministic official-guide match (no LLM),
   (offline bundled copy offered only on failure)     else LangChain → Gemini: streamed text reply
                                                      OR a DeploymentPlan tool call (blueprint);
                                                      blueprints matching an official guide are
                                                      intercepted → the curated guide wins
        ↓                                                  ↓
              user starts the guide → POST /sessions + POST /sessions/{id}/steps
              (backend copy is for progress tracking; the full local steps drive navigation)
        ↓
   side panel sends each step's intent to guide-overlay.js (chrome.tabs.sendMessage,
   broadcast to every frame — the Console renders pages in a same-origin iframe)
        ↓
   content script scores candidates by role/name/text/href and highlights the best match;
   step completes on the user's click/fill or a URL change (advanceOnUrlPattern)
        ↓
   PATCH .../steps/{step_id} marks progress; PATCH /sessions/{id} completes the session
```

Self-heal (built, currently disabled in the UI): when a step's selector stops matching,
the side panel snapshots the page's interactive elements → POST /guidance/repair → Gemini
picks the element the step now maps to (selector must be copied verbatim from the snapshot).

---

## Backend — `baymax-backend/`

### File Responsibilities

**`main.py`** — app entry point only. Configures logging, LangSmith tracing, the rate limiter + 429 handler, CORS, and includes the 7 routers. No route logic here.

**`rate_limit.py`** — the slowapi `Limiter`, keyed per authenticated user (`request.state.user_id`, set by `get_current_user`) with client-IP fallback, plus the friendly 429 handler. Storage is in-memory per process — fine for one Cloud Run instance; use a shared store (Redis) for multi-instance.

**`observability.py`** — `setup_tracing()`: bridges the typed LangSmith settings into `os.environ` so the langsmith SDK picks them up. Fully no-op unless `LANGSMITH_TRACING=true` and an API key is set.

**`config.py`** — `Settings(BaseSettings)` (pydantic-settings). The single typed place every env var is read. Import `from config import settings` — never call `os.getenv`/`load_dotenv` elsewhere.

**`database.py`** — the `Base` declarative class, the SQLAlchemy `engine`, the `get_db` FastAPI dependency, and `init_db()` to create tables. **No ORM model classes here** — those live in `models.py`.

**`models.py`** — the SQLAlchemy ORM models (`User`, `Session`, `Step`, `RecordedGuide`). They import `Base` from `database.py`. This is the *database* shape (distinct from `schemas/`, the *API* shape).

**`db_call.py`** — the **data-access layer**. Every DB read/write lives here as a plain function (`create_session`, `get_sessions_by_user`, `get_or_create_user`, `save_ai_step`, `create_recorded_guide`, ...). Imports the ORM from `models`. Routers call these; routers never run `db.add/commit/select` themselves.

**`routers/auth.py`** — auth routes: `POST /auth/register`, `/auth/login`, `/auth/logout`, `GET /auth/google`.

**`routers/sessions.py`** — session routes: `POST /sessions`, `GET /sessions`, `GET/PATCH/DELETE /sessions/{id}` (PATCH updates status: `in_progress`/`completed`/`abandoned`). Owner-scoped via `Depends(get_current_user)`. POST mirrors the Supabase auth user into `public.users` first (`get_or_create_user`) so the FK is satisfied.

**`routers/steps.py`** — step routes: `POST/GET /sessions/{id}/steps`, `PATCH /sessions/{id}/steps/{step_id}`.

**`routers/chat.py`** — `POST /chat`, the LangChain chatbot endpoint. Auth-required and rate-limited; streamed as SSE. Stateless and ephemeral — chat is not persisted and each turn is independent (no history). A blueprint is handed to the frontend, which starts a normal session (sessions + steps) if the user runs it.

**`routers/guides.py`** — saved recorded guides: `POST/GET /guides`, `GET/DELETE /guides/{id}`. Reads are own-or-official (every user sees Baymax-curated `is_official` guides); writes are strictly owner-scoped — POST can never set `is_official` and DELETE can't touch official guides.

**`routers/guidance.py`** — `POST /guidance/repair`, the self-heal endpoint (public, like `/chat`).

**`routers/tts.py`** — `POST /tts`, the voice-guide endpoint (public, rate-limited per IP). Returns raw `audio/wav` bytes, not JSON.

**`schemas/*.py`** — Pydantic request/response schemas only (`auth`, `session`, `step`, `guide`, `guidance`, `chat`, `tts`). No SQLAlchemy here. `StepResponse` has a single canonical definition in `schemas/step.py`.

**`services/auth_service.py`** — Supabase auth calls (register, login, logout, Google OAuth URL) and `get_current_user`, the FastAPI dependency that verifies JWTs via the Supabase JWKS endpoint.

**`services/chat_service.py`** — the LangChain chatbot (dual-mode: conceptual chat vs. deployment blueprint). Mode selection is native Gemini function calling — `DeploymentPlan` (schemas/chat.py) is bound as a tool; a tool call = blueprint, plain content = text. Stateless and ephemeral — no history, each turn independent. **Page-aware:** when the request carries `page_context` (a text summary of the Console page) and/or `screenshot` (a data-URL of the tab), the text reply is grounded in what the user is actually looking at (multimodal Gemini reads charts the DOM can't describe). A page-directed question ("what does this graph mean") is detected and skips the guide search so it can't return a deployment card. Called by `routers/chat.py`.

**`services/guidance_service.py`** — LangChain self-heal: given a failing step + a page snapshot, asks Gemini which live element the step now maps to (structured output, anti-hallucination guard).

**`services/tts_service.py`** — Gemini TTS: renders step text as WAV audio in the Baymax voice (voice name + style prompt live in `Settings`: `TTS_VOICE`, `TTS_STYLE_PROMPT`). Calls the Gemini REST API via httpx — the one sanctioned exception to the LangChain rule, because LangChain has no support for Gemini's audio response modality. The frontend (`lib/speech.js`) caches the audio per text and falls back to browser `speechSynthesis` if the endpoint fails.

**`data/seed_guides.py`** — static seed content: `CLOUD_SQL_POSTGRES_GUIDE`. No logic. Survives only as the fallback when `POST /sessions/{id}/steps` gets no body; deletion is deferred.

**`data/seed_official_guide.py`** — CLI (`python data/seed_official_guide.py <guide.json> --email <owner>`): upserts an official guide from a JSON file (e.g. `official_cloud_run_guide.json`). Matched by title so re-seeding refreshes steps **in place, preserving the guide id** — the ONLY path by which a guide becomes `is_official`.

### How to add a new endpoint (the recipe)

Follow the layers top-down. For most CRUD endpoints you touch 3 files; only step 5 is conditional.

1. **`models.py`** — only if you need a new table (add a SQLAlchemy ORM model).
2. **`schemas/`** — define the Pydantic request/response shapes (e.g. `XxxCreate`, `XxxResponse`).
3. **`db_call.py`** — add the DB function (`add/commit/refresh` for writes, `select` for reads).
4. **`routers/`** — add the endpoint. Keep it thin: declare the schema + `Depends(get_db)` + `Depends(get_current_user)`, call the `db_call` function, return. No SQL here.
5. **`services/`** — only if it calls something external (Supabase, Gemini). Pure DB work does NOT go here — it goes in `db_call.py`.
6. **`config.py`** — only if it needs a new env var (add a field to `Settings`; never `os.getenv`).
7. **`main.py`** — only if you created a brand-new router file (`app.include_router(...)`).

Rule of thumb: **routers = HTTP, schemas = API shape, models = DB shape, db_call = database, services = outside world, config = settings.**

---

### Development Commands

```bash
cd baymax-backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
# source venv/Scripts/activate  # Windows bash

# Install dependencies
pip install -r requirements.txt

# Run dev server
uvicorn main:app --reload

# Run tests
pytest tests/
```

---

### Running with Docker

The `Dockerfile` pins Python 3.12 + the exact dependencies, so everyone (and Cloud
Run) runs the same runtime — no "works on my machine" version drift. Requires Docker
Desktop installed.

```bash
cd baymax-backend

# Build the image
docker build -t baymax-backend .

# Run locally — pass env vars from .env at run time (they are NOT baked into the image)
docker run --rm -p 8080:8080 --env-file .env baymax-backend
# → http://localhost:8080/docs
```

Notes:
- The container listens on `$PORT` (default **8080**) — the port convention Cloud Run expects.
- `.env` is excluded from the image via `.dockerignore`. Supply it locally with
  `--env-file .env`; in production, set the vars in the Cloud Run service config.
- Docker is for a consistent **runtime / deploy**; it does **not** fix editor import
  resolution — for that, select the venv interpreter (see Environment Variables /
  `.vscode/settings.json`).

---

### Environment Variables

These are loaded once by `config.py` into the `settings` object — read them from
there (`from config import settings`), never via `os.getenv`. Create a `.env` file in
`baymax-backend/` (never commit this):

```
DATABASE_URL=            # postgresql://... (Supabase → Project Settings → Database → Connection string)
SUPABASE_URL=            # https://<project-id>.supabase.co (Supabase → Project Settings → API → Project URL)
SUPABASE_SECRET_KEY=     # sb_secret_... key (Supabase → Settings → API Keys)
SUPABASE_JWKS_URL=       # https://<project-id>.supabase.co/auth/v1/.well-known/jwks.json
GEMINI_API_KEY=          # Gemini API key
ALLOWED_ORIGINS=         # comma-separated, e.g. chrome-extension://<id>,http://localhost:5173

# --- Optional (sensible defaults in config.py) ---
GEMINI_MODEL=            # chat/repair model (default "gemini-2.5-flash")
GEMINI_FALLBACK_MODELS=  # comma-separated quota-fallback chain (default "gemini-2.0-flash,gemini-1.5-flash")
CHAT_RATE_LIMIT=         # slowapi syntax, per-user on /chat (default "20/minute")
GUIDANCE_RATE_LIMIT=     # slowapi syntax, per-IP on /guidance/repair (default "30/minute")
TTS_RATE_LIMIT=          # slowapi syntax, per-IP on /tts (default "30/minute")
TTS_MODEL=               # Gemini TTS model id (default "gemini-3.1-flash-tts-preview"; preview ids change)
TTS_VOICE=               # prebuilt Gemini voice name (default "Alnilam")
TTS_STYLE_PROMPT=        # delivery instruction prepended to the spoken text (default: calm Baymax persona)
LANGSMITH_TRACING=       # "true" to enable LangSmith tracing (default off)
LANGSMITH_API_KEY=       # LangSmith API key (smith.langchain.com → Settings)
LANGSMITH_PROJECT=       # trace project name (default "baymax")
```

Two distinct URLs: `DATABASE_URL` is the **Postgres connection string** (used by SQLAlchemy in
`database.py`); `SUPABASE_URL` is the **https project API URL** (used by the supabase client and
JWT verification in `services/auth_service.py`). Don't mix them up. JWT verification uses the
Supabase JWKS endpoint (`SUPABASE_JWKS_URL`) — no shared JWT secret needed.

---

### Key Rules for This Backend

1. **Each concern in its place.** Routes → `routers/`, Pydantic schemas → `schemas/`, SQLAlchemy ORM → `models.py`, external calls → `services/`, DB reads/writes → `db_call.py`, `Base`/`engine`/`get_db` → `database.py`, env vars → `config.py`. **`models.py` = the database shape; `schemas/` = the API shape — don't confuse them.** Don't mix layers.
2. **JWT via JWKS, not a shared secret.** Supabase's legacy HS256 JWT secret is deprecated. Verify tokens using `PyJWKClient` against the Supabase JWKS endpoint. This project's signing key is **ES256** (EC); accept `["ES256", "RS256"]` to stay robust across key rotations. `get_current_user` in `services/auth_service.py` handles this.
3. **LangChain orchestrates Gemini.** Use LangChain chains/runnables to call Gemini — do not call the Gemini SDK directly.
4. **Structured output.** Use LangChain's structured output / Pydantic output parsers so Gemini returns strict JSON the extension can render. Handle malformed output defensively.
5. **CORS is required.** The `chrome-extension://<id>` origin must be in `ALLOWED_ORIGINS` or the extension will be blocked.

---

## Frontend — `baymax-extension/`

### Development Commands

```bash
cd baymax-extension

npm install

npm run dev      # Vite dev server (localhost UI development)
npm run build    # production build → dist/
```

Load in Chrome: go to `chrome://extensions`, enable Developer Mode, click **Load unpacked**, select `baymax-extension/dist/`. Reload the extension there after each build.

Frontend env: `.env.local` with `VITE_API_BASE_URL` (defaults to `http://127.0.0.1:8000`), `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY` (read by `src/lib/supabase.js` — publishable key only, never the secret key).

### Key Rules for the Extension

- **Three contexts.** Side panel (the React app) ↔ content scripts (`public/guide-overlay.js`, `public/voice-listener.js`) ↔ background service worker (`public/background.js`). **The side panel is the only context that calls the backend** (`src/lib/api.js`, Supabase bearer token attached). The background worker does no API work — it only opens the side panel and relays `RESUME_SESSION`. Content scripts never call the API.
- **The side panel talks to content scripts directly** via `chrome.tabs.sendMessage`, **broadcast to every frame** (`src/lib/guide.js`) — the GCP Console renders most pages inside a same-origin iframe, so the target element is usually NOT in frame 0.
- **Content scripts are plain, bundler-free JS in `public/`** (classic scripts, no imports). They are not part of the Vite build; `background.js` is static-copied into `dist/`.
- **Steps are intents, not selectors.** A step carries `{ selector, role, name, text, href, avoidText, exactName, ... }`; `guide-overlay.js` scores every visible candidate (accessible name + role beat brittle selectors) and accepts only above a threshold — failing to "not found" and retrying beats highlighting the wrong element. Always fail gracefully: show the step text even if nothing can be highlighted.
- **The backend step copy is lossy.** `StepCreate` drops the resolver fields (`name`, `exactName`, `avoidText`, ...), so the full local guide steps drive navigation; the backend copy exists for progress tracking only (its step ids are adopted for PATCH calls). Never swap to the backend copy mid-run.
- **Injected UI lives in a closed Shadow DOM** so Console CSS can't restyle it and ours can't leak out.
- **Side Panel, not popup.** Uses the `sidePanel` permission so guidance stays open while the developer works in the Console. The Dashboard is a separate full-tab entry (`dashboard.html`).
- **Mic access is relayed.** The `chrome-extension://` side panel can never show a mic prompt; speech recognition runs in `voice-listener.js` on the Console tab and streams transcripts back over a Port (`src/lib/speech.js`).
- **Page-aware chat.** Chat messages can carry a summary + screenshot of the guided Console tab so Baymax answers about what's on screen ("what does this graph mean"). `captureChatPage()` in `src/lib/guide.js` bundles `capturePageContext()` (a new `page-context` content-script action, merged across frames) with `captureGuidedTabScreenshot()`; both are failure-tolerant. A user-visible toggle — an eye icon in `AppHeader` (state lifted to `SidebarApp`, shown only on the Ask tab's chat screens) — controls it, default on in the extension, hidden on localhost. Screenshots are never resent inside chat history.

---

## Tech Stack

| Layer        | Tech                                              |
|--------------|---------------------------------------------------|
| Extension    | Manifest V3, Vite, React 19, JavaScript (JSX), Tailwind CSS 4, shadcn/Radix, react-router-dom, framer-motion |
| Backend      | FastAPI, Uvicorn, Python 3.12, SQLAlchemy, Pydantic, PyJWT |
| Database     | Supabase (PostgreSQL)                             |
| AI           | LangChain, Gemini API                             |
| Infra        | Docker, Google Cloud Run                          |