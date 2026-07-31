# Lesson 1.2 — Running Both Units

## 1. Learning objectives

After this lesson you can:
- Bring up the backend (venv → deps → `.env` → uvicorn) and prove it's healthy without a frontend.
- Build the extension and load it unpacked; know when `npm run dev` suffices and when it doesn't.
- Explain what every required environment variable is *for*, and predict the failure when each is missing.
- Run the backend test suite and know what it does and doesn't guarantee.

## 2. Prerequisites

Lesson 1.1. Installed: Python 3.12, Node 20+, Chrome. (Docker optional today — used in Module 9.)

## 3. Estimated duration

~3 hours including deliberate-breakage exercises.

## 4. Mastery levels covered

Levels 1–2.

## 5. The problem — why is "just run it" a lesson?

Every real system has an invisible contract with its environment: interpreter versions, secrets, service dependencies, build steps. "Works on my machine" is what happens when that contract is implicit. This lesson makes Baymax's contract explicit — and teaches the debugging skill of *predicting* a failure from a missing precondition, which you will use every week of this program.

## 6. Theory

**Virtual environments** isolate a project's Python packages from the machine's. `requirements.txt` pins *what* to install; the venv controls *where*. Editors need to be pointed at the venv interpreter — Docker does not fix editor import squiggles.

**Configuration lives in the environment, not the code** (the Twelve-Factor principle). Baymax enforces it structurally: `config.py` is the *only* file that reads env vars, into one typed `Settings` object. Everything else imports `settings`. The payoff: one place to look, type validation at startup, and defaults that document themselves.

**An extension is a built artifact.** The browser loads `dist/`, not `src/`. Vite compiles the React app into `dist/`, and `viteStaticCopy` places `manifest.json` and `background.js` beside it. Consequence: **source changes do nothing to the loaded extension until you rebuild and reload it.** `npm run dev` serves the UI at `localhost:5173` for fast iteration on *look and behavior that doesn't need Chrome APIs* — extension-only behavior (tabs, messaging, side panel) exists only in a real loaded build.

**Two services you don't run** complete the picture: Supabase (Postgres + auth) and the Gemini API are cloud dependencies. The backend boots without them but degrades: watch for it below.

## 7. Project mapping

| Concern | File |
|---|---|
| Python deps | `baymax-backend/requirements.txt` |
| Typed settings + defaults | `baymax-backend/config.py` |
| DB engine bootstrap (+ `init_db()`) | `baymax-backend/database.py` |
| Backend env contract | `baymax-backend/.env` (documented in [CLAUDE.md](../../../CLAUDE.md) → Environment Variables) |
| Frontend env contract | `baymax-extension/.env.local` — `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Build pipeline | `baymax-extension/vite.config.js`, `package.json` scripts |
| Health proof | `http://localhost:8000/docs`, `pytest tests/` |

## 8. Code walkthrough (the run, annotated)

### Backend

```powershell
cd baymax-backend
python -m venv venv
venv\Scripts\Activate.ps1          # PowerShell (bash: source venv/Scripts/activate)
pip install -r requirements.txt
```

