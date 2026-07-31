# Program Overview — The Baymax Engineering Program

> **Deliverable 2 of the curriculum.** Built on the confirmed [00-repo-analysis.md](00-repo-analysis.md).
> This document is the map: outcomes, prerequisite graph, honest sizing, and the full module roadmap.
> Modules are generated one at a time after this is confirmed — each into `learning/curriculum/module-XX-<name>/`.

---

## 1. What this program is

A complete software-engineering education taught through **one real system you already own**: the Baymax Chrome extension + FastAPI backend. Instead of isolated tutorials, every concept — HTTP, auth, ORMs, browser extensions, LLM orchestration, deployment — is learned by understanding, breaking, extending, and defending the actual code in this repository.

The program follows the codebase's own center of gravity. Baymax is unusual among student projects in three ways, and the curriculum leans into all three:

1. **The guide engine** (`guide-overlay.js` + `lib/guide.js` + `pages/Guidance`) — a genuinely hard engineering problem (automating a UI you don't control) solved with a scoring resolver, not brittle selectors. This is the deepest module.
2. **Three distinct AI integration patterns** — function-calling mode selection, structured output with a hallucination guard, and a raw REST audio call — each teaching a different production-AI lesson.
3. **A disciplined backend layering rule** that is actually followed — rare enough in real codebases that learning *why* it holds is worth a module on its own.

### Who this is for

A junior developer (or the team members themselves) who can write basic Python and JavaScript but has not yet built production systems. No prior FastAPI, React internals, extension, or LLM experience is assumed — but this is not a gentle survey; every lesson ends in work.

---

## 2. Learning outcomes

By the end, the learner can — and each is tested by a mastery checkpoint or the capstone:

1. **Trace any feature end to end** (e.g. "what happens between typing in chat and the Start Guided Session button appearing?") naming every file, message, and network call on the path.
2. **Extend the backend without breaking the layering** — add a table, schema, db_call function, and router following the recipe, with owner-scoping and correct status codes.
3. **Explain and defend the system's architectural decisions** — why intents beat selectors, why chat is stateless, why guides are JSONB while steps are columns, why the side panel (not the worker) calls the API — and argue the trade-offs of the alternatives.
4. **Work safely inside a Manifest V3 extension** — contexts, permissions, frame broadcasting, Shadow DOM isolation, and the build pipeline that ships it.
5. **Build production LLM features** — prompts as versioned artifacts, tool schemas, streaming, deterministic routing around the model, guardrails, fallbacks, cost control, and tracing.
6. **Debug production-shaped failures** — a 401 after login, a highlight on the wrong element, an SSE stream that never finishes, a FK violation on first session — using logs, DevTools, and LangSmith rather than guesswork.
7. **Take a service to production** — containerize, configure, deploy to Cloud Run, and articulate exactly what breaks at two instances or ten thousand users.
8. **Carry the judgment forward** — apply the same layering, resilience, and AI-guardrail thinking to a system they've never seen (the capstone tests this directly).

---

## 3. Knowledge graph

Topics the program teaches, with hard prerequisites (→ means "requires"). The module sequence in §5 is a topological sort of this graph — nothing is taught before its prerequisites.

### Foundation layer (no prerequisites — Module 1 establishes all of them)
- **HTTP & REST** (verbs, status codes, headers, JSON)
- **Client–server model** (who calls whom; where state lives)
- **The repo's dev workflow** (venv/uvicorn, Vite, load-unpacked, git flow)

### Backend layer
- **Pydantic schemas** → HTTP & REST
- **SQLAlchemy ORM & relational modeling** → client–server (where state lives)
- **Layered architecture (the four-layers rule)** → Pydantic + ORM (you must know what each layer holds)
- **FastAPI dependency injection** → layered architecture
- **Migrations & schema evolution (JSONB trade-off)** → ORM
- **JWT & asymmetric crypto (JWKS, ES256)** → HTTP (headers), client–server
- **Authorization / owner-scoping** → JWT + db_call layer
- **Rate limiting & CORS** → HTTP, JWT (per-user keying)

### Extension layer
- **MV3 anatomy (contexts, permissions, manifest)** → client–server
- **Message passing & the frames problem** → MV3 anatomy
- **React state & effects (as used in App/Guidance)** → none beyond JS; deepened here
- **Extension build pipeline (Vite multi-entry, static copy)** → MV3 anatomy
- **Shadow DOM & CSS isolation** → MV3 (content scripts)

### Guide-engine layer (the project's core)
- **DOM fragility problem & selector strategies** → message passing
- **ARIA roles & accessible names** → DOM fragility (they are the answer to it)
- **The scoring resolver** → ARIA + DOM fragility
- **The guided-session state machine** → resolver + React state + REST (progress PATCHes)
- **URL-based completion detection** → state machine
- **Recording & fingerprinting (write-side of the resolver)** → resolver
- **Generalization (volatile tokens, parameterization)** → recording

### AI layer
- **LLM fundamentals (tokens, context, temperature, non-determinism)** → none
- **Prompt engineering (with the repo's real prompts)** → LLM fundamentals
- **Function calling / tool schemas** → prompts + Pydantic (the schema IS the prompt)
- **Structured output & validation guards** → function calling
- **SSE streaming end to end** → HTTP + function calling (delta suppression on tool calls)
- **Deterministic routing around the LLM** → function calling (interception needs it)
- **Fallbacks, rate limits, cost control** → LLM fundamentals + rate limiting
- **AI observability & evaluation (LangSmith, failure modes)** → all of the above

### Production layer
- **Docker & container thinking** → dev workflow
- **Cloud Run deployment & config management** → Docker + config.py discipline
- **Logging & graceful degradation** → layered architecture
- **Testing strategy (unit/route/LLM-behaviour, the frontend gap)** → every layer being tested
- **Scaling analysis (statelessness, shared stores)** → rate limiting + Cloud Run

---

## 4. Sizing — honest estimate

Sized to the actual code, not a target length:

- Backend: ~15 focused modules, disciplined and readable — **substantial but tractable**.
- Frontend: a ~1,400-line content-script engine, an ~800-line orchestrator page, a recorder, chat with SSE — **the deep end; the resolver alone justifies two weeks**.
- AI: three integration patterns with real guardrails — **two modules, not one**.
- Tests/infra: thin (3 test files, no CI) — taught partly by *building what's missing*.

**Total: 12 teaching weeks + 2 capstone weeks ≈ 14 weeks at 8–10 h/week** (a university semester). Full-time equivalent: ~7 weeks. Compressing below ~10 weeks would mean cutting the guide engine or the AI track to survey depth, which would defeat the point; padding beyond 14 would be invented content.

Learners who only need Levels 1–3 (understand + modify safely) can stop after Module 7 (~9 weeks); Levels 4–7 need the full run.

---

## 5. Roadmap — modules → weeks → lessons

Feature-based, prerequisite-ordered. Every lesson follows the 16-part lesson template (objectives → theory → project mapping → walkthrough → trade-offs → exercises → quiz → checklist). Cross-cutting topics are woven in where marked ⤷. Mastery levels use the 1–7 scale (1 basic understanding … 4 production architecture … 7 enterprise).

---

### Module 1 — The System in Your Hands *(Week 1 · Levels 1–2)*
*Feature anchor: running Baymax and watching one guide step happen.*

| Lesson | Title |
|---|---|
| 1.1 | What Baymax is and why it exists — the product, the users, the monorepo |
| 1.2 | Running both units: venv + uvicorn + `/docs`; Vite build + load-unpacked; wiring `.env`/`.env.local` |
| 1.3 | Anatomy of one guide step — tracing a chip tap from Home to a pulsing highlight (every file on the path, at survey depth) |

⤷ Cross-cutting: dev tooling, git flow (merge-only, per-dev branches), reading unfamiliar code.
**Checkpoint:** investigation hunt — "find where X happens" ×10 (e.g. where the bearer token is attached; which file decides side panel vs dashboard).

---

### Module 2 — The Backend Spine: Sessions & Steps *(Weeks 2–3 · Levels 1–4)*
*Feature anchor: session/step CRUD — the layering rule in its purest form.*

| Lesson | Title |
|---|---|
| 2.1 | Why layers exist — what `routers = HTTP, schemas = API shape, models = DB shape, db_call = database` buys you (testability, replaceability), and what it costs |
| 2.2 | Schemas: the API's contract — Pydantic v2, validation as security, and the deliberately **lossy** `StepCreate` |
| 2.3 | Models: the database's shape — SQLAlchemy 2 typed ORM, relationships, cascades, the `total_steps` property trick |
| 2.4 | `db_call.py`: every query in one place — and why routers never touch the session |
| 2.5 | FastAPI dependency injection — `get_db`, `Depends`, request lifecycle, the per-request session pattern |
| 2.6 | The recipe, live — walk `POST /sessions/{id}/steps` top-down, including the 409 duplicate-seed guard and the seed-guide fallback |

⤷ Cross-cutting: error handling (404 vs 409 vs 422), input validation, SQL injection immunity via the ORM.
**Assignment:** add a *session notes* feature end to end (column → schema → db_call → PATCH route → test), following the recipe with zero layer violations.
**Checkpoint:** architecture defense — "your teammate put a `select()` in a router; write the review comment that explains why it moves."

---

### Module 3 — Identity & Trust *(Week 4 · Levels 2–6)*
*Feature anchor: register → login → a protected request → logout.*

| Lesson | Title |
|---|---|
| 3.1 | Sessions, tokens, and JWTs — why stateless auth fits an extension + Cloud Run |
| 3.2 | Verifying without a shared secret — JWKS, ES256/RS256, key rotation, `PyJWKClient` caching; why the legacy HS256 secret is deprecated |
| 3.3 | The two-users problem — Supabase `auth.users` vs `public.users`, the FK failure it caused, and the idempotent `get_or_create_user` mirror |
| 3.4 | Authorization is not authentication — owner-scoping in `db_call`, and the **own-or-official** read rule vs strictly-own deletes (privilege-escalation thinking) |
| 3.5 | The perimeter — per-user rate limiting via `request.state`, CORS for a `chrome-extension://` origin, public-but-limited routes (`/tts`, `/guidance/repair`) |

⤷ Cross-cutting: security (token revocation semantics — access tokens outlive logout), graceful degradation (logout is idempotent by design).
**Checkpoint:** debugging scenario — "every request 401s right after a fresh login" (the token-refresh race `Tasks/index.jsx` guards against) + quiz on which routes an attacker with a stolen guide id can and cannot hit.

---

### Module 4 — The Extension Platform *(Week 5 · Levels 1–4)*
*Feature anchor: how the side panel reaches a page it doesn't own.*

| Lesson | Title |
|---|---|
| 4.1 | MV3 anatomy — manifest, permissions (why exactly these five), host permissions, the side panel vs popup decision |
| 4.2 | Three contexts, three lifetimes — side panel, service worker, content scripts; who can touch what; why `background.js` is 12 lines **and why that's a feature** |
| 4.3 | The frames problem — the Console's same-origin iframe, broadcast-to-every-frame in `lib/guide.js`, first-ok vs broadcast semantics |
| 4.4 | Shipping it — Vite multi-entry, unhashed filenames, static-copied plain-JS content scripts (why they can't be bundled modules), CSP |
| 4.5 | Surfaces and gates — `EntryGate` staging (splash → landing/login/app), surface detection, the dashboard as a separate full-tab app |

⤷ Cross-cutting: security (least-privilege permissions), performance (what a heavy content script costs every Console page).
**Assignment:** add a new message type flowing side panel → content script → back (e.g. "report how many candidates the resolver considered").
**Checkpoint:** architecture question — "the mic can't be captured in the side panel; explain the relay design and name one alternative Google could enable."

---

### Module 5 — The Guide Engine *(Weeks 6–7 · Levels 2–5 — the crown jewel)*
*Feature anchor: a full guided Cloud Run session, from PrereqGate to Complete.*

| Lesson | Title |
|---|---|
| 5.1 | The problem: automating a UI you don't control — why every naive selector strategy dies, with GCP-specific evidence (`<mat-*>`, layout variants, nbsp labels) |
| 5.2 | Steps as intents — the step shape (`role/name/text/href/avoid*/exactName/reveal*`), and accessibility as an engineering tool (the simplified ARIA name algorithm in code) |
| 5.3 | The scoring resolver — candidate pool, every scoring rule and its war story (why name-match is *required*, the long-text penalty, the focused-element bonus, the 45 threshold, failing to "not found" on purpose) |
| 5.4 | The overlay — closed Shadow DOM isolation, mascot construction, the rAF re-anchoring loop that survives Angular re-renders, `revealSelector` for transient panels |
| 5.5 | The orchestrator — `Guidance/index.jsx` as a state machine: three completion signals, off-track detection → lost mascot → `goBack`, "Do it for me", submit-failure timing |
| 5.6 | One source of truth — backend step status as the only progress store (the localStorage bug it replaced), the lossy-copy rule, and resume via `listSteps` |

⤷ Cross-cutting: accessibility (taught as *the* stability mechanism), performance (scoring cost per page), failure UX (step text always shows even when nothing highlights).
**Assignment:** author a brand-new 5-step guide **by hand** (JSON intents, no recorder) for a Console flow of your choice and run it live.
**Checkpoint:** debugging — three staged resolver failures (wrong element highlighted, nothing found, highlight drifts after re-render); diagnose each from behavior alone before reading the fix.

---

### Module 6 — AI Engineering I: The Chatbot *(Weeks 8–9 · Levels 2–5)*
*Feature anchor: one chat turn, in all three of its outcomes.*

| Lesson | Title |
|---|---|
| 6.1 | LLM fundamentals through Baymax's eyes — tokens, context windows, temperature 0 as a routing decision, why non-determinism is *the* design constraint |
| 6.2 | The system prompt as source code — a line-by-line read of `_SYSTEM` (mode rules, the ALL-CAPS constraints and the failure each one patches), prompts as versioned artifacts |
| 6.3 | Function calling: the schema is the prompt — `DeploymentPlan` bound as a tool, docstrings the model reads, tool-call-or-text as mode selection, validation as the safety net |
| 6.4 | Streaming end to end — SSE framing on the backend, delta suppression once a tool call starts, the manual reader in `api.js`, repainting bubbles; why the *final* frame is authoritative |
| 6.5 | Deterministic beats generative — the official-guide fast path (keyword + action word, zero LLM cost) and blueprint **interception**; when NOT to ask the model |
| 6.6 | Staying up under load — quota fallback chains (`with_fallbacks`), per-user rate limits, stateless-by-design (what history would cost), the db-before-stream rule in `routers/chat.py` |

⤷ Cross-cutting: cost optimization, logging (per-turn mode/latency lines), XSS safety of rendered markdown (DOMPurify).
**Assignment:** extend the AI: either (a) add a `difficulty` field through the whole blueprint pipeline, or (b) design and implement a third response mode — spec first, then code.
**Checkpoint:** scenario battery — for 10 user messages, predict fast-path / text / blueprint / interception *before* running them; explain each miss.

---

### Module 7 — AI Engineering II: Self-Heal & Voice *(Week 10 · Levels 3–6)*
*Feature anchor: a step whose selector died; a step read aloud.*

| Lesson | Title |
|---|---|
| 7.1 | Capture → reason → interpret — the self-heal loop as an agent pattern: frame-merged snapshots (the 120 cap and prompt-size budgeting), intent formatting |
| 7.2 | Structured output + the verbatim guard — `with_structured_output`, why "the selector must be one we sent" turns hallucination from a crash into a soft miss, confidence thresholds |
| 7.3 | Breaking your own rules well — why TTS bypasses LangChain (no audio modality), the httpx REST call, PCM→WAV by hand, and `None`-not-exception so a dead voice never kills a guide |
| 7.4 | Watching the machine think — LangSmith tracing (`run_name`, the settings→env bridge), and how you'd *evaluate* repair quality (golden snapshots, regression prompts) |

⤷ Cross-cutting: observability, graceful degradation as a system-wide discipline (browser-voice fallback, repair fallback to "navigate manually").
**Assignment:** re-enable self-heal behind a feature flag in `Guidance`, stage a deterministic broken step, and demo the full heal round-trip (this is also the demo-prep gap flagged in project memory).
**Checkpoint:** design review — "the model keeps returning confidence 0.9 on wrong elements; propose two guard changes and their failure modes."

---

### Module 8 — The Recorder & the Content Pipeline *(Week 11 · Levels 2–5)*
*Feature anchor: record a flow once → a guide anyone can run.*

| Lesson | Title |
|---|---|
| 8.1 | Recording by demonstration — event capture in the content script, ignoring Baymax's own UI, `fingerprintElement` as the write-side of the resolver |
| 8.2 | From one machine to any machine — volatile-token extraction from URLs, `applyGeneric`, parameterized fills so secrets never ship in a shared guide |
| 8.3 | Why guides are JSONB but steps are columns — schema evolution vs queryability, the `meta` bag (keywords, prerequisites, task ids as *data*, not code) |
| 8.4 | The official-guide trust model — seed-only `is_official`, upsert-by-title preserving ids, why re-seeding fixes console drift for every user without an extension update |

⤷ Cross-cutting: security (secret hygiene in exports), data modeling trade-offs, content-as-deployment.
**Assignment:** record a real Console flow, generalize it, seed it as official, and verify chat intent-matching finds it.
**Checkpoint:** trade-off essay (short): "steps-in-columns vs guide-as-JSONB — when would you migrate one to the other?"

---

### Module 9 — Production Readiness *(Week 12 · Levels 4–7)*
*Feature anchor: this exact system, deployed and honestly assessed.*

| Lesson | Title |
|---|---|
| 9.1 | Containers done deliberately — the Dockerfile line by line (layer caching, `$PORT`, `exec` and PID 1 signals), Cloud Run's contract |
| 9.2 | Configuration as a discipline — `Settings` as the single choke point, `.env` vs service config, what `extra="ignore"` tolerates and risks |
| 9.3 | The testing gap — what the 3 backend test files actually guarantee, then **close the gap**: service-layer tests with a faked LLM, a first frontend test harness |
| 9.4 | Failure-mode audit — walk every degradation path in the system (offline guides, TTS fallback, guide-table hiccup in chat, sessionless guides) and find the one that's missing |
| 9.5 | What breaks at scale — two Cloud Run instances (in-memory rate limiter), 10k users (JWKS caching, DB connections, Gemini quota), and the Redis/pooling/CDN answers |

⤷ Cross-cutting: CI/CD (design the missing pipeline), cost, monitoring.
**Assignment:** a written *production-readiness review* of Baymax (findings ranked by severity) + implement the top two fixes.
**Checkpoint:** mastery interview — defend three architectural decisions and *attack* two (steel-man the alternative).

---

### Capstone *(Weeks 13–14 · Levels 3–7)*

Specified fully in `capstone.md` (final deliverable), with rubric. Shape: **extend Baymax with one complete vertical feature** touching all four competencies — e.g. "Guide Marketplace" (share/browse/import recorded guides: new table + routes + authz + UI + an AI-assisted quality check on submitted guides) — plus a design document and a recorded end-to-end demo. Rubric weights: architecture fidelity, correctness, security, AI guardrails, communication.

---

## 6. The AI Engineering track, mapped

Required by the program (LEARNING.md) and satisfied as follows — every item taught through real code, none as a standalone abstraction:

| Track topic | Where |
|---|---|
| LLM fundamentals | 6.1 |
| Prompt design (real prompts) | 6.2 (chat `_SYSTEM`), 7.1 (repair prompt), 7.3 (TTS style prompt) |
| Context management | 6.6 (statelessness), 7.1 (snapshot cap/budgeting) |
| Structured outputs & tool calling | 6.3, 7.2 |
| Retrieval / embeddings | **Not present in the codebase — deliberately not taught.** The deterministic keyword match (6.5) is discussed as the pragmatic alternative, and "when would RAG earn its place here?" is an exercise |
| Agent patterns & memory | 7.1 (capture→reason→interpret as a single-step agent); memory absent by design, discussed in 6.6 |
| Evaluation & testing of AI behavior | 7.4, 9.3 |
| Failure modes, hallucination handling, guardrails | 6.3 (validation), 6.5 (interception), 7.2 (verbatim guard) |
| Latency, monitoring, cost | 6.4, 6.6, 7.4, 9.5 |
| Production AI architecture | 6.5, 6.6, 9.4, 9.5 |

## 7. Cross-cutting weave map

| Concern | Woven into |
|---|---|
| Security | 2.2, all of Module 3, 4.1, 6.6, 8.2, 9.4 |
| Error handling / graceful degradation | 2.6, 3.5, 5.5, 7.3, 9.4 |
| Performance & cost | 4.5, 5.3, 6.5, 6.6, 9.5 |
| Testing | 2 (assignment), 7.4, 9.3 (its own lesson — because the gap is real) |
| Accessibility | Module 5 (as the core stability mechanism — unusual and worth savoring) |
| Logging & observability | 6.6, 7.4, 9.4 |
| CI/CD & deployment | 9.1, 9.2, 9.5 |
| Caching | 3.2 (JWKS), 6.4 (TTS audio cache), 9.5 |

## 8. How the mentor behaves (applies to every module)

Per LEARNING.md: exercises come **before** full explanations; guiding questions before answers ("look at `scoreCandidate` — what stops a wrapper `<div>` from beating the button inside it?"); no toy examples — every artifact produced must run against the real system. Each module ends with a mastery checkpoint; do not continue past a failed checkpoint — revisit instead.

---

*Confirm this roadmap (or adjust module emphasis/order/pace) and I'll generate Module 1 into `learning/curriculum/module-01-the-system-in-your-hands/`, one lesson file at a time, following the full lesson template.*
