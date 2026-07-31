# Lesson 1.3 — Anatomy of One Guide Step

## 1. Learning objectives

After this lesson you can:
- Trace the flagship flow — quick-start chip → running guide → highlighted element → completed step — naming every file, message, and network call in order.
- Draw the system's four runtime actors (side panel, backend, content script, GCP tab) and every channel between them.
- Explain three load-bearing design facts met along the way: the lossy backend copy, frame broadcasting, and the three completion signals.
- Use DevTools on all three surfaces (side panel, service worker, Console tab) to *watch* the flow instead of imagining it.

## 2. Prerequisites

Lessons 1.1–1.2 (running system, vocabulary). Knowledge-graph nodes established here at survey depth: message passing, request flow — each gets full depth in Modules 4–5.

## 3. Estimated duration

~3–4 hours. Do not rush it; this trace is the skeleton every later module hangs flesh on.

## 4. Mastery levels covered

Levels 1–2 (understanding + guided navigation of real code).

## 5. The problem — why tracing is *the* skill

When a bug report says "the highlight points at the wrong button," the fix could live in nine different files across two runtimes and three browser contexts. Engineers who can't trace, guess; engineers who can trace, *narrow*. This lesson builds the map once, end to end, so that in every later module you always know where you are on it.

## 6. Theory — the four actors

```
┌─────────────────┐  fetch (HTTP/JSON, SSE)   ┌──────────────────┐
│  SIDE PANEL      │──────────────────────────▶│  BACKEND          │
│  (React app,     │                            │  (FastAPI on      │
│  chrome-ext://)  │◀──────────────────────────│  Cloud Run/local) │
└───┬─────────▲───┘                            └───────┬──────────┘
    │         │  chrome.tabs.sendMessage /             │ SQL
    │         │  chrome.runtime.onMessage              ▼
    │         │  (to EVERY frame)              ┌──────────────────┐
    ▼         │                                │  Supabase         │
┌─────────────┴───┐    DOM read/write          │  (Postgres+Auth)  │
│ CONTENT SCRIPT   │◀─────────────────────────▶└──────────────────┘
│ guide-overlay.js │        ┌──────────────┐
│ (every frame)    │  in    │ GCP CONSOLE  │
└─────────────────┘         │ TAB (page)   │
                            └──────────────┘
```

Two channels, two protocols. Panel↔backend is ordinary HTTP with a bearer token. Panel↔content-script is Chrome runtime messaging — request/response (`sendMessage` → return value) for commands, and fire-and-forget broadcasts (`runtime.sendMessage`) for events the page reports back. The background worker sits *outside* this flow entirely: it opens the panel and relays one message type. Keep asking of every hop: *which channel is this, and who initiated it?*

## 7. Project mapping — the cast in order of appearance

`src/pages/Home/index.jsx` → `src/App.jsx` → `src/lib/api.js` → `routers/guides.py` → `db_call.py` → back to `App.jsx` (`beginGuide`) → `routers/sessions.py` + `routers/steps.py` → `src/pages/Guidance/PrereqGate.jsx` → `src/pages/Guidance/index.jsx` → `src/lib/guide.js` → `public/guide-overlay.js` → back up the same ladder as events.

## 8. Code walkthrough — the trace

Follow along **with the system running** and a `console.cloud.google.com` tab open. Open three DevTools: the side panel's (right-click → Inspect), the Console tab's, and the service worker's (chrome://extensions → "service worker").

### Leg 1 — Chip tap → the guide arrives (panel ↔ backend)

`Home/index.jsx` renders two `SUGGESTIONS` chips; tapping one calls `onSelectTask('backend')`, which is `App.jsx`'s `startTask`. Read `startTask` now (App.jsx:126). Two calls: `api.listGuides()` → picks the summary where `is_official && meta?.task === task` → `api.getGuide(summary.id)` for the full steps.

In `api.js`, note what *every* request gets: `authHeader()` pulls the Supabase access token and attaches `Authorization: Bearer …`. On the backend, `routers/guides.py` `list_guides` runs `Depends(get_current_user)` (JWT verified — Module 3) then `db_call.get_recorded_guides_by_user` — officials first, then your own. **Watch it live:** panel DevTools → Network → tap the chip → see `GET /guides` then `GET /guides/{id}`.

> **Guiding question:** the chip fetches from the backend even though the same guide is bundled at `src/lib/guides/cloudRun.js`. Find the comment in `App.jsx` (top, `OFFLINE_GUIDES`) that justifies the extra network hop. What product promise from Lesson 1.1 §11 is it keeping?