Before starting the server, read `config.py` top to bottom — it is the best-commented file in the backend and doubles as the ops manual. Note which fields have defaults (they're optional) and which are `str | None = None` (required for the feature that reads them, but *not* for boot).

Create `.env` (get real values from your team's shared store — never commit it):

```
DATABASE_URL=postgresql://...        # SQLAlchemy → Supabase Postgres
SUPABASE_URL=https://<id>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_JWKS_URL=https://<id>.supabase.co/auth/v1/.well-known/jwks.json
GEMINI_API_KEY=...
ALLOWED_ORIGINS=chrome-extension://<your-extension-id>,http://localhost:5173
```

```powershell
uvicorn main:app --reload
```

Open `http://localhost:8000/docs` — FastAPI's generated Swagger UI. This page is your first debugging tool: every route, schema, and status code, derived from the code itself. Try `POST /auth/login` from it.

Now the guarantee check:

```powershell
pytest tests/
```

Read `tests/test_smoke.py` while it runs. It imports every module and checks route registration — **no database, no Gemini**. So a green run proves wiring, not behavior. (Closing that gap is Module 9.3's job.)

> **Guiding question:** `database.py` line 26 — `_engine = create_engine(DATABASE_URL) if DATABASE_URL else None`. What happens on the *first request that needs the DB* if `DATABASE_URL` is unset? Trace `get_db()` and predict the exact failure before trying exercise 2.

### Frontend

```powershell
cd baymax-extension
npm install
```

Create `.env.local` with the three `VITE_*` vars. Then two modes:

- **UI iteration:** `npm run dev` → `http://localhost:5173`. Full app, hot reload — but `chrome.*` APIs are absent, so guide highlighting, recording, and voice are inert. Note `lib/api.js` defaults `VITE_API_BASE_URL` to `http://127.0.0.1:8000` — your uvicorn.
- **Real extension:** `npm run build` → `chrome://extensions` → Developer Mode → **Load unpacked** → select `dist/`. After *every* rebuild, press the extension's reload icon there. Copy your extension's id into the backend's `ALLOWED_ORIGINS` and restart uvicorn — or every API call from the panel will die on CORS.

Prove the loop end to end: click the Baymax toolbar icon → side panel opens (that's `background.js`'s one job) → register/log in → open the Network tab of the side panel's DevTools (right-click panel → Inspect) → watch `POST /auth/login` hit `127.0.0.1:8000`.

## 9. Trade-offs & alternative implementations

- **venv + uvicorn vs Docker for daily dev:** the repo supports both. Bare uvicorn gives `--reload` and a debugger with zero friction; Docker gives production parity. This project's docs choose bare-metal for dev, Docker for deploy — a common and sane split. Know what you give up (parity bugs hide until Module 9).
- **`extra="ignore"` in `Settings`:** tolerant of unknown env vars — convenient across teammates' `.env`s, but a typo'd `GEMINI_APIKEY=` is *silently ignored* rather than rejected. Strict mode would catch typos and break flexibility. The project chose tolerance; know the cost (see exercise 3).
- **Unhashed build filenames** (`entryFileNames: 'assets/[name].js'`): required because `manifest.json` must reference stable paths — traded against cache-busting, which extensions don't need (the browser reloads on version bump).

## 10. Common mistakes

- Editing `src/` and testing the *loaded extension* without rebuild + reload — you're testing the old build. (Symptom: "my change does nothing.")
- Forgetting the extension id in `ALLOWED_ORIGINS` — every panel request fails; the console shows a CORS error, **not** an auth error. Read the error, don't guess.
- Testing mic/highlight features on `localhost:5173` and concluding they're broken — they need the packed extension and a real `console.cloud.google.com` tab.
- Pointing the editor at system Python → import errors in the editor while uvicorn runs fine (or vice versa).
- Committing `.env`. The root `.gitignore` protects you, but *verify* with `git status` after creating it — trust, then check.

## 11. Production considerations

Everything you hand-fed here must exist in production differently: env vars go into the Cloud Run service config (not a file), the extension id in `ALLOWED_ORIGINS` becomes the *published* id, and `--reload` disappears (the Dockerfile's `CMD` runs plain uvicorn bound to `$PORT`). Module 9 walks this; today, just notice that **nothing in the codebase changes between dev and prod — only the environment does.** That's the payoff of the `config.py` discipline.

## 12. Exercises (do, don't read)

1. **(Verify)** Full loop: backend up, tests green, extension loaded, logged in, one authenticated request visible in the panel's Network tab.
2. **(Break it #1)** Stop uvicorn, rename `DATABASE_URL` to `DATABASE_URL_X` in `.env`, start, and hit `POST /sessions` from `/docs` with a valid token. Record: where does it fail, and what does the client see? Was your §8 prediction right? Restore.
3. **(Break it #2)** Set `CHAT_RATE_LIMIT=2/minute`, restart, send 3 chat messages fast. Confirm the third gets the friendly 429 from `rate_limit.py`. Now find where that message text lives. Restore.
4. **(Break it #3)** Remove your extension id from `ALLOWED_ORIGINS`, restart, use the side panel. Write down the *exact* error text the DevTools console shows — you will meet it again in real life; learn its face.
5. **(Investigation)** `npm run build`, then list `dist/`. Map every file to its source: which came from Vite bundling, which from `viteStaticCopy`, which from `public/` auto-copy?

## 13. Assignment — mini project

Make one visible change in each unit and ship both locally:
1. Backend: add a startup log line in `main.py` (`logger.info("Baymax API up — %s mode", ...)`) that prints whether LangSmith tracing is on. (Careful: which existing module already knows? Reuse, don't duplicate.)
2. Frontend: change the Home quick-start chip label (find it — Lesson 1.1's map tells you which page) and get the new label showing in the **loaded extension**, not just `localhost:5173`.

Deliverable: two screenshots + one paragraph on which of the two changes took longer to see live, and why (this is §11's release-physics lesson, experienced firsthand). Revert both or keep them on your dev branch — your call, but state which you did.

## 14. Quiz

1. Which env vars can be absent with the backend still booting cleanly? What breaks later for each?
2. Why must `ALLOWED_ORIGINS` contain a `chrome-extension://` origin, and what error appears when it doesn't?
3. What exactly does a green `pytest tests/` guarantee? Name two failures it cannot catch.
4. Why does `manifest.json` need stable (unhashed) asset filenames?
5. Your teammate says "voice input is broken" while testing on `localhost:5173`. What do you ask first?

## 15. Best practices & further reading

- The Twelve-Factor App — *III. Config* (the principle `config.py` implements).
- FastAPI docs: *Settings and Environment Variables* (the pydantic-settings pattern).
- Vite docs: *Building for Production* + `vite-plugin-static-copy` README.
- Practice: after any env change, restart the process *and* state out loud what you expect to be different — prediction is the habit that separates debugging from flailing.

## 16. Completion checklist

- [ ] Backend runs; `/docs` opens; tests green — and I can say what green proves.
- [ ] Extension loaded unpacked; I've done the rebuild→reload cycle at least twice.
- [ ] I broke and restored the system three ways and recorded each failure's *signature*.
- [ ] Mini project shipped: a change live in each unit, with the write-up.
- [ ] I can recite the frontend's three env vars and the backend's six required ones from memory.
