# Lesson 2.3 — Models: The Database's Shape

## 1. Learning objectives

- Read `models.py` fluently: typed mappings, relationships, cascades, defaults, and the two `@property` computed fields.
- Draw the four-table ER diagram from the code (not from memory of the analysis doc).
- Explain both cascade mechanisms (ORM-level vs `ondelete="CASCADE"`) and why the models declare both.
- Explain why `RecordedGuide.steps` is JSONB while `Step` is columns — now from the *storage* side.
- Know what `Base.metadata.create_all` does and — critically — does *not* do.

## 2. Prerequisites

Lessons 2.1–2.2. Knowledge graph: *SQLAlchemy ORM & relational modeling* → client–server (where state lives).

## 3. Estimated duration

~3 hours.

## 4. Mastery levels covered

Levels 1–4.

## 5. The problem

The database outlives every process, deploy, and refactor — it is the system's long-term memory, and mistakes in its shape are the most expensive kind (data migrations, not code edits). An ORM model file is where those decisions are written down. Reading `models.py` well means seeing not just "four tables" but: what deletes what, what's enforced by the DB vs by Python, which shapes are frozen (columns) vs flexible (JSONB), and where integrity actually comes from.

## 6. Theory

**The ORM maps classes↔tables, attributes↔columns, references↔relationships.** SQLAlchemy 2.0's typed style (`Mapped[str]`, `mapped_column(...)`) makes the Python type and the SQL constraint one declaration: `Mapped[str]` + `nullable=False` says both "this attribute is a `str`" and "this column rejects NULL."

**Two kinds of delete-cleanup, different enforcers:**
- `ForeignKey(..., ondelete="CASCADE")` — the **database** does it. Works even if rows are deleted by raw SQL or another client (e.g. the Supabase dashboard).
- `relationship(cascade="all, delete-orphan")` — **SQLAlchemy** does it, only for deletes issued through an ORM session.

Belt and suspenders: declare both, and the cleanup survives both paths. (Predict: which one fires when `routers/sessions.py` calls `db.delete(session)`? Which fires if you delete a user row in the Supabase SQL editor?)

