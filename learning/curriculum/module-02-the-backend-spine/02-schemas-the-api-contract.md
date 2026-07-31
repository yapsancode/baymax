# Lesson 2.2 — Schemas: The API's Contract

## 1. Learning objectives

- Explain what a Pydantic schema *is* (a validated boundary, not a data class) and what crossing it guarantees.
- Read every schema in `schemas/` and state each one's job in a sentence.
- Explain the three deliberate design moves: the **lossy** `StepCreate`, the **lossless** `GuideCreate.steps: list[dict]`, and `StepResponse`'s camelCase serialization aliases.
- Use `response_model` filtering as a security tool, not decoration.

## 2. Prerequisites

Lesson 2.1 (schemas = the "API shape" layer). Knowledge graph: *Pydantic schemas* → HTTP & REST.

## 3. Estimated duration

~3 hours.

## 4. Mastery levels covered

Levels 1–4 (the lossy/lossless decision is production-architecture thinking).

## 5. The problem

An API's inputs arrive as untrusted JSON from the network; its outputs leak whatever you return. Without a declared shape at the boundary you get: garbage deep in business logic (a `step_number` of `"three"` exploding in the ORM), silent contract drift (frontend expects `urlPattern`, backend renames a column, nobody notices until the guide engine stops advancing), and accidental disclosure (return an ORM object, ship every column — including ones added later for internal use). Schemas make the contract *executable*.

## 6. Theory

A Pydantic model declares fields + types + constraints. At the boundary it does four jobs:

1. **Parse & validate in** — FastAPI builds the model from the request body; failure → automatic 422 with field-level errors, before your code runs. Types are coercion rules (`"3"` → `3`), constraints are policy (`TTSRequest.text: max_length=1200` is quota protection *as a type*).
2. **Filter & shape out** — `response_model=X` means: whatever you return, only X's fields leave, after validation. This is why routers can return ORM objects safely.
3. **Bridge naming worlds** — Python/SQL speak snake_case; the frontend speaks camelCase. `serialization_alias` translates at the boundary so *neither side* contaminates the other.
4. **Document** — `/docs` renders schemas as the API's reference; docstrings/`Field(description=…)` are user-facing (and, in `schemas/chat.py`, *model*-facing — the LLM reads them; Module 6).

The deeper principle: **a schema is a decision about what the API promises.** Everything not in the schema is *deliberately* not promised — which cuts both ways, as `StepCreate` is about to show.

## 7. Project mapping

| Schema file | Shapes | The teaching point |
|---|---|---|
| `schemas/step.py` | `StepCreate`, `StepStatusUpdate`, `StepResponse` | Lossy on purpose; camelCase aliases; single canonical `StepResponse` |
| `schemas/guide.py` | `GuideCreate`, `GuideSummary`, `GuideResponse` | Lossless `list[dict]` on purpose; summary-vs-full split |
| `schemas/session.py` | `SessionCreate`, `SessionStatusUpdate`, `SessionResponse` | `from_attributes` reading ORM *properties* (`total_steps`) |
| `schemas/auth.py` | `RegisterRequest`, `LoginRequest`, `AuthResponse` | `EmailStr` — validation as a dependency (`email-validator`) |
| `schemas/tts.py` | `TTSRequest` | constraint = abuse guard; response is bytes, so no schema |
| `schemas/chat.py`, `schemas/guidance.py` | (Modules 6–7) | schemas as LLM instructions — noted, deferred |

## 8. Code walkthrough

Read `schemas/step.py` in full (45 lines), then answer these *before* the explanations:

> **Predict:** `StepCreate` has no `role`, `name`, `exactName`, `avoidText`. You know from Lesson 1.3 that guide steps carry all of those. Is this a bug?

It's the **lossy projection**, and it's load-bearing. `StepCreate` feeds the `steps` *table* — the progress ledger. The ledger needs enough to display and resume a step (title, description, number, status) and to detect URL completion; it does not need the resolver's matching signals. Persisting them would mean chasing the frontend's fast-evolving intent shape with a column migration every time the resolver grows a field. The frontend comment you read in Lesson 1.3 ("the backend copy is lossy… never swap to it mid-run") is the *other half of this contract*. One decision, visible from both sides of the wire.

Now read `schemas/guide.py`'s module docstring — the *same problem* solved the *opposite* way: guides carry their steps as `list[dict]`, round-tripped losslessly, "rather than pin every field here — and risk silently dropping new ones." Why opposite answers?

> **Think, then check:** what's different about the two consumers? (Steps-ledger consumer: progress UI + resume — fixed needs, queried per-row, benefits from columns. Guide consumer: the guide *engine* — needs every field including future ones, read whole, never queried field-by-field. The data's *access pattern* chose the schema, not taste. Module 8 finishes this argument at the DB layer with JSONB.)

Third move — `StepResponse`, lines 39–40:

```python
url_pattern: Optional[str] = Field(default=None, serialization_alias="urlPattern")
advance_on_url_pattern: Optional[str] = Field(default=None, serialization_alias="advanceOnUrlPattern")
```

