# Lesson 1.1 — What Baymax Is and Why It Exists

## 1. Learning objectives

After this lesson you can:
- State the problem Baymax solves and for whom, in one sentence each.
- Name the two deployable units, what each is built with, and why they are separate.
- Explain what "the extension overlays the live Console" actually means technically (and what it does *not* mean).
- Locate the authoritative descriptions of the system (`CLAUDE.md`, `manifest.json`, `main.py`) and know which one to trust for what.

## 2. Prerequisites

None — this is the program's entry point. (Knowledge graph: foundation layer.)

## 3. Estimated duration

~2 hours (reading + exercises).

## 4. Mastery levels covered

Level 1 (basic understanding). Level 2 begins in Lesson 1.3.

## 5. The problem — why does this product exist?

Put yourself in the target user's seat: a developer who has written a backend but never deployed one to Google Cloud. The GCP Console has hundreds of screens; a "simple" Cloud Run deployment crosses at least five of them; and the official docs describe a UI that Google redesigns without notice, so screenshots and step lists rot.

Three existing answers, and why each falls short for this user:

1. **Documentation / tutorials** — go stale, and live in a different window from the work, forcing constant context-switching ("which of these seven dropdowns did the article mean?").
2. **Full automation (Terraform, gcloud CLI)** — solves the task but teaches nothing, and requires learning *another* tool first. Wrong for a learner.
3. **Screen recordings** — stale the moment the UI shifts, not interactive, can't react to the user's actual page state.

Baymax's bet: guidance should live **on the page itself**, point at **the real button**, and **watch the user's progress** — the user still performs every action (so they learn), but never has to translate between a doc and the screen. That single product decision drives almost every technical decision you'll study in this program.

## 6. Theory

**Why a Chrome extension?** The guidance must draw on top of `console.cloud.google.com` — a site Baymax doesn't own. Only two mechanisms can inject UI into someone else's page: a browser extension, or asking the user to paste a script (unacceptable). Within extensions, Manifest V3 offers a **side panel** — a persistent UI docked beside the page — which fits "guidance stays visible while you work" far better than a popup that closes on every click. (Extension mechanics: Module 4.)

**Why a backend at all?** Three reasons, each visible in the repo: (a) the AI calls (Gemini) need a secret API key that can never ship inside an extension anyone can unzip; (b) guides and progress must survive across machines and sessions → a database; (c) curated guide content must be updatable **without republishing the extension** through the Chrome Web Store review process. Keep reason (c) in mind — it explains why official guides live in the database, and it will come back in Module 8.

**Why a monorepo?** Two deployable units, one product, one team, tightly coupled API contract (the extension's `api.js` mirrors the backend's routes one-to-one). One repo means one PR can change both sides of a contract atomically. The cost: the two units have completely different toolchains and release cycles (see §11).

## 7. Project mapping

Read these now, in this order — they are the system's three self-descriptions:

| File | What it authoritatively describes |
|---|---|
| [CLAUDE.md](../../../CLAUDE.md) | The whole system: structure, request flows, layer rules. (Corrected against the code on 2026-07-07 — trust it.) |
| [baymax-extension/manifest.json](../../../baymax-extension/manifest.json) | What the browser grants the extension: permissions, content scripts, the side panel, the service worker |
| [baymax-backend/main.py](../../../baymax-backend/main.py) | Everything the backend serves: 7 routers, CORS, rate limiting, tracing |

Also skim `README.md` and the frontend's `package.json` / backend's `requirements.txt` — dependency lists are an honest inventory of what a system really uses.

## 8. Code walkthrough

No deep code yet — but two artifacts deserve a careful read *as documents*:

**`manifest.json`** is a security contract, not config boilerplate. Notice: `host_permissions` is exactly one origin (`https://console.cloud.google.com/*`) — Baymax cannot see any other site. Two content scripts are injected there, one of them into **all frames** (`"all_frames": true` on `guide-overlay.js`) — hold that thought; in Lesson 1.3 you'll see why the Console's iframe structure forces it. The `side_panel.default_path` is `index.html` — the entire React app *is* the side panel.

**`main.py`** shows the backend's whole surface in 45 lines, because the project's layering rule (Module 2) forbids logic here. Count what it wires: logging, LangSmith tracing, a rate limiter with a friendly 429 handler, CORS driven by settings, and seven routers. If `main.py` in any FastAPI project you meet is longer than a page, something is in the wrong layer.

