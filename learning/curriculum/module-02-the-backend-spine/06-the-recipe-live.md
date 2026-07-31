# Lesson 2.6 — The Recipe, Live

## 1. Learning objectives

- Walk the repo's 7-step "add an endpoint" recipe against a real, non-trivial route (`POST /sessions/{id}/steps`) and account for every design decision in it.
- Execute the recipe yourself, end to end, on a new feature (the module assignment).
- Make and defend three judgment calls the recipe leaves open: validation placement, transaction boundaries, and dual-spelling tolerance.

## 2. Prerequisites

Lessons 2.1–2.5 — this lesson is their synthesis. Knowledge graph: closes the backend-layer cluster; Module 3 builds on it.

## 3. Estimated duration

~2 hours walkthrough + 3–4 hours assignment.

## 4. Mastery levels covered

Levels 2–4 (the assignment is the module's Level-4 gate).

## 5. The problem

Knowing the layers separately isn't the job — the job is *adding a feature without breaking any of them, under time pressure*. The recipe ([CLAUDE.md](../../../CLAUDE.md) → "How to add a new endpoint") is the team's encoding of that skill. This lesson first watches the recipe's result in the wild, then hands you the keyboard.

## 6. Theory — the recipe, restated with its *whys*

1. **`models.py`** — only for a new table. (*DB shape is the most expensive thing to change — touch last, touch least.*)
2. **`schemas/`** — request/response shapes. (*Design the contract before the behavior; 2.2.*)
3. **`db_call.py`** — the query, owner-scoped. (*Authorization in the WHERE clause; 2.4.*)
4. **`routers/`** — thin: schema + `Depends` + db_call + status mapping. (*HTTP only; 2.1.*)
5. **`services/`** — only for the outside world. (*Not for DB work — ever.*)
6. **`config.py`** — only for a new env var. (*One typed home; 1.2.*)
7. **`main.py`** — only for a brand-new router file.

"Most CRUD endpoints touch 3 files" — schemas, db_call, routers. Your assignment touches 4 (a model change too), plus one thing the recipe *doesn't* mention, which 2.3 taught you to expect. (What?)

## 7. Project mapping

The specimen: `routers/steps.py` `create_steps` (`POST /sessions/{session_id}/steps`) — chosen because it's the recipe's output *plus* four judgment calls worth stealing. Supporting cast: `schemas/step.py`, `db_call.save_ai_step`, `data/seed_guides.py`, and its clients (`App.jsx`'s two `saveSteps` call sites).

## 8. Code walkthrough — the specimen, decision by decision

Read `create_steps` top to bottom. It's ~40 lines; every block is a decision:

**Decision 1 — ownership first.** `db_call.get_session(db, session_id, user_id)` before anything else; `None` → 404. The owner-scoped primitive from 2.4, reused not reimplemented.

**Decision 2 — the 409 duplicate guard.** `get_steps_by_session` → if any exist, `409 Conflict`. Why does this matter more than it looks? Recall Lesson 1.3 Leg 2: the frontend creates the session *then* bulk-saves steps, and adopts returned ids. If a retry (double-tap, flaky network re-POST) seeded twice, the session would hold two interleaved copies of the guide and progress would be nonsense. The 409 makes seeding *effectively idempotent-or-refused* — the honest alternative to true idempotency. (Sharper question: is there a race window between the check and the inserts if two requests interleave? Yes — nothing at the DB level enforces it. A `UNIQUE(session_id, step_number)` constraint would close it. File that thought.)

**Decision 3 — the fallback body.** `steps_body: Optional[List[StepCreate]] = Body(default=None)` — no body means "use the hardcoded `CLOUD_SQL_POSTGRES_GUIDE`." This is a *legacy testing affordance* (project memory says its deletion is deferred). Note the cost of keeping it: the route has two behaviors, the seed data ships in the image forever, and a client bug that sends no body gets 201-with-surprise-steps instead of a 422. When you inherit a route like this, the kindest act is often a deprecation comment with a removal condition.

**Decision 4 — input tolerance.** `raw_step.get("url_pattern") or raw_step.get("urlPattern")` — accepts both spellings (2.2's Postel move). Notice it happens *after* `s.model_dump()` for typed bodies — so which callers actually exercise the camelCase branch? (Only the fallback-dict path. The typed path already normalized. Tolerance code that's half-dead — worth knowing when you read it.)

**Decision 5 — the loop of commits.** N steps → N `save_ai_step` calls → N transactions. If insert 5 of 9 fails, steps 1–4 are committed: a half-seeded session (which the 409 guard will then *refuse to fix* — see the interaction?). The atomic version: build all `Step` objects, `db.add_all`, one commit — one transaction, all-or-nothing. The current shape is simpler and was fine for a demo; the interaction with the 409 makes it a genuine bug-in-waiting. Your assignment's test list should include this scenario even if you don't fix it.

**Decision 6 — status is server-owned.** Every created step gets `status="pending"` — the client cannot seed a step as already-completed. Contract enforcement by omission: `StepCreate` simply has no `status` field. (Cheapest security control in the whole file: a field that doesn't exist.)

## 9. Trade-offs & alternative implementations

Gathered from the module, now yours to rule on (the assignment forces all three):

1. **Validation placement** — router allowlists vs `Literal` schemas vs DB CHECK constraints. (Your exercise-4 diff from 2.2 is a ready PR.)
2. **Transaction boundary** — loop-of-commits vs single transaction for multi-row writes.
3. **Tolerance** — accept both spellings forever, or normalize at one boundary and be strict everywhere else?

There is no universally right answer; there is *your* answer with reasons, which is what the checkpoint grades.

## 10. Common mistakes

- Starting with the router (it's the fun part) and back-filling schemas — you end up shaping the contract around implementation accidents. Recipe order exists to prevent exactly this.
- Skipping the "does the recipe step apply?" question — e.g. reflexively making a service file for pure-DB work (recipe step 5's explicit warning).
- Forgetting the response schema change when the feature adds output (your notes must appear in `SessionResponse` — or clients can write but never read them).
- Writing the endpoint before the DDL and wondering why Postgres rejects inserts (2.3's `create_all` lesson, now with your name on it).
- Testing only the happy path — every decision in §8 exists because of an *unhappy* path.

## 11. Production considerations

The recipe is also a *review protocol*: a reviewer checks a feature PR file-by-file in recipe order — contract sane? query scoped? router thin? config typed? Ten minutes, high yield. Adopt it for your own assignment self-review. And note what the recipe deliberately lacks: a migrations step (no Alembic — Module 9 proposes it) and a tests step (the team's gap, Module 9.3 closes it). Your assignment includes both anyway, because you now know better.

## 12. Exercises

1. **(Specimen mastery)** Without the file open, list `create_steps`' six decisions and the failure each guards. Then check.
2. **(The race)** Write the exact interleaving of two concurrent `POST .../steps` requests that defeats the 409 guard. What's the smallest fix — app-level lock, DB unique constraint, or `ON CONFLICT`? Pick one and say why.
3. **(Judgment call rehearsal)** Write your three §9 rulings as one-paragraph ADRs (context → decision → consequences). These go in your assignment PR description.

## 13. Assignment — Session Notes, end to end (the module gate)

**Feature:** a user can attach free-text notes to a session (e.g. "stopped at billing screen — ask team about budget"), see them in session lists, and update them.

**Spec:**
- `PATCH /sessions/{id}/notes` with body `{"notes": "..."}` (max length: your call — justify it), owner-scoped, 404 on not-yours, response = updated `SessionResponse` including the notes.
- `notes` visible in `GET /sessions` and `GET /sessions/{id}`.

**Required path (recipe order, plus the two missing steps):**
1. `models.py`: `notes: Mapped[str | None]` on `Session` — **plus the manual DDL** (`ALTER TABLE sessions ADD COLUMN notes text` via Supabase SQL editor or psql), because you proved in 2.3 that `create_all` won't do it. Update `schema.sql` to match.
2. `schemas/session.py`: `SessionNotesUpdate` request shape (with the length constraint *in the schema* — 2.2) + `notes` on `SessionResponse`.
3. `db_call.py`: `update_session_notes(db, session_id, notes, user_id)` — owner-scoped in the WHERE, `None` on miss, following the file's conventions exactly.
4. `routers/sessions.py`: the thin endpoint. No SQL, no business logic.
5. **Tests** (in `tests/`, runnable with `pytest`): at minimum — 404 for another user's session (use the dependency-override trick from 2.5), 422 for an over-length note, and the happy path. Faking the DB is allowed; hitting your dev DB with a throwaway user is also allowed — state which you chose and why.
6. **PR description**: the three ADRs from exercise 3, plus one sentence on any inconsistency you chose to *follow* for consistency's sake vs *fix* (e.g. the str/UUID typing from 2.5).

**Definition of done:** endpoint works from `/docs` and from a one-line addition to `lib/api.js` (optional stretch: surface it in the Tasks tab UI); tests green; zero layer violations on your own recipe-order review.

## 14. Quiz

1. Recite the recipe with each step's *why*.
2. Which two steps does the recipe omit that your assignment required, and why does the repo's history explain each omission?
3. What does the 409 guard protect, and what race does it not close?
4. Why can't a client create a pre-completed step? Name the mechanism.
5. Your notes PATCH returns the session but `notes` is missing from the JSON. Rank the three most likely culprits, fastest-to-check first.

## 15. Best practices & further reading

- Practice: recipe order for writing, recipe order for reviewing, ADR paragraphs for every judgment call a reviewer might question.
- *Architecture Decision Records* (Michael Nygard's original post) — the format your §12.3 rulings used.
- FastAPI docs: *Path Operation Configuration* (status codes), *Body — Multiple Parameters* (the `Body(default=None)` trick).
- PostgreSQL docs: *ALTER TABLE* — the DDL you just ran by hand, and *unique constraints* for the race fix.

## 16. Completion checklist

- [ ] Specimen's six decisions recited cold.
- [ ] Assignment shipped: DDL run, four files changed, tests green, ADRs written.
- [ ] My own recipe-order review of my diff found (and fixed or documented) at least one thing.
- [ ] I can defend all three judgment calls out loud.
- [ ] Ready for the [module checkpoint](README.md#mastery-checkpoint--the-architecture-defense).