### Leg 2 — `beginGuide`: sessions, steps, and the lossy copy

`beginGuide` (App.jsx:86) does four things in a deliberate order: clears stale guide state, sets `localGuide`, shows the `PrereqGate` screen (the checklist you see), and — *while you read the gate* — creates the backend session and bulk-saves the steps.

Read the `stepsPayload` mapping (App.jsx:95) closely. The local step has resolver fields (`name`, `exactName`, `avoidText`, `role`, …); the payload sends only what `StepCreate` accepts. Then the crucial move: the code **adopts the created rows' ids into the local steps** and keeps everything else local. The comment above `localGuide`'s declaration states the law: *the backend copy is lossy; Guidance must never swap to it mid-run.* The backend copy exists so progress PATCHes have rows to hit — it is a progress ledger, not a guide.

> **Guiding question:** what would the user experience be if session creation threw (backend down) *after* the gate rendered? Read the `catch` and answer precisely — this is graceful degradation as policy, and it recurs in Modules 7 and 9.

### Leg 3 — Guidance mounts: where do steps come from?

`Guidance/index.jsx`'s first big effect (line 323) answers "which steps drive this run?" with a priority ladder: `guide.steps` (local, full-fidelity) → `dynamicGuide.steps` (AI blueprint) → **only if resuming** (`sessionId` alone) → `api.listSteps(sessionId)`, computing the resume index from step statuses. Same ladder as the law from Leg 2: local when available, backend only when it's the sole source.

### Leg 4 — The step check: URL first, DOM second (panel → content script)

The heart is the `checkStep` effect (line 370). For the current step it runs, in order:

1. `getCurrentGcpUrl()` — if the tab URL already matches the step's `advanceOnUrlPattern` (`stepCompletedByUrl`), the step is done → auto-advance. *(Signal 3 of 3, met first.)*
2. If the step declares a `urlPattern` and the tab **isn't** on it → don't hunt look-alikes on the wrong page: set off-track, `showLostMascot()` (the "Take me back" mascot).
3. Otherwise `highlightStep(step, extras)` → `lib/guide.js` packages the step's *intent* into a `BAYMAX_GUIDE`/`highlight` message and — because the Console renders pages inside a same-origin iframe — **tries every frame** via `chrome.webNavigation.getAllFrames` + per-frame `tabs.sendMessage`, first success wins (`sendGuideCommand`).
4. In whichever frame holds the element, `guide-overlay.js` receives the message, `resolveTarget(intent)` **scores every visible candidate** and only accepts above a threshold; then the outline + mascot render inside a closed Shadow DOM. A miss returns `not-found` → Guidance retries on a timer (and where the retry loop ends, you'll find the commented-out `SELF-HEAL DISABLED` block — Module 7's assignment).

**Watch it live:** the Console tab's DevTools console logs `[Baymax] guide-overlay loaded in …` per frame; tap through a step and watch which frame answers.

### Leg 5 — Completion flows *up* (content script → panel → backend)

You click the highlighted button. The content script's watcher fires `chrome.runtime.sendMessage({ type: 'BAYMAX_GUIDE_CLICKED', … })` — fire-and-forget, no addressee. In the panel, `lib/guide.js` `onGuideStepEvent` catches it and Guidance advances: `markStepStatus(index, 'completed')` → `api.updateStepStatus` → `PATCH /sessions/{id}/steps/{step_id}` → `routers/steps.py` validates the status against its allowlist → `db_call.update_step_status` (owner-scoped) → the row flips. The next step becomes current, its effect fires, and we're back at Leg 4. The three completion signals, all now seen: **clicked**, **filled**, **URL changed**.

On the final step: `PATCH /sessions/{id}` → `completed`, and the Complete screen shows the guide's `nextSteps`.

## 9. Trade-offs & alternative implementations

