# Lesson 2.4 — db_call: Every Query in One Place

## 1. Learning objectives

- Read all ~235 lines of `db_call.py` and classify every function: read/write, owner-scoped or not, and why.
- Explain owner-scoping as *authorization in the WHERE clause* and why it beats router-side checks.
- Explain the N+1 problem and the one `selectinload` in this file that prevents it.
- Recognize idempotency (`get_or_create_user`, `upsert_official_guide`) as a design property, not an accident.
- Spot the deliberate *asymmetry* between guide reads (own-or-official) and guide deletes (strictly own).

## 2. Prerequisites

Lessons 2.1–2.3 (layers, schemas, models). Knowledge graph: this is the *db_call layer* node; feeds *authorization* (Module 3.4).

## 3. Estimated duration

~3 hours.

## 4. Mastery levels covered

Levels 2–5 (the scoping asymmetry and N+1 reasoning are production/scaling judgment).

## 5. The problem

Multi-tenant data with a single shared database: every user's sessions, steps, and guides live in the same tables, and *nothing but your queries* keeps user A out of user B's rows. If ownership checks live in routers, every new route is a chance to forget one — and the failure is silent (the code works perfectly for the developer testing with their own data). The data-access layer is where that risk gets structurally contained.

## 6. Theory

**Authorization in the WHERE clause.** Compare two designs for "update a step's status":

```python
# Design A (router checks, db trusts)          # Design B (this repo)
step = get_step(db, step_id)                    session = get_session(db, session_id, user_id)
if step.session.user_id != current_user: 403    if not session: return None
update(step)                                    step = db.scalar(select(Step).where(
                                                    Step.id == step_id,
                                                    Step.session_id == session_id))
```

Design A *fetches then filters* — the sensitive row is already in memory, the check is separate from the query, and any caller who forgets it has full access. Design B makes ownership part of the *lookup itself*: a row you don't own doesn't exist as far as this function is concerned. There is no "forgot the check" failure mode, because there is no separate check. This also collapses "not found" and "not yours" into one answer (`None` → 404), which is itself a security choice: a 403 would *confirm the resource exists* to someone probing ids. (UUIDs make probing hard; the 404 makes it uninformative. Defense in depth.)

**Idempotency** — an operation safe to run twice. `get_or_create_user` (check → create if missing) and `upsert_official_guide` (update-in-place by title, else insert) are both idempotent, and both *need* to be: the first runs on every session creation, the second on every re-seed. Note the comment on `upsert_official_guide`: updating in place "preserves the guide id, so extensions holding the old id keep working after a re-seed" — idempotency with *identity stability*, which is the stronger property.

**N+1**: serialize a list of N sessions where each serialization touches `.steps` (the `total_steps` property does), and lazy loading fires one query per session — N+1 round-trips. `selectinload(DBSession.steps)` batches it into 2 queries total.

## 7. Project mapping