**Identity strategy:** every PK here is a client-generated UUID (`default=uuid4`), not an auto-increment. Costs an index-unfriendly 16 bytes; buys: ids exist *before* commit, no id-guessing across users (an attacker can't enumerate `/sessions/1,2,3…`), and — decisive for this app — `users.id` can be **assigned** to equal the Supabase auth id (`get_or_create_user` passes the id in), which is what makes the mirror trick work at all.

**Computed properties beat stored counters** at this scale: `Session.total_steps`/`completed_steps` are Python `@property`s over the loaded relationship — always correct, no update anomalies. The cost (must load steps) is a *query-strategy* problem, and it's 2.4's opening act.

## 7. Project mapping

`models.py` (the whole file — 119 lines), `database.py` (`Base`, `init_db`), `schema.sql` (the SQL-side snapshot), and the consumers: `db_call.py` (every query), `schemas/session.py` + `schemas/guide.py` (the properties they serialize).

The ER picture to draw yourself (§12 ex. 1): `users 1—N sessions 1—N steps`; `users 1—N recorded_guides`; no FK between guides and sessions — a guide *run* becomes a session, but nothing links them. (Is that a gap? §9.)

## 8. Code walkthrough

Read `models.py` top to bottom with these stops:

**`User`** — minimal on purpose: id/email/name/created_at. Identity lives in Supabase; this row exists so FKs have something to point at (Lesson 1.3's Leg 2 + Module 3.3 tell that story). Note `email` is `unique=True` — which is what `create_user`'s existence-check in `db_call` leans on.

**`Session`** — `status` is a plain `String` with a Python-side `default='in_progress'`. Two things to notice: the default is applied by the ORM at insert time (not a server default — check `schema.sql` to see what the DB itself knows), and *nothing at the DB level constrains status values* — the allowlist lives in the router (2.2 §9's debate, now with a third layer in play: a DB `CHECK` constraint or Postgres `ENUM` would be the strictest home. Why might a fast-iterating capstone avoid a DB enum? Migration friction every time a status is added.)

**`Step`** — the ledger row. Read it against `StepCreate` from 2.2: same fields plus `id`/`session_id`/`status`/`created_at`. `action` is `nullable=False` but `title`/`description`/`selector` are nullable — the DB accepts a bare-minimum step; richness is optional. The inline comment on `title` ("or nullable=False if always required") is a decision *deferred in writing* — a common real-codebase artifact worth recognizing.

**`RecordedGuide`** — the JSONB decision, storage side. The docstring is the argument: resolver fields "live in the frontend's step shape and evolve there, so we store them losslessly as JSON rather than mapping each to a column." Three more deliberate moves:
- `is_official`: a `Boolean` column with the *trust rule* documented right on it — "POST /guides can never set this."
- `meta` not `metadata` — `metadata` is reserved by SQLAlchemy's `Base` (it's the `MetaData` registry). A naming landmine you now know about.
- `step_count` as `@property` — "no need to ship steps" for the list view; `GuideSummary` serializes it via `from_attributes`.

**`database.py`** — `init_db()` imports `models` *inside* the function. Trace the cycle that forces this: `models.py` does `from database import Base`, so `database.py` importing models at the top would be `database → models → database`. Deferred import = tables register on `Base.metadata` only when `init_db` runs. Also read `create_all`'s comment: "Generates tables if they don't already exist." Sit with that sentence — it means **`create_all` never alters an existing table.** New column on `Session`? `create_all` silently does nothing. This repo has no migration tool (no Alembic); schema changes to live tables are manual (`schema.sql` / Supabase SQL editor). The module assignment makes you feel this personally.

## 9. Trade-offs & alternative implementations

- **UUID vs serial PKs** — argued in §6; the assignability property is the clincher here.
- **Computed properties vs denormalized counters** — correct-by-construction vs read-cheap. At Baymax's scale, properties win; at "dashboard aggregating 10k sessions" scale you'd revisit (or push the count into SQL — `func.count` per query — as a middle path).
- **`datetime.utcnow` as default** — Python-side, naive-UTC. Alternatives: `server_default=func.now()` (DB-authoritative, survives non-ORM inserts) and timezone-aware `DateTime(timezone=True)`. The current choice is fine until two writers with skewed clocks exist; know the upgrade path. (Also: `utcnow` is deprecated in Python 3.12+ in favor of `datetime.now(timezone.utc)` — a modernization PR waiting to happen.)
- **No FK from sessions to guides** — a session records only a `title`. Cost: "which guide was this run of?" is unanswerable, so re-runs/analytics/resume-into-updated-guide are off the table. Benefit: sessions work for guides that no longer exist (deleted recordings, offline copies). A nullable `guide_id` FK is the obvious extension — checkpoint-grade discussion material.
- **No Alembic** — for a capstone with one shared dev DB, manual DDL is survivable; the moment you have prod + staging + laptops, migrations-as-code stop being optional. Module 9 revisits.

## 10. Common mistakes

- Believing `create_all` migrates. It creates *missing tables*, full stop.
- Declaring only the ORM cascade and testing only through the ORM — then a dashboard-side delete orphans rows in prod. (Or the reverse: only `ondelete` and wondering why in-session children linger un-flushed.)
- Naming a column `metadata` and meeting a cryptic `InvalidRequestError`.
- Mutating a JSONB field in place (`guide.steps.append(...)`) and wondering why nothing saves — SQLAlchemy tracks *assignment*, not deep mutation, unless you use `MutableList`/`MutableDict`. Note `db_call.upsert_official_guide` *assigns* (`guide.steps = steps`) — correct by design.
- Editing `models.py` and expecting the live table to follow.

## 11. Production considerations

Supabase Postgres means your tables are also visible to Supabase's own tooling (dashboard, RLS, backups) — `ondelete="CASCADE"` matters precisely because not every write path goes through SQLAlchemy. Two watch-items for real load: `sessions.user_id` and `steps.session_id` want indexes (FKs are not auto-indexed in Postgres — check `schema.sql`: are they there?), and JSONB columns can grow unbounded (a recorded guide with 500 steps is one 500-step row — no row-level pagination possible; the `GuideSummary`-without-steps split is the mitigation already in place).

## 12. Exercises

1. **(ER diagram)** Draw the four tables with PKs, FKs, cascades (mark *which mechanism*), and unique constraints — from `models.py` alone. Then diff against `schema.sql`: does the SQL match the ORM? Note any drift you find.
2. **(Cascade proof)** In a scratch session (or against your dev DB with a throwaway user): create user → session → 2 steps via the API, then `DELETE /sessions/{id}`. Verify the steps are gone. Now explain *which* cascade did it (hint: the delete went through `db.delete()` — read §6 again).
3. **(create_all's limit)** Add a harmless `nickname: Mapped[str | None]` to `User`, run `python database.py`, and inspect the real table (Supabase dashboard or `\d users`). Confirm the column did **not** appear. Remove the field. Write the two-line moral.
4. **(Property → wire)** Set one step of a live session to `completed` via PATCH, then `GET /sessions` and confirm `completed_steps` moved. List every file the number passed through (model property → schema → router) — three layers, no arithmetic in any router.

## 13. Assignment

Folded into 2.6's module assignment — where exercise 3's lesson becomes a required step (your notes column must actually exist in Postgres, and `create_all` won't do it for you).

## 14. Quiz

1. Which cascade mechanism protects against deletes made in the Supabase dashboard?
2. Why can `users.id` equal the Supabase auth id? What PK choice makes that possible?
3. What exactly happens when `create_all` runs against a DB where `sessions` exists but lacks a newly-declared column?
4. Why is the column called `meta`?
5. `guide.steps.append(step); db.commit()` — what goes wrong, and how does `upsert_official_guide` avoid it?
6. Where do `total_steps`/`completed_steps` get computed, and what would break if `steps` weren't loaded?

## 15. Best practices & further reading

- Practice: treat `models.py` changes as *infrastructure* changes — plan the DDL alongside the code, every time.
- SQLAlchemy 2.0 docs: *ORM Declarative Mapping* (typed style), *Cascades*, *Mutation Tracking* (for the JSONB gotcha).
- PostgreSQL docs: *JSONB* (operators, indexing with GIN) — background for Module 8's data-modeling argument.
- Alembic tutorial — read it now even though the repo doesn't use it; you'll propose it in Module 9.

## 16. Completion checklist

- [ ] ER diagram drawn from code and diffed against `schema.sql`.
- [ ] Cascade proof run; I can say which mechanism fired and when the other would.
- [ ] I witnessed `create_all` ignore my new column (and removed it).
- [ ] I can argue the JSONB-vs-columns split from the storage side (and the schema side, from 2.2).
- [ ] Quiz clean — misses looked up in code.