- **Local steps + lossy backend ledger** vs *making `Step` store every resolver field*: the columns would chase a fast-evolving frontend shape forever (that's exactly why `RecordedGuide` chose JSONB — Module 8 closes this loop). Cost of the chosen design: resume-from-backend runs on degraded, resolver-field-less steps.
- **Frame broadcast, first-ok wins** vs *tracking which frame owns the element*: tracking would halve the message chatter but adds state that goes stale on every SPA navigation. Broadcast is stateless and self-healing. Cost: `clear` must broadcast to *all* frames (see `broadcastGuideCommand`'s comment for the stale-outline bug that taught this).
- **Session created in the background during the gate** vs *blocking on it*: hides latency, but means a guide can run session-less. The code accepts that deliberately (guide > ledger).

## 10. Common mistakes

- Assuming messages reach frame 0 only — on GCP, the element is *usually not* in frame 0. Forgetting this is the #1 cause of "works on example.com, dead on GCP."
- Treating the backend's step rows as the guide. They're the progress ledger; the resolver fields never made the trip.
- Expecting `chrome.tabs.sendMessage` from `localhost:5173` to work — the whole panel↔content-script channel exists only in the loaded extension (`isExtensionContext()` guards it).
- Reading `checkStep` as "highlight, then check URL" — it's URL-first on purpose; re-read step 1–2 ordering and the frontier guard (`maxReachedRef`) comments if you missed why.

## 11. Production considerations

Every hop you traced is a failure point with a *designed* fallback: backend unreachable at chip-tap → explicit offline-copy offer; session creation fails → guide runs unpersisted; frame has no listener → next frame; resolver miss → retry, then honest "navigate there manually" status; wrong page → lost mascot. Audit habit for the rest of the program: **at every hop ask "and if this fails?" — in this codebase the answer is usually a comment away.** Module 9.4 turns that habit into a formal review.

## 12. Exercises

1. **(Trace variation — resume)** Start a guide, close the panel mid-run, reopen, and resume from the Tasks tab. Which legs of the trace re-run? Which are skipped? Verify with the Network tab (you should see `GET /sessions/{id}/steps` this time — and no `POST`s).
2. **(Trace variation — chat)** Ask the chatbot to "deploy cloud run". Follow the SSE response in the Network tab (it's one streaming request — inspect its frames). Which leg of *this* lesson's trace does the chat path rejoin, and at which function in `App.jsx`?
3. **(Instrument it)** Add a temporary `console.log` in three places — `startTask` (panel), `sendGuideCommand` (panel, log the frameId that answered), and the `highlight` branch of the message listener (content script) — rebuild, run one step, and screenshot the three consoles showing one step's journey. Remove the logs after.
4. **(Prediction)** Open GCP, navigate *manually* to the page step 3 of the Cloud Run guide leads to, then start the guide. What happens to steps 1–3 and why? (The answer is in `checkStep` step 1 + the `atFrontier` guard.) Predict, then run.

## 13. Assignment

Produce your own **written trace of a flow this lesson didn't cover**, at the same depth: file → function → channel → file. Pick one:
- (a) Saving a recorded guide: Stop recording → review screen → `POST /guides` → row in `recorded_guides`.
- (b) A voice announcement: step becomes current → TTS request → audio playing (include the fallback path).

Format: numbered hops, each `file:function — what crosses the boundary here`. Then grade your Lesson 1.1 product brief against everything you now know: one sentence on what your brief got wrong or missed.

## 14. Quiz

1. Name the three completion signals and, for each, the file that *detects* it.
2. Why does `sendGuideCommand` iterate frames, and what does `first-ok-wins` mean there?
3. What is adopted from the backend's step rows into the local guide, and what is deliberately not?
4. In `checkStep`, why is the URL checked *before* the DOM is searched?
5. The user clicks the highlighted element, but the backend is down. Does the guide advance? Justify from the code.
6. Which actor never appears anywhere in this trace, and what are its only two jobs?

## 15. Best practices & further reading

- Practice: for any unfamiliar feature, write the numbered-hop trace *first*, fix bugs *second*. The trace is reusable; the fix is one-shot.
- Chrome for Developers: *Message passing* (all three patterns Baymax uses appear there).
- React docs: *Synchronizing with Effects* — `checkStep`'s cancellation pattern (`cancelled` flag in cleanup) is the canonical solution to the stale-async-effect problem; you saw it in the wild first.

## 16. Completion checklist

- [ ] I ran the full trace live with three DevTools open and saw each leg.
- [ ] I can draw §6's diagram from memory, with both protocols labeled.
- [ ] I can state the lossy-copy law and *why* it exists.
- [ ] Exercises 1–4 done (including the prediction in #4 — written before running).
- [ ] Assignment trace written; product brief self-graded.
- [ ] Ready for the [module checkpoint](README.md#mastery-checkpoint--the-investigation-hunt) — 10 hunts, 8 to pass.
