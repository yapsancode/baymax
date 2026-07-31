# Module 3 — Identity & Trust

*Week 4 · ~10–12 hours · Mastery Levels 2–6 · Prerequisites: Module 2 (layers, db_call scoping, DI)*

## Why this module exists

Every request you built in Module 2 began with `Depends(get_current_user)` treated as a black box. This module opens it — and the system around it. Baymax's auth is a **hybrid**: the frontend holds a session with Supabase directly, the backend never sees a password at login time, yet every API call is verified server-side against Supabase's public keys. Understanding *why* that topology is sound (and where it's fragile) is Level-6 security thinking taught on real code — including two places where the code and the ideal genuinely diverge.

## Lessons (in order)

| # | Lesson | Time |
|---|---|---|
| 3.1 | [Sessions, tokens, and the hybrid topology](01-sessions-tokens-and-the-hybrid-topology.md) | ~2.5 h |
| 3.2 | [Verifying without a shared secret: JWKS](02-verifying-without-a-shared-secret.md) | ~2.5 h |
| 3.3 | [The two-users problem](03-the-two-users-problem.md) | ~2 h |
| 3.4 | [Authorization is not authentication](04-authorization-is-not-authentication.md) | ~2 h |
| 3.5 | [The perimeter: rate limits & CORS](05-the-perimeter-rate-limits-and-cors.md) | ~2 h |

## Mentor's rule for this module

Think like two people at once: the engineer shipping the feature, and the attacker reading the same code looking for the seam. Every lesson has at least one "wear the attacker's hat" moment — do not skip them; they are the module.

---

## Mastery Checkpoint — the Incident & the Threat Model

### Part A — Incident: "Everything 401s right after login"

A teammate reports: *"User logs in, lands in the app, and the first `GET /sessions` returns 401. Refreshing the panel fixes it. It's random — sometimes it works."*

Write an incident analysis (half a page): the two most plausible causes given this exact codebase, how you'd distinguish them from the panel's Network tab in five minutes, and the fix for the real one. **Hint you may use:** one page in this repo already contains the defensive pattern that prevents this bug — find it and name it.

### Part B — Threat model: the stolen guide id

An attacker (authenticated with their own free account) has obtained the UUID of another user's **personal** recorded guide and the UUID of one **official** guide. For each API operation below, state: allowed or blocked, by exactly which line/mechanism, and what the attacker learns from the response:

1. `GET /guides/{personal_id}` (someone else's personal guide)
2. `GET /guides/{official_id}`
3. `DELETE /guides/{official_id}`
4. `DELETE /guides/{personal_id}`
5. `POST /guides` with body `{"title": "evil", "steps": [...], "is_official": true}`
6. `PATCH /sessions/{someone_elses_session}/steps/{their_step}` with `{"status": "completed"}`

### Part C — Rapid-fire

7. Why does login not need the backend but register does?
8. What does the backend's logout revoke, and what stays valid anyway? For how long?
9. What is the `aud` claim check protecting against?
10. What does the Google button actually do today, and what is the first API call to fail afterwards?

**Scoring:** A convincing (cause distinguishable by evidence, fix correct), B 6/6 with mechanisms named, C 3/4 → proceed to Module 4.

<details>
<summary><b>Answer sketches — open after writing yours</b></summary>

**A.** Plausible causes: (1) the fetch fires before supabase-js has finished restoring/refreshing the persisted session, so `authHeader()` returns no/stale token — the classic race; (2) clock-skew or an expired access token that hasn't refreshed yet. Distinguish in DevTools: does the failing request carry an `Authorization` header at all? Missing/short header → race (1); present but rejected → decode it at jwt.io and check `exp` (2). The defensive pattern already in the repo: `pages/Tasks/index.jsx` waits for `supabase.auth.getSession()` and re-fetches on `SIGNED_IN`/`TOKEN_REFRESHED` events instead of fetching immediately on mount. Fix: apply the same wait-for-session gate (or centralize it in `api.js` — wait for `getSession()` to settle before first use).

**B.** 1: **blocked, 404** — `db_call.get_recorded_guide`'s `or_(user_id == me, is_official)` finds nothing; attacker can't distinguish "not mine" from "doesn't exist." 2: **allowed, 200** — officials are readable by every signed-in user by design. 3: **blocked, 404** — `delete_recorded_guide` is strictly owner-scoped (`user_id == me` only); read visibility ≠ delete authority. 4: **blocked, 404** — same owner-scoped delete; it's not theirs. 5: **succeeds but harmlessly** — `GuideCreate` has no `is_official` field, so Pydantic drops the key; `create_recorded_guide` never sets it; result is a personal guide. The schema's *omission* is the defense. 6: **blocked, 404** — `update_step_status` resolves ownership via `get_session(db, session_id, user_id)` first.

**C.** 7: Login only needs a Supabase session, which supabase-js can obtain itself; register must also mirror the user into `public.users` (FK for sessions), which only the backend (service key) does. 8: The **refresh token** (via `admin.sign_out`); the stateless **access token** stays valid until `exp` (~1 h). 9: Token-audience confusion — a Supabase-issued JWT for some *other* purpose/audience being replayed against this API; we only accept tokens minted for `authenticated` users. 10: Calls `onLogin()` and enters the app UI with **no session at all**; the first API call — `GET /guides` on a chip tap or `GET /sessions` on the Tasks tab — fails (no `Authorization` header → 403 from `HTTPBearer`).

</details>
