# Module 1 — The System in Your Hands

*Week 1 · ~8–10 hours · Mastery Levels 1–2 · Prerequisites: none (this module establishes the foundation layer of the [knowledge graph](../01-program-overview.md#3-knowledge-graph))*

## Why this module exists

You cannot reason about a system you have never run, and you cannot extend code you cannot trace. Professional engineers joining a team spend their first week doing exactly what this module does: get it running, form a map, and follow one feature all the way through. Everything in Modules 2–9 assumes you can do these three things without help.

## Lessons (in order)

| # | Lesson | Time |
|---|---|---|
| 1.1 | [What Baymax is and why it exists](01-what-baymax-is-and-why.md) | ~2 h |
| 1.2 | [Running both units](02-running-the-system.md) | ~3 h |
| 1.3 | [Anatomy of one guide step](03-anatomy-of-one-guide-step.md) | ~3–4 h |

Do them in order — 1.3 requires a running system (1.2) and the vocabulary from 1.1.

## Mentor's rule for this module

When a lesson poses a guiding question or an exercise, **attempt it before reading past it**. The answers are always in the code; the skill being trained is finding them there, not here.

---

## Mastery Checkpoint — the Investigation Hunt

Answer all 10 by naming the **exact file (and function, where asked)**. Use any tool — editor search, grep, DevTools — but not this curriculum's earlier documents. Target: 8/10 without hints. Answers are at the bottom of this file; do not open them until you have attempted all ten.

1. Where is the `Authorization: Bearer <token>` header attached to backend requests, and where does that token come from?
2. Which file decides whether a user sees Landing, Login, or the app when the side panel opens? What are the three signals it combines?
3. A guide step was clicked on the GCP Console page. Which file *sends* the message reporting that, and which file *receives* it in the side panel?
4. Where does the backend enforce that you can only PATCH steps belonging to *your own* session? (Two layers are involved — name both.)
5. Which function turns raw PCM audio into something a browser can play, and why is it needed?
6. The chat endpoint sometimes never calls Gemini at all. Which function makes that decision, and what two conditions must the message satisfy?
7. Where is the number `120` used to protect the LLM from oversized input, and what is being capped?
8. When a guide is running and the user navigates to the wrong Console page, which file detects it, and what does it tell the content script to show?
9. `POST /sessions` sometimes inserts into the `users` table before touching `sessions`. Which function, and why is it needed at all?
10. The extension's production build must contain `background.js` at the dist root, but Vite doesn't bundle it. What puts it there?

**Scoring:** 8–10 → proceed to Module 2. 5–7 → redo Lesson 1.3's exercises, then retry the misses. <5 → rerun the whole trace in Lesson 1.3 with the debugger open before continuing.

---

<details>
<summary><b>Answer key — open only after attempting all ten</b></summary>

1. `baymax-extension/src/lib/api.js` — `authHeader()` reads the access token from `supabase.auth.getSession()` (the persisted Supabase session) and every `request()` spreads it in.
2. `baymax-extension/src/components/EntryGate.jsx` — combines `isFromApp()` (opened with `?from=app`), `detectContext()` (panel vs full tab), and the persisted Supabase session (`supabase.auth.getSession()`), resolved together behind the splash.
3. Sent by `baymax-extension/public/guide-overlay.js` (`BAYMAX_GUIDE_CLICKED` via `chrome.runtime.sendMessage`); received in `baymax-extension/src/lib/guide.js` → `onGuideStepEvent`, which `pages/Guidance/index.jsx` subscribes to.
4. Router layer: `routers/steps.py` `update_step_status` takes `current_user` from `Depends(get_current_user)`. Data layer: `db_call.py` `update_step_status` → `get_session(db, session_id, user_id)` returns `None` unless the session belongs to that user — the query itself is owner-scoped.
5. `baymax-backend/services/tts_service.py` — `_pcm_to_wav()` prepends a RIFF/WAVE header with `struct.pack`, because Gemini TTS returns bare 16-bit PCM and browsers can't play headerless PCM.
6. `services/chat_service.py` — `find_official_guide_match()` (called as the fast path in `routers/chat.py`): the message must contain an **action word** (deploy/host/create/…) *and* a keyword from some official guide's `meta["keywords"]`.
7. `baymax-extension/src/lib/guide.js` — `captureSnapshot()` caps the merged, deduped element list at 120 (`merged.slice(0, 120)`) so a busy Console page can't blow up the repair prompt.
8. `pages/Guidance/index.jsx` — `checkStep()` compares the tab URL against the step's `urlPattern` via `isOnStepPage()`; on mismatch it calls `showLostMascot()` (in `lib/guide.js`), which tells `guide-overlay.js` to show the "lost" mascot with *Take me back*.
9. `db_call.py` → `get_or_create_user`, called from `routers/sessions.py` `create_session`. The JWT's `sub` is a Supabase **auth** user id that doesn't exist in our `public.users` table; `sessions.user_id` has a FK to it, so the auth user must be mirrored in first (idempotently).
10. `vite.config.js` — the `viteStaticCopy` plugin targets `public/background.js` (and `manifest.json`) into `dist/` root, because the service worker must be a plain file at the path the manifest names, not a hashed bundle.

</details>
