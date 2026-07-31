# Phase 0 — Repository Analysis

> **Purpose:** the verified mental model everything else in this curriculum is built on.
> Read it, correct anything wrong, and confirm before Module 1 is generated.
> Every claim below was checked against the actual code on branch `isyraf-dev` (2026-07-07) — not against README/CLAUDE.md descriptions. Where the docs and the code disagree, the code wins and the discrepancy is flagged in §5.

---

## 1. Product Understanding

### 1.1 What problem does Baymax solve?

Deploying to Google Cloud Platform is intimidating for developers who don't live in the GCP Console: the UI is dense, workflows span many screens, and documentation goes stale as Google redesigns pages. Baymax removes the "where do I click next?" problem by overlaying **live, step-by-step visual guidance directly on the real GCP Console** — a pulsing highlight on the exact button, an animated Baymax mascot explaining the step, and optional voice narration.

It is not documentation and not automation-only: the developer performs the deployment themselves (and therefore learns it), with Baymax watching the page and advancing the guide as each step completes.

### 1.2 Who are the users?

Developers (students/juniors especially — this is the Gamuda AI Academy capstone, Yayasan Gamuda × Google Cloud) who need to complete concrete GCP tasks: hosting a backend on Cloud Run, provisioning Cloud SQL Postgres, and similar Console workflows.

### 1.3 Main user workflows (all verified in code)

1. **Sign in** — email/password via Supabase Auth (`pages/Login`, `pages/Register`). A persisted session skips straight to the app (`components/EntryGate.jsx`). Google OAuth: the backend endpoint exists (`GET /auth/google`) but the frontend button is a stub.
2. **Quick-start a curated guide** — tap a suggestion chip on Home ("Host a backend using Cloud Run"). The extension fetches the **official guide** from the backend DB, shows a prerequisites gate, then runs the guided session. If the backend is unreachable, an **opt-in** offline bundled copy is offered (never used silently).
3. **Ask the chatbot** — free-text chat streams a reply. Three outcomes: a conceptual markdown answer (streamed token-by-token), a **curated official guide** when the ask matches one, or an **AI-generated deployment blueprint** the user can launch as a guided session.
4. **Run a guided session** — the core experience. Each step is highlighted on the live Console tab; completion is detected by the user's click, their typing, or a URL change; progress persists to the backend; "Do it for me" performs the step automatically; a "lost" mascot appears with *Take me back* if the user wanders off-page.
5. **Record a guide** — the user demonstrates a flow once; each click/fill is captured as a semantic fingerprint, reviewed/edited (parameterise secrets, "match any instance" generalisation), then saved to the backend, exported as JSON, or run immediately.
6. **Review history** — a Tasks tab in the side panel (resume/delete sessions) and a full-tab Dashboard (`dashboard.html`) with History and Profile pages.

### 1.4 Core business features

