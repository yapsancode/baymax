# Lesson 2.5 — Dependency Injection & the Request Lifecycle

## 1. Learning objectives

- Explain what `Depends()` actually does at request time (call, cache, inject, clean up) and trace one request's full lifecycle through it.
- Explain the `yield`-dependency pattern in `get_db` and exactly when the session closes.
- Explain how `get_current_user` composes *another* dependency (`HTTPBearer`) and turns absence-of-token into a 401 you never wrote.
- Recognize DI as the mechanism that makes the layer rule *testable* (override a dependency, fake a layer).

## 2. Prerequisites

Lessons 2.1–2.4. Knowledge graph: *FastAPI dependency injection* → layered architecture.

## 3. Estimated duration

~2.5 hours.

## 4. Mastery levels covered

Levels 2–4.

## 5. The problem

Every protected endpoint needs the same three things before its real work starts: a DB session (opened now, closed *no matter what*), a verified identity, and its parsed body. Written imperatively, that's 10 lines of boilerplate per route — and the cleanup line is the one someone eventually forgets, leaking connections until the pool starves. Dependency injection turns "things a route needs" into *declarations*, and hands the framework the job of providing and cleaning them up.

## 6. Theory

`Depends(f)` in a parameter default tells FastAPI: before calling this route, call `f` (resolving *its* parameters the same way, recursively), and pass the result in. Key mechanics:

- **Per-request cache:** the same dependency appearing twice in one request's tree runs once.
- **`yield` dependencies are context managers in disguise:** everything before `yield` runs pre-handler; the yielded value is injected; everything after `yield` (the `finally`) runs *after the response is sent* — even on exceptions. That's `get_db`:

  ```python
  def get_db():
      db = OrmSession(bind=_engine)
      try:
          yield db
      finally:
          db.close()      # runs even if the route raised
  ```

- **Dependencies compose:** `get_current_user(request, credentials = Depends(_security))` — a dependency depending on `HTTPBearer()`. `HTTPBearer` parses the `Authorization` header and *itself* raises 403 if it's missing — so a route with `get_current_user` rejects anonymous requests before any of your code runs.
- **Dependencies can smuggle state:** `get_current_user` sets `request.state.user_id` — that's how the rate limiter (which is *not* in the DI tree) later keys per-user. A quiet side channel worth knowing about.

**The full lifecycle of `PATCH /sessions/{id}/steps/{step_id}`, in order:** middleware (CORS) → routing → path-param parsing (`UUID` coercion or 422) → dependency tree: `HTTPBearer` (401/403 on no header) → `get_current_user` (JWKS verify → 401 on bad token → sets `request.state.user_id`) → `get_db` (session opened) → body parsing (`StepStatusUpdate` or 422) → **your handler** → response validated/filtered through `response_model` → `get_db`'s `finally` closes the session → response leaves. Count how little of that you wrote.

## 7. Project mapping