The DB column is `advance_on_url_pattern`; the guide engine reads `step.advanceOnUrlPattern`. The alias translates *on serialization only* — and now find the mirror image: `routers/steps.py` accepts **both** spellings on the way in (`raw_step.get("url_pattern") or raw_step.get("urlPattern")`). Input tolerant, output canonical. (Postel's law, practiced quietly.)

Also worth 60 seconds each: `SessionResponse` gets `total_steps`/`completed_steps` "for free" because `from_attributes` reads the ORM's `@property`s — schema and model cooperating across layers without either importing the other. And `schemas/session.py`'s top comment records a refactor lesson: `StepResponse` used to be defined twice; now one canonical definition is imported by both routers. Duplicate schemas *will* drift — this repo already paid that tax once.

## 9. Trade-offs & alternative implementations

- **Lossy columns vs lossless JSONB** — argued above; the meta-lesson is that *both* live in one codebase because access patterns differ. Uniformity for its own sake would have been worse.
- **`status: str` + router-side allowlist vs `Literal["pending", ...]`** — Literal gives free 422s, docs, and one source of truth; the current design duplicates `VALID_STATUSES` in two routers. Counter-argument: error *message* control ("Must be one of: …") and per-route flexibility. You'll form your own position in 2.6.
- **camelCase aliases vs frontend adapting to snake_case** — the alias keeps each side idiomatic at the cost of one translation point. The alternative (frontend uses snake_case everywhere) is simpler but infects every `.jsx` file with Python naming. A third option — `alias_generator` on a shared base — scales better if many schemas need it; with only one schema needing it, per-field aliases are honest.
- **`EmailStr`** costs a dependency (`email-validator`) to reject garbage emails at the boundary instead of at Supabase — earlier failure, better error, small price.

## 10. Common mistakes

- Confusing `models.py` and `schemas/` — *the* classic. DB shape vs API shape. The repo's own test refactor history (`tests/test_smoke.py`'s comment "schemas (renamed from models/)") shows even this team once had them merged; the stale `models/__pycache__` directory is the fossil.
- Adding a field to the ORM and forgetting the response schema (field silently never leaves) — or the reverse (validation error on every response). `from_attributes` hides the wiring; the contract is still two-sided.
- Using one schema for create *and* response "to save code" — now clients can send `id` and `created_at`, and you must remember to ignore them. Separate shapes per direction is the whole point.
- Validating in the router what the schema could enforce — every line of imperative validation is a line `/docs` doesn't know about.

## 11. Production considerations

Schemas are your API's *versioning* surface: additive changes (new optional field) are safe; renames and removals break clients you don't control — and this project's client updates on the Chrome Web Store's schedule, not yours (Lesson 1.1 §11). Before changing any response schema, ask "which shipped extension versions read this field?" The camelCase aliases also mean **renaming a DB column is invisible to clients** if the alias holds — the boundary absorbs the change; that's the payoff moment for move #3.

## 12. Exercises

1. **(Feel the 422)** From `/docs`, send `POST /sessions` with `{"title": 123}`, then `{}`, then `{"title": "ok", "extra": "field"}`. Record the three outcomes and explain the third (what does Pydantic do with undeclared fields by default?).
2. **(Filter proof)** Temporarily add a fake field `internal_note: Mapped[str | None]` … actually, don't touch the DB — instead *return* `{"id": ..., "hacked": True, **valid_fields}` from a copy of a route (or just reason it through from `response_model` semantics, then verify with the docs): does `hacked` reach the client? Why not?
3. **(Alias round-trip)** With a running guide session, hit `GET /sessions/{id}/steps` from `/docs` and confirm the JSON says `urlPattern`, not `url_pattern`. Then find the exact line in `lib/guides/cloudRun.js` or the guide engine that *reads* the camelCase name.
4. **(Design)** Write the `Literal`-based version of `StepStatusUpdate` and `SessionStatusUpdate`. List what improves, what you lose, and which routers' lines become deletable. Keep the diff — 2.6 asks for it.

## 13. Assignment

Folded into the module assignment (2.6) — your session-notes feature will need a request schema and a response change, designed before coded.

## 14. Quiz

1. What four jobs does a schema do at the boundary?
2. Why is `StepCreate` missing the resolver fields — and what frontend rule is its mirror?
3. Same repo, opposite choice: why is `GuideCreate.steps` a `list[dict]`?
4. What does `from_attributes = True` enable, and which computed fields ride on it?
5. A client sends `urlPattern` in a step-create body. Which line makes that work?
6. Why must request and response schemas be separate classes even when fields overlap?

## 15. Best practices & further reading

- Practice: design the schema *before* the endpoint — if you can't write the shape, you don't understand the feature yet.
- Pydantic v2 docs: *Models*, *Fields* (aliases), *Configuration* (`from_attributes`).
- FastAPI docs: *Response Model — Return Type*; *Body — Fields*.
- Postel's law ("be conservative in what you send, liberal in what you accept") — and its modern critiques; Baymax's input-tolerant/output-canonical steps route is a reasonable middle.

## 16. Completion checklist

- [ ] I can explain lossy-vs-lossless as an *access pattern* decision, not a style choice.
- [ ] I triggered and read a 422, and know what happens to undeclared input fields.
- [ ] I verified the camelCase alias on the wire and found its reader in the frontend.
- [ ] My `Literal` diff from exercise 4 is written and saved.
- [ ] I can state what `response_model` filtering protects against.