| Feature | Status in code |
|---|---|
| Guided overlay on the live GCP Console | Built (the product's heart) |
| Official (curated, live-tested) guides served from the DB | Built — seeded via script, matched by chat intent + Home chips |
| Dual-mode AI chat (concept vs. blueprint) with SSE streaming | Built |
| Guide recorder (record → review → save/export/run) | Built |
| Self-heal of broken selectors via LLM | **Backend built and live; frontend call sites commented out (`SELF-HEAL DISABLED` in `pages/Guidance/index.jsx`)** |
| Baymax voice (Gemini TTS) + voice input (speech-to-text) | Built, with browser-voice fallback |
| Session/step progress persistence | Built (backend is the single source of truth for progress) |

---

## 2. Technical Architecture

Monorepo, two deployable units:

```
baymax-extension/   Chrome Extension, Manifest V3 (Vite + React 19, JavaScript/JSX)
baymax-backend/    FastAPI service (LangChain + Gemini), Docker → Google Cloud Run
```

### 2.1 Frontend technology

- **Build:** Vite 8, `@vitejs/plugin-react`, Tailwind CSS 4 (`@tailwindcss/vite`), `vite-plugin-static-copy` (copies `manifest.json` + `background.js` into `dist/`). Three HTML entry points: `index.html` (side panel), `dashboard.html` (full-tab dashboard), `styleguide.html`. Output filenames are unhashed so the manifest can reference them.
- **UI:** React 19 (**JSX, not TypeScript**), react-router-dom 7, shadcn/Radix components, framer-motion, lucide-react, markdown-it + DOMPurify (chat rendering).
- **Extension anatomy (MV3):**
  - **Side panel** (`side_panel.default_path: index.html`) — the React app. Permissions: `sidePanel, storage, tabs, scripting, webNavigation`; host permission only for `https://console.cloud.google.com/*`.
  - **Service worker** `public/background.js` — intentionally tiny (12 lines): opens the side panel on toolbar click and on a `RESUME_SESSION` message from the Dashboard tab.
  - **Content scripts** — plain, bundler-free JS in `public/`:
    - `guide-overlay.js` (~1,400 lines, injected into **all frames**) — the guide engine's "hands and eyes": resilient element resolver, highlight/mascot overlay in a closed Shadow DOM, click/fill executors, page snapshotter, and the recorder.
    - `voice-listener.js` — microphone relay: the `chrome-extension://` side panel can never get a mic prompt, so speech recognition runs here (a real https origin) and transcripts stream back over a Port.
- **Communication model:** the side panel talks to content scripts directly via `chrome.tabs.sendMessage`, **broadcast to every frame** (the Console renders most pages in a same-origin iframe). The background worker does *not* proxy API calls — the side panel calls the backend itself over `fetch` (`src/lib/api.js`).

### 2.2 Backend technology

- **FastAPI + Uvicorn, Python 3.12** (pinned in Dockerfile), Pydantic v2 + pydantic-settings, SQLAlchemy 2.0 typed ORM (`Mapped[...]`), slowapi rate limiting, PyJWT for auth verification.
- **Strict layering** (enforced by convention and CLAUDE.md): `routers/` = HTTP only → `db_call.py` = every DB read/write → `models.py` = DB shape → `schemas/` = API shape → `services/` = external calls (Supabase, Gemini) → `config.py` = the one typed home of env vars → `main.py` = wiring only. Plus two infrastructure modules the docs' tree omits: `rate_limit.py` and `observability.py`.

### 2.3 Database / storage

Supabase-hosted **PostgreSQL** via SQLAlchemy (`DATABASE_URL`). Four tables (`models.py`):

- **users** — mirror of the Supabase auth user (same UUID) so FKs work. Created lazily by `get_or_create_user` on register and on first session creation.
- **sessions** — one guided run: `title`, `status` (`in_progress|completed|abandoned`), owner FK, cascade delete. Exposes `total_steps` / `completed_steps` as Python properties.
- **steps** — one row per step of a session: `step_number, title, description, action, selector, url, url_pattern, advance_on_url_pattern, value, status`. This is a **lossy** projection of the frontend's richer step shape (see §4, Flow A).
- **recorded_guides** — a whole guide as **JSONB** (`steps`, plus guide-level `meta`: prerequisites, nextSteps, chat keywords, Home task id) precisely because the resolver's step shape evolves on the frontend. `is_official=True` marks Baymax-curated guides — settable **only** by the seed script, never via the API.

Also: `schema.sql` at the backend root, and localStorage on the frontend only for the Supabase session token (progress is deliberately *not* stored in localStorage anymore).

### 2.4 Authentication / authorization

- **Registration/login:** backend calls Supabase Auth (`services/auth_service.py`) with the service key; the frontend also holds a supabase-js client (`src/lib/supabase.js`) whose persisted session provides the access token.
- **Request auth:** every protected route uses `Depends(get_current_user)`, which verifies the JWT **via the Supabase JWKS endpoint** (`PyJWKClient`, algorithms `ES256` + `RS256`, audience `authenticated`) — no shared HS256 secret. The verified user id is stashed on `request.state.user_id` for per-user rate limiting.
- **Authorization model:** owner-scoping in `db_call.py` (`get_session(db, id, user_id)` etc.). Guides are **read own-or-official, write strictly own** — deleting reuses a stricter query so read visibility of official guides can't be escalated into deletion.
- **Public endpoints:** `/chat` requires auth; `/guidance/repair` and `/tts` are public but rate-limited per IP.

### 2.5 AI integrations (three touchpoints)

| Touchpoint | Model | Framework | Where |
|---|---|---|---|
| Chat (dual-mode) | `gemini-2.5-flash`, fallbacks `gemini-2.0-flash`, `gemini-1.5-flash` on quota errors | LangChain (`ChatGoogleGenerativeAI`), temperature 0 | `services/chat_service.py` |
| Self-heal repair | `gemini-2.5-flash` | LangChain + `with_structured_output(RepairedIntent)` | `services/guidance_service.py` |
| Baymax voice | `gemini-3.1-flash-tts-preview` | **httpx REST directly** — the one sanctioned exception (LangChain has no audio modality) | `services/tts_service.py` |

Key design decisions, all present in code:

- **Mode selection is native function calling**, not prompt-parsed JSON: `DeploymentPlan` (`schemas/chat.py`) is bound as a tool; a tool call = blueprint, plain content = text. Its docstring/field descriptions double as model instructions.
- **Chat is stateless and ephemeral** — no history; each turn sees only the current message. Durable state is sessions + steps.
- **Official-guide routing beats the LLM twice**: a deterministic keyword+action-word pre-match skips Gemini entirely, and blueprint tool calls are *intercepted* if their intent matches a curated guide — the user gets the live-tested guide instead of a hallucination-prone one.
- **Anti-hallucination guard in repair:** the returned selector must be copied verbatim from the snapshot the frontend sent; invented selectors are stripped server-side.
- **Streaming:** `/chat` returns SSE (`delta` frames then one `final` frame); deltas are suppressed once a tool call starts streaming.
- **Observability:** optional LangSmith tracing (`observability.py` bridges typed settings → the env vars the SDK reads); chains carry `run_name`s.
- **TTS output:** raw 16-bit PCM is wrapped in a hand-built WAV header (`struct.pack`) because browsers can't play bare PCM; failure returns `None` → router 502 → frontend falls back to `speechSynthesis`.

### 2.6 Infrastructure & deployment

- **Backend:** Dockerfile (python:3.12-slim, dependency-layer caching, `$PORT`=8080, `sh -c exec uvicorn` so signals reach PID 1) → Google Cloud Run. `.env` excluded via `.dockerignore`; env vars set in the service config in production.
- **Frontend:** `npm run build` → load `dist/` unpacked at `chrome://extensions`. The Vite config notes crxjs is a possible later migration.
- **Rate limiting** is in-memory per process (fine for one Cloud Run instance; Redis noted as the multi-instance path). **CORS** origins come from `ALLOWED_ORIGINS`.
- No CI/CD pipeline files in the repo. Git flow: `main` / `testing` / per-developer branches on GitLab, merge-only.

### 2.7 Third-party dependencies that matter

Backend: `fastapi, uvicorn, pydantic(-settings), slowapi, supabase (2.31.0 pinned), langchain-core, langchain-google-genai, google-generativeai, PyJWT[crypto], sqlalchemy, psycopg2-binary, httpx, pytest`.
Frontend: `react, react-router-dom, @supabase/supabase-js, tailwindcss, radix/shadcn, framer-motion, markdown-it, dompurify, lucide-react, lenis, @lottiefiles/dotlottie-react`.

---

## 3. Codebase Structure

### 3.1 Backend map (`baymax-backend/`)

| File | Responsibility |
|---|---|
| `main.py` | Wiring only: logging config, LangSmith setup, limiter + 429 handler, CORS, include 7 routers |
| `config.py` | `Settings(BaseSettings)` — every env var, typed, with defaults. Import `settings`, never `os.getenv` |
| `database.py` | `Base`, engine, `get_db` dependency, `init_db()` (runnable: creates tables) |
| `models.py` | ORM: `User`, `Session`, `Step`, `RecordedGuide` |
| `db_call.py` | Data-access layer — every query/commit, all owner-scoped |
| `rate_limit.py` | slowapi limiter keyed per user (fallback: IP), friendly 429 handler |
| `observability.py` | Opt-in LangSmith tracing bridge |
| `routers/` | `auth` (register/login/google/logout), `sessions` (POST/GET/PATCH/DELETE), `steps` (bulk POST/GET/PATCH under `/sessions/{id}/steps`), `chat` (SSE), `guides` (POST/GET/GET one/DELETE), `guidance` (`/repair`), `tts` |
| `schemas/` | Pydantic shapes: `auth, session, step (canonical StepResponse), guide, guidance, chat (incl. DeploymentPlan tool schema), tts` |
| `services/` | `auth_service` (Supabase + JWKS verify), `chat_service`, `guidance_service`, `tts_service` |
| `data/` | `seed_guides.py` (hardcoded Cloud SQL guide — legacy fallback for bodyless step POSTs), `official_cloud_run_guide.json` + `seed_official_guide.py` (CLI upsert of official guides, matched by title so re-seeding preserves guide ids) |
| `tests/` | `test_smoke.py` (imports + route registration), `test_schemas.py`, `test_official_guides.py` |

**Full route surface:** `/auth/register|login|google|logout`, `/sessions` (+`/{id}`, PATCH status, DELETE), `/sessions/{id}/steps` (+ PATCH `/{step_id}`), `/chat`, `/guides` (+`/{id}`), `/guidance/repair`, `/tts`.

### 3.2 Frontend map (`baymax-extension/`)

| Path | Responsibility |
|---|---|
| `manifest.json` | MV3 manifest (see §2.1) |
| `public/background.js` | Minimal service worker |
| `public/guide-overlay.js` | Content script: resolver, overlay/mascot, click/fill executors, snapshot, recorder |
| `public/voice-listener.js` | Content script: mic relay for speech-to-text |
| `src/main.jsx` / `App.jsx` | Side-panel root. Two navigation axes: `activeTab` (`ask`/`tasks`) and `screen` (`home`/`prereqs`/`recorder`/`guidance`). Owns guide state: `localGuide` (full-fidelity, source of truth), `dynamicGuide` (AI blueprint), `sessionId`. Also the offline-copy offer modal |
| `src/dashboard.jsx` + `pages/Dashboard/` | Separate full-tab app: Layout, History (GET /sessions), Profile |
| `src/components/EntryGate.jsx` | Landing → Login → app staging, driven by surface context + persisted Supabase session + auth-state events |
| `src/pages/Home` | Chat UI + quick-start chips + "Record a guide" entry |
| `src/pages/Guidance` | **The guide orchestrator** (~800 lines): step state machine, three completion signals, off-track detection, "Do it for me" automation, submit-failure detection, TTS narration, backend progress marking. Self-heal call sites commented out. Plus `PrereqGate.jsx` and `Complete.jsx` |
| `src/pages/Recorder` | Record → review/edit (parameterise, generalise) → save/export/try |
| `src/pages/Tasks` | Session list: resume, delete |
| `src/pages/{Landing,Login,Register,Docs,About,Styleguide}` | Marketing/auth/dev surfaces |
| `src/lib/api.js` | The only backend client: attaches Supabase bearer token, JSON wrapper, SSE reader for `/chat`, blob fetch for `/tts` |
| `src/lib/guide.js` | Side-panel ↔ content-script bridge: frame-aware command send/broadcast, snapshot merge, URL watching (`onGcpUrlChanged`), step-event subscription, recorder start/stop, and the "generalize across instances" logic (`volatileTokensFromUrl`, `applyGeneric`) |
| `src/lib/speech.js` | Speech-to-text sessions: local (Web Speech, dev) vs. remote (Port to `voice-listener.js`); also caches TTS audio per text with browser-voice fallback |
| `src/lib/useRecorder.js` | React hook over the recorder message stream |
| `src/lib/guides/{cloudRun,cloudSqlPostgres}.js` | Bundled offline fallback copies of the two official guides |
| `src/lib/{context,supabase,theme,utils}.js` | Surface detection, supabase client, theming, `cn()` |

### 3.3 The resilient resolver (the most important algorithm in the repo)

`guide-overlay.js` does **not** trust CSS selectors. A step is an *intent* — `{ selector, role, name, text, href, avoidText, avoidHref, exactName, requireSelector, revealSelector, … }` — and the resolver:

1. Builds a candidate pool (selector hits + all interactive elements).
2. **Scores** every visible candidate: name match (exact 120 / equal 100 / contains 60 / in-text 35, and a *required* signal — no name match ⇒ disqualified), selector hit +35, role +20, href +25, in-viewport +15, focused +30, small-area +5, long-text penalty (prefers the tightest element), `avoidText`/`avoidHref` disqualifiers.
3. Accepts only above a threshold (45) — failing to "not found" and retrying beats highlighting the wrong thing.
4. Extras: `revealSelector` re-summons transient panels (e.g. search suggestions); a rAF loop re-anchors the highlight when Angular re-renders the node; the mascot + outline live in a **closed Shadow DOM** so Console CSS can't touch them.

The recorder is the write-side of the same idea: `fingerprintElement` captures role + accessible name (+ text/href/domPath-as-last-resort), which `resolveTarget` reads back at replay time.

---

## 4. End-to-end flows (trigger → result)

**Flow A — Quick-start an official guide**
Chip tap (Home) → `App.startTask` → `GET /guides` summaries → find `is_official && meta.task === task` → `GET /guides/{id}` → `beginGuide`: show PrereqGate, then `POST /sessions` + bulk `POST /sessions/{id}/steps` in the background. **Crucial detail:** the backend `StepCreate` is lossy (drops resolver fields like `name`, `exactName`, `avoidText`, `role`); the local guide stays the navigation source of truth and only *adopts the backend step ids* so `PATCH .../steps/{id}` hits real rows. Failure to reach the backend never blocks the guide — it just runs without persistence. Backend unreachable at fetch time → explicit offline-copy offer.

**Flow B — Guided step loop**
`Guidance` renders step N → `highlightStep()` → broadcast `BAYMAX_GUIDE` to every frame → resolver finds the element → outline + mascot + optional TTS. Completion via any of: content-script report (`BAYMAX_GUIDE_CLICKED` / `_FILLED`), or `chrome.tabs.onUpdated` URL matching `advanceOnUrlPattern`. On completion: `PATCH` step status → advance. Wrong page (`urlPattern` mismatch) → lost mascot → *Take me back* → `chrome.tabs.goBack()` or the step's URL. "Do it for me" → `runStepAction()` clicks/fills for the user. Final step: `PATCH /sessions/{id}` → `completed` → Complete screen with `nextSteps`.

**Flow C — Chat turn**
Home input → `api.sendChat` (fetch + manual SSE parsing) → backend: rate-limit per user → load official guides → **fast-path** deterministic match (action word + guide keyword ⇒ curated guide, zero LLM cost) → else LangChain stream → deltas repaint the bubble live → final frame is `text` | `blueprint_json` (validated `DeploymentPlan`, possibly **intercepted** into an official guide) | `official_guide` → bubble gets a "Start Guided Session →" action → Flow A/B machinery.

**Flow D — Record a guide**
Recorder → `record-start` broadcast → content script fingerprints every click/fill (ignoring Baymax's own UI) → `BAYMAX_RECORD_ACTION` messages → `useRecorder` accumulates drafts → review screen (edit titles, mark parameters so secrets are blanked on export, toggle "match any instance" → `applyGeneric` strips volatile project/instance ids from names and drops pinned selectors) → save (`POST /guides`), download JSON, or run live (Flow B without a session). Official promotion happens **only** via `python data/seed_official_guide.py <json> --email <owner>`.

**Flow E — Self-heal (backend live, frontend disabled)**
Resolver miss → `captureSnapshot()` merges visible interactive elements from all frames (cap 120) → `POST /guidance/repair` → LLM picks the one element matching the step's intent → verbatim-selector guard → frontend retries with the healed intent. The Guidance call sites are commented out (`SELF-HEAL DISABLED`); the endpoint, service, and snapshot plumbing are complete.

**Flow F — Voice, both directions**
Out: step text → cached `POST /tts` WAV blob → play; on failure, browser `speechSynthesis`. In: mic button → Port `baymax-voice` to `voice-listener.js` on the Console tab (the only origin that can get mic permission) → live transcripts stream back into the input.

---

## 5. Discrepancies & things the docs get wrong (verify these)

> **Update 2026-07-07:** items 1–4 were documentation errors in CLAUDE.md and have since been **fixed there** (structure tree, request-flow diagram, messaging model, tech stack). They're kept as a record of what the docs used to claim. Items 5–9 are code/state facts that still hold.

1. **CLAUDE.md says TypeScript; the code is JavaScript/JSX** (`jsconfig.json`, `.jsx` everywhere). Tailwind + shadcn/Radix are accurate.
2. **CLAUDE.md's frontend tree (`src/sidepanel/`, `src/content/`, `src/background/`) doesn't exist.** The side panel is the `src/` app itself; background + content scripts are plain JS in `public/`. `src/content/` is referenced in an old comment (`speech.js` mentions `src/content/voice.js`) but the real file is `public/voice-listener.js`.
3. **CLAUDE.md says content scripts never call the API and the background worker is the only API caller — the opposite is true:** the side panel calls the backend directly; the background worker does no API work.
4. **The request flow diagram mentions `POST /guidance`** — the real endpoints are `/chat` (planning) and `/guidance/repair` (self-heal only).
5. `baymax-backend/models/` is a leftover directory containing only stale `__pycache__` (from before the `models/` → `schemas/` rename); same for root-level `chatbox_prompt`/`guides` `.pyc` files.
6. `Dashboard/History.jsx` carries a stale comment ("backend sessions don't carry status/progress yet") — `Session.status`, `total_steps`, `completed_steps` all exist now.
7. `data/seed_guides.py` (hardcoded Cloud SQL guide) survives only as the fallback when `POST /sessions/{id}/steps` gets no body — flagged in memory as a deferred deletion.
8. Frontend `.env.local` must define `VITE_API_BASE_URL` (defaults to `http://127.0.0.1:8000`); backend `.env` holds the settings listed in `config.py`.
9. **Not live-tested yet** (per project memory): the five navigation-stability fixes and the Cloud Run guide selectors on a real GCP tab.

## 6. Testing reality

- Backend: 3 pytest files — smoke (imports + route registration, no DB needed), schema validation, official-guide behaviour. No service-layer or LLM-behaviour tests.
- Frontend: **no tests at all** (no test runner configured). ESLint + Prettier only.
- This gap is itself curriculum material (testing an LLM app, testing content scripts).

---

*If this analysis matches your understanding of the repo, say so and I'll produce `curriculum/01-program-overview.md` (learning outcomes, knowledge graph, sizing, full module roadmap). If anything is wrong or missing — especially product intent I can't see in code — correct it first so the curriculum isn't built on a flawed model.*
