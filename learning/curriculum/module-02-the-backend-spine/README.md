# Module 2 — The Backend Spine: Sessions & Steps

*Weeks 2–3 · ~16–20 hours · Mastery Levels 1–4 · Prerequisites: Module 1 (running system, the trace)*

## Why this module exists

Every request you traced in Lesson 1.3 crossed the same four layers on the backend: router → schema → db_call → model. This module teaches you to *think* in those layers — not because Baymax says so, but because the layering solves problems you'll be made to feel first. By the end you can add a full feature to this backend without breaking a single rule, and — more important — explain to a teammate *why* the rule they broke exists.

The feature anchor is sessions & steps: the progress ledger from Lesson 1.3, chosen because it exercises every layer with no AI or Supabase complexity in the way.

## Lessons (in order)

| # | Lesson | Time |
|---|---|---|
| 2.1 | [Why layers exist](01-why-layers-exist.md) | ~2 h |
| 2.2 | [Schemas: the API's contract](02-schemas-the-api-contract.md) | ~3 h |
| 2.3 | [Models: the database's shape](03-models-the-database-shape.md) | ~3 h |
| 2.4 | [db_call: every query in one place](04-db-call-the-data-access-layer.md) | ~3 h |
| 2.5 | [Dependency injection & the request lifecycle](05-dependency-injection.md) | ~2.5 h |
| 2.6 | [The recipe, live](06-the-recipe-live.md) | ~2 h + assignment |

The module assignment (session notes, end to end) is defined in Lesson 2.6 and typically takes 3–4 hours.

## Mentor's rule for this module

When a lesson shows you a piece of code, **predict what it does and why it's shaped that way before reading the explanation**. The layering rules will feel arbitrary until you've watched each one prevent a specific bug — the lessons are sequenced to make you feel the bug first.

---

## Mastery Checkpoint — the Architecture Defense

Two parts. Do both cold (no notes); answers live in the code and in your own module work.

### Part A — Write the review comments

For each diff below, write the review comment you'd leave: name the violated rule, the concrete bug or cost it invites, and where the code should go. One paragraph each.

1. A teammate adds to `routers/sessions.py`:
   ```python
   @router.get("/search")
   def search_sessions(q: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
       return db.scalars(select(DBSession).where(DBSession.title.ilike(f"%{q}%"))).all()
   ```
   *(There are TWO problems — one architectural, one a security hole. Find both.)*

2. A teammate adds a `steps_json: Mapped[dict]` JSONB column to `Session` in `models.py` "so we don't need the steps table anymore," keeping the `Step` table for old rows.

3. A teammate needs the Gemini model name in a router and writes `os.getenv("GEMINI_MODEL", "gemini-2.5-flash")` inline.

4. A teammate changes `StepStatusUpdate` to `status: str | None = None` "so PATCH doesn't error when the frontend sends nothing."

### Part B — Rapid-fire (one sentence each)

5. Why does `StepResponse` need `serialization_alias` while `GuideResponse` doesn't?
6. `SessionResponse.total_steps` is populated without any query in the router. Trace how.
7. Why does `get_sessions_by_user` use `selectinload` but `get_session` doesn't?
8. What stops `db_call.update_step_status` from updating another user's step, even if the router forgot its auth dependency?
9. Why does `database.init_db()` import `models` *inside* the function body?
10. Your new endpoint returns ORM objects directly and it works. What is `response_model=` still buying you?

**Scoring:** Part A all four with both layers-and-consequence named, Part B ≥5/6 → proceed to Module 3. Otherwise: redo Lesson 2.6's walkthrough, then retry.

<details>
<summary><b>Answer sketches — open only after writing yours</b></summary>

1. (a) Raw `select` in a router — query belongs in `db_call.py` (testability, one place to audit queries). (b) **Missing owner-scoping**: no `user_id` filter, so any authenticated user searches everyone's sessions. The `current_user` dependency authenticates but the query must authorize.
2. Duplicates the source of truth (two places steps can live = they *will* diverge); breaks the progress model (`completed_steps` counts Step rows); JSONB vs columns is a real trade-off (Module 8) but *migrating halfway and keeping both* is the worst of each. Also: schema change with data migration implications — not a drive-by.
3. Violates the config rule: env access is `config.py`'s monopoly. Costs: the default gets duplicated (and will drift from `Settings`), no type validation, invisible to anyone auditing configuration. Fix: `from config import settings; settings.GEMINI_MODEL`.
4. Widening the contract to hide a client bug. A no-op PATCH now succeeds silently (frontend thinks it saved), and the router's `VALID_STATUSES` check would throw a confusing 422 on `None` anyway. Fix the frontend; keep the contract strict.
5. `StepResponse` maps snake_case DB columns to the camelCase names the frontend reads (`urlPattern`); `GuideResponse.steps` is `list[dict]` passed through losslessly — there are no field names to translate.
6. ORM `Session.total_steps` is a Python `@property` over `self.steps`; `model_config = {"from_attributes": True}` lets Pydantic read properties as attributes during serialization.
7. The list view serializes `total_steps`/`completed_steps` for *every* session — without eager loading that's one extra query per session (N+1). `get_session` returns one object whose steps load lazily on first touch, which is acceptable for a single row.
8. The query itself: it first resolves the session via `get_session(db, session_id, user_id)` — ownership is a WHERE clause, not a router-side check. Defense in depth.
9. To break a circular import: `models.py` imports `Base` from `database.py`, so `database.py` importing models at module top would be circular. Deferred import registers the tables on `Base.metadata` only when `init_db` actually runs.
10. Response filtering (fields not in the schema never leak — e.g. a future secret column), documented contract in `/docs`, and validation that what you return actually matches what you promised.

</details>
