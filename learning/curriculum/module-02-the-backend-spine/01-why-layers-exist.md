# Lesson 2.1 — Why Layers Exist

## 1. Learning objectives

- State the four-layers rule and what each layer is allowed to know.
- Given any line of backend code, name the file it belongs in — and defend the answer.
- Explain the three concrete failures layering prevents (untestability, drift, audit blindness), each tied to a real spot in this repo.

## 2. Prerequisites

Module 1 (you've seen requests cross the layers; now we name them). Knowledge graph: *layered architecture* → requires Pydantic + ORM awareness (built in 2.2/2.3 — this lesson gives the map, those give the territory).

## 3. Estimated duration

~2 hours.

## 4. Mastery levels covered

Levels 1–3 (understanding → applying the rule to new code).

## 5. The problem

Imagine this backend written the obvious way: every route a single function that parses the request, runs SQL, calls Gemini, and shapes the response. It works — briefly. Then: you can't test session logic without a live database; the same "is this my session?" WHERE clause is copy-pasted into six routes and one copy silently loses its `user_id` filter; a security review that asks "show me every query that touches steps" requires reading every file. Monoliths don't fail loudly — they *rot*.

The fix is not "more files." It's a **dependency rule**: each concern lives in one place, and the places only know about each other in one direction.

## 6. Theory

Baymax's backend is a small, honest implementation of layered (hexagonal-ish) architecture:

```
HTTP world          routers/        knows: schemas, db_call, services   (never SQL, never Gemini)
API contract        schemas/        knows: nothing below                (pure shapes)
business data ops   db_call.py      knows: models                       (never HTTP, never schemas)
DB shape            models.py       knows: database.py's Base           (never queries)
outside world       services/       knows: config, schemas              (Supabase/Gemini live here)
plumbing            database.py, config.py, rate_limit.py, observability.py
```

The rule of thumb from [CLAUDE.md](../../../CLAUDE.md): **routers = HTTP, schemas = API shape, models = DB shape, db_call = database, services = outside world, config = settings.**

Why one *direction* matters: `db_call.py` can be imported by a router, a seed script (`data/seed_official_guide.py` does exactly this), or a test — because it doesn't know HTTP exists. The moment it raises an `HTTPException`, every non-HTTP caller inherits a web framework dependency it never asked for. Check: `db_call.update_step_status` returns `None` for not-found/not-owned; the *router* turns `None` into a 404. Same fact, two layers, each speaking its own language.

## 7. Project mapping

- The rule stated: `CLAUDE.md` → "Key Rules for This Backend" #1, and the recipe.
- The rule obeyed: `routers/sessions.py` (zero `select` statements), `db_call.py` (zero status codes).
- The rule's edge: `routers/sessions.py` line 56 — `VALID_STATUSES` lives in the router. Is validation HTTP or shape? Hold that for §9.
- The seam that proves it works: `data/seed_official_guide.py` reuses `db_call.upsert_official_guide` from a CLI with no FastAPI in sight.

## 8. Code walkthrough

Open `routers/sessions.py` and `db_call.py` side by side. Pick `PATCH /sessions/{session_id}` and read it as a conversation between layers:

- Router: *"HTTP things"* — path param typing (`UUID` → automatic 422 on garbage), body schema, status-code decisions, the `_owned_session_or_404` helper whose docstring literally announces the split: "HTTP concern: turn a missing/none-owned session into a 404. The actual DB lookup lives in db_call."
- `db_call.update_session_status`: *"data things"* — fetch owner-scoped, mutate, commit, refresh, return the object or `None`. It has no idea a 404 exists.

> **Predict before reading on:** `delete_session` in the router breaks the pattern — it calls `db.delete(session)` and `db.commit()` directly instead of going through `db_call`. Decide: is this a violation worth a review comment? What would the comment say? (Yes — it's the one layering slip in this router. Your comment should offer the fix: a `db_call.delete_session` function. Noticing it is the skill; the codebase is good, not perfect, and the curriculum will not pretend otherwise.)

Now the payoff catalogue, each failure → the line that prevents it:

1. **Untestable logic** → `db_call` functions take `db: Session` as an argument; a test can hand them a session bound to a throwaway SQLite/Postgres and never boot FastAPI.
2. **Copy-paste drift** → "is this mine?" exists once: `get_session(db, session_id, user_id)`. Three routes reuse it (`steps.py` twice, `sessions.py` via the helper).
3. **Audit blindness** → "show me every write to steps" is one file, Ctrl-F `db.add`.

## 9. Trade-offs & alternative implementations

- **Cost of the rule: ceremony.** A one-line query still needs a named function in `db_call.py`. For a 10-route backend this is cheap; teams that skip it at 10 routes pay at 40.
- **Where validation lives is genuinely contested.** `VALID_STATUSES` sits in the routers (both `sessions.py` and `steps.py`) rather than as a `Literal` type on the schema. Schema-side would give free 422s and a self-documenting contract; router-side keeps the schema reusable if statuses ever differ per route. Reasonable people disagree — the *skill* is knowing both answers and the tie-breaker (this repo already duplicates the set in two routers, which leans the argument toward the schema; you'll act on this in 2.6's exercises).
- **Alternative architectures:** a service layer between routers and db_call (overkill here — there's no multi-step business logic that isn't AI-related, and AI already has `services/`); repository classes with interfaces (Java-flavored ceremony Python rarely needs at this size); or fat routers with a shared query module (what `db_call` would decay into without the "no db access in routers" rule being absolute).

## 10. Common mistakes

- "It's just one small query in the router" — drift never arrives as a big query. Rule survives on absolutism.
- Putting pure-DB helpers in `services/` because "it's logic." Services = *outside world* (Supabase, Gemini). Pure DB work goes in `db_call.py` — the recipe says so explicitly.
- Raising `HTTPException` from `db_call` — you've just made the seed script depend on FastAPI.
- Returning ORM objects from routers *without* `response_model` — works today, leaks columns tomorrow (checkpoint Q10).

## 11. Production considerations

Layering is what makes three future moves cheap, none hypothetical for this project: swapping Postgres details (all SQL in one file), adding a caching layer in front of reads (wrap `db_call` functions), and extracting a second service (e.g. guides) — the router + schema + db_call slices lift out along their seams. It's also the security team's best friend: owner-scoping audits are `db_call.py` reviews, not codebase-wide hunts.

## 12. Exercises

1. **(Investigation)** For each of these, name the file it lives in *before* looking, then verify: (a) the regex-free status allowlist for steps; (b) the query that lists a user's guides official-first; (c) the JWT audience check; (d) the WAV header construction; (e) the CORS origin list's source.
2. **(Violation hunt)** Find every place *outside* `db_call.py` that touches a SQLAlchemy session (`db.add/commit/delete/scalar`). There are at least two (one in a router, one in a script). For each: violation or justified? Write the one-line verdict.
3. **(Architecture)** The frontend has an analogous rule: "keep all backend API calls inside this file so frontend components stay clean" (`lib/api.js`'s comment). Write a short paragraph mapping frontend files to the backend's layers — which file is the frontend's `db_call.py`? Its `schemas/`? What has no analogue, and why?

## 13. Assignment

None standalone — this lesson's muscle is built through 2.2–2.6 and tested in the module assignment. Keep your exercise-2 verdicts; you'll want them for the checkpoint's Part A.

## 14. Quiz

1. Recite the rule of thumb (six clauses) from memory.
2. Why must `db_call` return `None` instead of raising a 404?
3. Name the non-HTTP caller of `db_call` that exists in this repo today.
4. Your PR adds `import db_call` inside `schemas/step.py`. What's wrong, before even reading the code?
5. Which layer knows about *both* Pydantic schemas and db_call functions, and why must exactly one layer have that privilege?

## 15. Best practices & further reading

- Practice: when reviewing any backend PR, first classify each hunk by layer, *then* read the logic. Half of all review findings fall out of the classification alone.
- *Architecture Patterns with Python* (Percival & Gregory) — ch. 2 (Repository) and 4 (Service Layer): the fuller version of what `db_call` is a pragmatic slice of.
- FastAPI docs: *Bigger Applications*, *SQL (Relational) Databases* — the official pattern this repo follows and simplifies.

## 16. Completion checklist

- [ ] I can recite the rule and the one-direction dependency principle.
- [ ] I found the `delete_session` slip on my own (or understand why it's a slip).
- [ ] Exercise 2's violation hunt done, verdicts written.
- [ ] I can name the three prevented failures with their repo evidence.