`db_call.py` — the whole file. Consumers: all routers, `data/seed_official_guide.py`, (Module 3 adds `routers/auth.py`'s mirror call). The classification you'll build in ex. 1 *is* the map.

## 8. Code walkthrough

Read the file in its four sections, with a stop in each:

**Users.** `create_user` vs `get_or_create_user` — near-duplicates with one crucial difference: the latter takes an explicit `user_id` and inserts with it. That parameter is the entire Supabase-mirror trick (the auth id *becomes* our PK — possible because of 2.3's UUID choice). Why does `get_or_create_user` check by `id` while `create_user` checks by `email`? (Different identity questions: "is this auth user mirrored?" vs "is this email taken?")

**Sessions.** `get_sessions_by_user` carries the `selectinload`. Prove to yourself who needs it: which schema field, serialized by which route, touches `.steps`? Then note `get_session(db, session_id, user_id)` — the owner-scoped primitive that *everything else* reuses: `get_steps_by_session`, `update_session_status`, `update_step_status` all begin by resolving ownership through it. One WHERE clause, audited once, reused four times — Lesson 2.1's "copy-paste drift" antidote in the flesh.

**Steps.** `save_ai_step` is a plain parameter-heavy insert (the router loops it — bulk semantics live a layer up; §9 asks whether that's right). `get_steps_by_session` returns `None` for "no such session / not yours" but `[]` for "session exists, no steps" — and `routers/steps.py` leans on exactly that distinction (`if steps is None: 404`). A subtle contract: **`None` and empty are different answers.** Document-by-comment is all that holds it — what would make it sturdier? (A typed return, a docstring test… hold for 9.3.)

**Recorded guides.** The asymmetry, on purpose:
- Reads (`get_recorded_guides_by_user`, `get_recorded_guide`): `WHERE user_id = me OR is_official` — own-or-official visibility.
- Delete (`delete_recorded_guide`): `WHERE id = ? AND user_id = me` — and the docstring says *why it refuses to reuse* the read query: "being able to READ an official guide must not allow deleting it."

> **Guiding question before you continue:** suppose a hurried teammate "simplifies" `delete_recorded_guide` to first call `get_recorded_guide` (reusing the visibility rule) and then `db.delete()` the result. Write the exploit as a curl command. (Any signed-in user deletes the official Cloud Run guide for *everyone*.) This is the single best security-thinking example in the repo: **read visibility and write authority are different permissions**, and the code keeps them in different queries.

Also file away: every write commits immediately (`add → commit → refresh`). Simple and correct for single-writes; the multi-step case (bulk step creation) commits N times — a transaction-boundary question 2.6 picks up.

## 9. Trade-offs & alternative implementations

- **Fetch-then-filter vs filter-in-query** — argued in §6. The cost of B: the function *signature* must carry `user_id` everywhere, and there's no way to express "admin sees all" without new functions. (RLS — below — is the third way.)
- **Postgres Row-Level Security** (Supabase's flagship feature) could enforce owner-scoping *in the database itself*, making even a buggy query safe. Why doesn't this repo use it? The backend connects with a service-role connection and does its own auth; RLS shines when clients talk to Postgres directly (Supabase's client-side model). Adopting it here would add a second authorization system to keep in sync — defensible either way, and a strong checkpoint discussion.
- **Loop-of-inserts vs `db.add_all` + one commit** for bulk steps: N commits vs 1 transaction. At 9 steps it's invisible; the *atomicity* difference (partial failure leaves a half-seeded session) is the real issue — 2.6 exercise.
- **`None` returns vs raising domain exceptions** (`NotFoundError`): exceptions carry more meaning and can't be accidentally ignored, but reintroduce a coupling question (who defines them?). `None` is the pragmatic floor; know both.

## 10. Common mistakes

- Writing a new query that takes `session_id` but not `user_id` — the compiler won't catch it; the checkpoint's review-comment #1 is exactly this hole.
- Reusing a *visibility* query for a *mutation* (the exploit above).
- Forgetting `db.refresh()` after commit and returning an object with unpopulated server-side defaults (then the response schema fails on `created_at=None`).
- "Optimizing" away `selectinload` because the list endpoint "works fine" with 3 test sessions.
- Returning `[]` where the contract means `None` (or vice versa) — silently converts 404s into empty lists.

## 11. Production considerations

This file is the **audit surface**: a security review of data access reads these 235 lines, checks every SELECT for a `user_id` term, and is done. Keep it that way — resist "just this once" queries elsewhere. Performance-wise, this is also where slow-query work happens: the day `GET /sessions` is slow, the fix (index, query shape, pagination — note there is **no pagination** anywhere yet, a real gap at scale) lands here without touching HTTP. And the immediate-commit style means no long transactions holding locks — good default for a web app; revisit only with a measured reason.

## 12. Exercises

1. **(Classify)** Build the table: for all 13 functions — read/write? owner-scoped (and *how* — direct `user_id` term, via `get_session`, or `or_` with official)? idempotent? Any function you can't classify, re-read.
2. **(Exploit + fix drill)** Write (don't run against shared data) the curl for the delete-reuse exploit from §8. Then write the *test* that would have caught it: user A creates nothing; official guide exists; user A calls DELETE on it; assert 404 *and* the guide still exists for user B.
3. **(N+1, observed)** Set `echo=True` on the engine temporarily (or watch Supabase's query logs), hit `GET /sessions` with 3+ sessions, and count queries. Then comment out `.options(selectinload(...))`, repeat, count again. Restore. Write down both numbers.
4. **(Contract archaeology)** `get_steps_by_session` returns `None`-vs-`[]`. Find every caller and verify each handles both. Would a `Literal`-style type hint (`list[Step] | None`) have documented this? Check — is it already hinted?

## 13. Assignment

Folded into 2.6 — your notes feature adds one function to this file, and the checkpoint asks whether *you* scoped it.

## 14. Quiz

1. Why does returning `None` for "not yours" beat raising 403 from this layer? (Two reasons — one architectural, one security.)
2. Which single function do four others delegate ownership to?
3. What breaks (and how visibly) if `selectinload` is removed?
4. Why must `upsert_official_guide` preserve the guide id across re-seeds?
5. State the read/delete asymmetry rule for guides in one sentence.
6. What does `db.refresh(obj)` fetch, and what fails without it?

## 15. Best practices & further reading

- Practice: every new data-access function gets asked three questions before merge — *whose rows can this touch? is it safe to run twice? what does it return when the answer is nothing?*
- SQLAlchemy docs: *Relationship Loading Techniques* (lazy/selectin/joined — know all three).
- Supabase docs: *Row Level Security* — read it to understand what this repo chose *not* to use, and why the choice was coherent.
- OWASP: *Broken Access Control* (the #1 web vulnerability class; owner-scoping is your primary defense against it).

## 16. Completion checklist

- [ ] Classification table complete — all 13 functions.
- [ ] I wrote the exploit and the test that catches it.
- [ ] I counted the N+1 queries with my own eyes and restored the code.
- [ ] I can state the visibility-vs-authority principle without notes.
- [ ] Quiz clean.
