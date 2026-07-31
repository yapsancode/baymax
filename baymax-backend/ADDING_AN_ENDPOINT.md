# Adding a New API Endpoint

A step-by-step guide for adding a backend endpoint to Baymax. If you follow the
layers in order, you (almost) never have to think about where code goes.

## The mental model

Every request flows **down through the layers**, each with one job:

```
HTTP request
   │
   ▼
routers/      "what URL, what method, who's allowed"   →  HTTP only
   │                                                       (uses schemas for shapes,
   │                                                        services for outside calls)
   ▼
db_call.py    "read/write the database"                →  all DB logic lives here
   │
   ▼
models.py     "how data is stored" (SQLAlchemy ORM)    →  the table classes
   │
   ▼
database.py   Base + engine + get_db                   →  connection plumbing
```

| Layer | File(s) | Its only job |
|-------|---------|--------------|
| **Router** | `routers/*.py` | Handle the HTTP request/response |
| **Schema** | `schemas/*.py` | Define the *shape* of data in/out (Pydantic) |
| **Data access** | `db_call.py` | Every DB read/write (`add/commit`, `select`) |
| **Service** | `services/*.py` | Talk to the **outside world** (Supabase, Gemini) |
| **ORM model** | `models.py` | The SQLAlchemy table classes |
| **DB plumbing** | `database.py` | `Base` + engine + `get_db` |
| **Config** | `config.py` | Typed env vars (read from `settings`) |

**Golden rule:**
`routers = HTTP · schemas = API shape · models = DB shape · db_call = database · services = outside world`

(`models.py` = the **database** shape, `schemas/` = the **API** shape — don't confuse them.)

Two things people get wrong:
- ❌ Running `db.add()` / `select()` inside a router. → That belongs in `db_call.py`.
- ❌ Putting DB code in `services/`. → `services/` is only for **external** systems. Plain DB work goes in `db_call.py`.

---

## The recipe

For a typical endpoint you touch **3 files** (steps 2–4). Steps 1, 5, 6, 7 are conditional.

1. **`models.py`** — only if you need a **new table** (add a SQLAlchemy ORM model).
2. **`schemas/`** — define the Pydantic **request/response** shapes.
3. **`db_call.py`** — add the **DB function** (`add/commit/refresh` for writes, `select` for reads).
4. **`routers/`** — add the **endpoint**. Keep it thin: declare the schema + dependencies, call `db_call`, return.
5. **`services/`** — only if it calls something **external**.
6. **`config.py`** — only if it needs a **new env var** (add a field to `Settings`; never `os.getenv`).
7. **`main.py`** — only if you created a **brand-new router file** (`app.include_router(...)`).

---

## Worked example: rename a session (`PATCH /sessions/{id}`)

Goal: let a user change a session's title. No new table, no external call — so we
touch steps **2, 3, 4** only.

### Step 2 — `schemas/session.py` (the input shape)

```python
class SessionUpdate(BaseModel):
    title: str
```

We already have `SessionResponse` for the output, so we reuse it.

### Step 3 — `db_call.py` (the database work)

```python
def update_session_title(db, session_id: str, user_id: str, title: str):
    # get_session is owner-scoped: returns None if it isn't this user's session.
    session = get_session(db, session_id, user_id)
    if not session:
        return None
    session.title = title
    db.commit()
    db.refresh(session)
    return session
```

### Step 4 — `routers/sessions.py` (the endpoint, thin)

```python
from schemas.session import SessionUpdate  # add to the existing import

@router.patch("/{session_id}", response_model=SessionResponse)
def rename_session(
    session_id: UUID,
    body: SessionUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    session = db_call.update_session_title(
        db, str(session_id), current_user["sub"], body.title
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
```

Done. Notice the router has **zero SQL** — it validates input (`SessionUpdate`),
checks auth (`get_current_user`), calls `db_call`, and returns. That's the pattern
for every endpoint.

---

## The four "always there" pieces in a protected route

Copy these four lines and you have a working authenticated endpoint skeleton:

```python
@router.post("", response_model=XxxResponse)          # 1. route + output shape
def do_thing(
    body: XxxCreate,                                   # 2. validated input
    db: Session = Depends(get_db),                     # 3. DB connection
    current_user: dict = Depends(get_current_user),    # 4. the logged-in user
):
    return db_call.do_thing(db, current_user["sub"], body.field)
```

- `current_user["sub"]` is the logged-in user's UUID (from the verified JWT). Use it
  to scope every query so users only see their own data.
- Remove `current_user` only if the route should be **public** (like `/chat`).

---

## Testing your endpoint

1. `uvicorn main:app --reload` → open `http://127.0.0.1:8000/docs`
2. Your new route shows up automatically in Swagger.
3. For protected routes: `POST /auth/login` → copy `access_token` → click **Authorize**
   (paste the token only) → call your route.

See `ADDING_AN_ENDPOINT` examples mirrored in the existing files: `create_session`
(write), `get_sessions_by_user` (list), `get_session` (single, owner-scoped).

---

## Common gotchas

- **422 Unprocessable Entity** → the request body didn't match your `schemas/` shape.
  Read the error; it names the bad field.
- **401 Invalid/expired token** → not logged in, token expired (~1h), or you pasted
  `Bearer <token>` instead of just `<token>` in Swagger.
- **Query param vs JSON body** → `def f(message: str)` reads a **query param**
  (`/chat?message=hi`); `def f(body: SomeModel)` reads a **JSON body**. Pick on purpose.
- **Returning a DB object** → fine, as long as the route has `response_model=XxxResponse`
  with `model_config = {"from_attributes": True}`. FastAPI converts the SQLAlchemy row
  to clean JSON for you.
- **New router file?** Don't forget `app.include_router(...)` in `main.py`, or the
  routes silently won't exist.