| Piece | Where |
|---|---|
| `get_db` (yield dependency) | `database.py` |
| `get_current_user` + `HTTPBearer` composition | `services/auth_service.py` (mechanics in Module 3; today it's "a dependency that yields a verified payload") |
| Every consumer | all routers — count the `Depends` per route |
| The raw-credentials variant | `routers/auth.py` `_bearer` — logout needs the raw token, not the decoded payload, so it depends on `HTTPBearer` directly |
| The smuggled state's consumer | `rate_limit.py` `_user_key` |

## 8. Code walkthrough

**`get_db`, closely.** One session per request, closed in `finally`. Two questions to answer from the code, not from me:
1. `_engine` is module-level and shared; sessions are per-request. What does each own? (Engine = connection *pool* + dialect, process-wide; session = unit-of-work over a pooled connection, request-scoped. This split is why a global engine is right and a global session would be catastrophic.)
2. There's no `db.rollback()` anywhere. If a route raises mid-transaction, what happens? (`close()` on a session with an active transaction rolls it back — the pattern is safe, but *implicitly*. A stricter `get_db` catches, rolls back explicitly, re-raises. Know that this one leans on `close()` semantics.)

**`routers/steps.py`'s signature, parameter by parameter:**

```python
def update_step_status(
    session_id: str,                                  # path
    step_id: str,                                     # path
    body: StepStatusUpdate,                           # parsed+validated body
    db: Session = Depends(get_db),                    # opened for me, closed after
    current_user: dict = Depends(get_current_user),   # verified or 401'd for me
):
```

The handler body is then *pure orchestration*: validate the status against the allowlist, call `db_call`, map `None`→404. Every layer supplied by declaration.

> **Predict, then verify:** `session_id` is typed `str` here but `UUID` in `routers/sessions.py`. What differs for a request with `session_id="garbage"`? (In sessions: FastAPI 422s before the handler. In steps: the string reaches the DB query and returns... check what Postgres does with a non-UUID string compared against a UUID column — you may find an unhandled 500. Inconsistency spotted by *reading signatures* — file it for your assignment's test ideas.)

**The testing superpower** (used in Module 9.3, introduced now): `app.dependency_overrides[get_db] = lambda: test_session` swaps the real DB for a fake *without touching any route code*. Same for `get_current_user` → a canned user. DI is what makes "test the router without Supabase or Postgres" a one-liner. This is the layering rule cashing out.

## 9. Trade-offs & alternative implementations

- **DI vs explicit calls in each handler:** explicit is more traceable ("where did `db` come from?" has a visible answer) but unenforceable — the cleanup discipline decays. DI centralizes lifecycle *and* enables overrides; its cost is magic (new readers must learn `Depends`).
- **Per-request session vs session-per-operation:** per-request gives one unit of work per HTTP call (natural transaction boundary); per-operation would isolate failures more but multiply overhead and split atomicity. Per-request is the web default for a reason.
- **`request.state` smuggling vs passing user_id explicitly to the limiter:** slowapi's key function only receives `request`, so state-smuggling is forced by the library's interface. Recognize the pattern: *side channels are sometimes imposed by third-party APIs* — contain them (one write, one documented read) rather than proliferate.
- **Global engine at import time** (`database.py` line 26) vs lazy/app-startup creation: import-time is simple but means importing `database` *anywhere* (tests! seed scripts!) builds a pool if `DATABASE_URL` is set. FastAPI's `lifespan` startup hook is the heavier, more controlled alternative.

## 10. Common mistakes

- Opening sessions manually inside handlers "just this once" — now cleanup is your job again, and the override trick can't reach it.
- Doing slow work (an LLM call!) *inside* a `yield` dependency's pre-yield section — it delays every route that declares it. (Check: is `get_db` cheap? Yes — sessions are lazy; no connection is used until the first query.)
- Assuming `Depends` re-runs per use within a request (it caches) — or assuming it caches *across* requests (it never does).
- Forgetting that dependency exceptions short-circuit: if `get_current_user` raises 401, your handler never runs — so "add logging in the handler" can't observe auth failures. (Where would you log those? Module 9.4.)
- Type-hinting the injected session as anything but `Session` and losing editor autocomplete for the whole file.

## 11. Production considerations

The engine's **pool** is the resource that matters at load: default pool size (5) + overflow (10) means ~15 concurrent DB-touching requests per process before waiters queue. Long-held sessions (slow handlers, streaming responses that touch `db` mid-stream) starve it — which is precisely why `routers/chat.py` fetches guides *before* streaming starts and its comment says "the generator below must not touch the db session mid-stream." You traced that line in Module 1; now you know the resource-lifecycle reason it exists. Cloud Run adds a twist: many instances × 15 connections can exhaust *Postgres's* connection cap — the standard answer is a pooler (Supabase provides pgbouncer). Module 9.5 does the arithmetic.

## 12. Exercises

1. **(Lifecycle narration)** Write the full ordered lifecycle (as in §6) for `POST /guides` — every parse, dependency, and cleanup, with the failure status each stage can emit. Verify the 403-vs-401 behavior of a missing vs malformed `Authorization` header against the live server.
2. **(Override drill)** In a scratch test file: create a `TestClient`, override `get_current_user` to return `{"sub": "<a-real-test-user-uuid>", "email": "t@t.t", "user_metadata": {}}`, and call `GET /sessions` without any token. Confirm it works — you've just tested an authed route with zero Supabase involvement. (Keep this file; it's the seed of your 9.3 work.)
3. **(The str/UUID inconsistency)** Confirm §8's prediction: call `GET /sessions/not-a-uuid/steps` and `GET /sessions/{same}/…` on the sessions router. Record both responses. Write the one-line fix and the review comment.
4. **(State smuggling)** Trace `request.state.user_id` end to end: written where, read where, and what the limiter falls back to when it's absent. Why is the fallback safe for `/chat` specifically?

## 13. Assignment

Folded into 2.6 — your notes endpoint will declare both dependencies and your test will override one.

## 14. Quiz

1. When exactly does the code after `yield` in `get_db` run, and what makes that reliable under exceptions?
2. What are the two failure responses the dependency tree can emit before your handler runs, and from which dependencies?
3. Engine vs session: which is shared, which is per-request, and what does each own?
4. How do you test a protected route without a real JWT? Name the exact mechanism.
5. Why does `routers/auth.py` logout depend on `HTTPBearer` directly instead of `get_current_user`?
6. Why must `/chat` finish its DB reads before streaming begins? (Resource, not style.)

## 15. Best practices & further reading

- Practice: any resource with a cleanup step (session, file, lock, client) enters routes only via a `yield` dependency. No exceptions — literally.
- FastAPI docs: *Dependencies* (all five pages — they're short), *Testing Dependencies with Overrides*.
- SQLAlchemy docs: *Session Basics* ("when do I make a session?") and *Connection Pooling*.

## 16. Completion checklist

- [ ] I can narrate a request's lifecycle stage by stage, unprompted.
- [ ] My override-based scratch test runs green without Supabase.
- [ ] I confirmed and can explain the str/UUID inconsistency and its fix.
- [ ] I can state what the engine pool is and the chat router's mid-stream rule.
- [ ] Quiz clean.