> **Guiding question (attempt before Lesson 1.2):** the manifest lists `"permissions": ["sidePanel", "storage", "tabs", "scripting", "webNavigation"]`. For each one, guess which Baymax feature would break without it. You'll verify your guesses across Modules 4–5.

## 9. Trade-offs & alternative implementations

| Decision | Chosen | Alternative | Why the alternative lost |
|---|---|---|---|
| Delivery surface | MV3 extension + side panel | Standalone web app with screenshots/instructions | Can't point at the real button; back to the doc-vs-screen translation problem |
| Guidance style | User acts, Baymax points | Full automation ("do it all for me") | Teaches nothing; also far more brittle — a wrong automated click has real consequences. (Note the *hybrid* actually shipped: "Do it for me" per step, user still in the loop.) |
| Repo layout | Monorepo | Two repos | API contract changes would need coordinated PRs; a capstone team pays that tax with zero benefit |
| Content home | Guides in the DB | Guides bundled in the extension | Store review latency means broken selectors stay broken for days; DB guides fix everyone instantly. Bundled copies survive only as an explicit offline fallback |

## 10. Common mistakes

- Assuming the extension "screen-scrapes with hardcoded selectors" — the whole point of Module 5 is that it does something much more interesting.
- Assuming the AI generates the flagship guides — the curated ones are human-authored/recorded and *live-tested*; the AI's blueprint mode is the fallback for uncatalogued asks, and the system actively routes *around* the AI when a curated guide matches.
- Reading `CLAUDE.md`'s structure tree as gospel for a repo you've just met. It's accurate *today* because it was verified against the code; docs drift. The code is always the tiebreaker.

## 11. Production considerations

The two units have asymmetric release physics, and it shapes the architecture: a backend fix deploys to Cloud Run in minutes; an extension fix waits on a build, a store upload, review, and users' browsers updating. **Anything that must change fast therefore belongs server-side** — guide content, AI prompts, model choices, rate limits. Check: all of those are indeed backend-side in this repo (DB rows and `Settings` fields, not frontend constants).

## 12. Exercises

1. **(Investigation)** From `manifest.json` alone, list every file the browser will execute or render without the React bundle being involved. Verify each exists in `baymax-extension/public/`.
2. **(Investigation)** From `main.py` alone, write down the seven route prefixes you expect the API to expose. Then confirm against `baymax-backend/tests/test_smoke.py`'s `required` set — which routes did you miss?
3. **(Architecture)** Write one paragraph: "Why can't the Gemini API key live in the extension?" Cover: who can read an extension's files, and what an attacker does with a leaked LLM key.

## 13. Assignment

Write a **half-page product brief** for Baymax as if pitching it to a new team member: problem, user, the one product decision that drives the architecture, and the two deployable units. No implementation detail deeper than this lesson. (You'll grade yourself in Lesson 1.3 by checking whether your brief survives contact with the real request flow.)

## 14. Quiz

1. Why is a browser extension the only viable delivery mechanism for this product? (One sentence.)
2. Name the three reasons the backend exists even though guides *could* ship inside the extension.
3. Which changes faster to production: a prompt fix or a resolver fix in `guide-overlay.js`? Why?
4. What does `"all_frames": true` mean, and which content script has it?
5. True or false: the background service worker calls the backend API on the side panel's behalf. (Careful — Lesson 1.3 proves it.)

## 15. Best practices & further reading

- Practice: when you meet a new codebase, read its *manifests* first (`manifest.json`, `main.py`, `package.json`, `Dockerfile`) — entry points and dependency lists can't lie.
- Chrome for Developers: *Manifest V3 overview* and *Side Panel API* (background for Module 4).
- FastAPI docs: *Bigger Applications — Multiple Files* (the pattern `main.py` + `routers/` follows).

## 16. Completion checklist

- [ ] I can state Baymax's problem/user/bet without notes.
- [ ] I read `CLAUDE.md`, `manifest.json`, and `main.py` end to end.
- [ ] I did the three exercises (route-prefix guesses checked against the smoke test).
- [ ] My product brief is written.
- [ ] Quiz answered — anything I got wrong, I found the answer in the code, not by rereading this lesson.
