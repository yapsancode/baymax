# Lesson 3.3 — The Two-Users Problem

## 1. Learning objectives

- Explain why the same person exists as *two* rows in *two* systems (Supabase `auth.users` and our `public.users`), and what each is for.
- Trace the exact foreign-key failure that forced the mirror, and how `get_or_create_user` prevents it.
- Explain why the mirror is idempotent and why it uses the *same UUID* rather than a new one.
- Identify where the mirror runs (register **and** first session create) and why it's needed in two places.

## 2. Prerequisites

Lessons 3.1–3.2 (you know `sub` is the Supabase user id) and Module 2.3–2.4 (FKs, `get_or_create_user`). Knowledge graph: *authorization/identity* → JWT + db_call.

## 3. Estimated duration

~2 hours.

## 4. Mastery levels covered

Levels 2–4.

## 5. The problem

Authentication is outsourced to Supabase — so the authoritative user record lives in *Supabase's* `auth.users` table, which we don't own and can't put foreign keys against. But our data (`sessions`, `recorded_guides`) needs to say "this belongs to that user," and a foreign key must point at a table in *our* database. Two systems, one human, and a referential-integrity gap between them. Bridging that gap cleanly — without a second source of truth for *identity* — is the whole lesson.

## 6. Theory

**Two tables, two jobs:**
- `auth.users` (Supabase-owned): credentials, email confirmation, OAuth links, password hashes. The identity *authority*. We never write here except through Supabase's auth API.
- `public.users` (ours, `models.py`): a thin projection — id, email, name, created_at. Exists *so our foreign keys have a target*. It is a **mirror**, not a second authority.

**The keystone move:** the mirror row uses the **same UUID** as the Supabase auth user. `get_or_create_user(db, user_id=sub, …)` inserts with the id supplied, not a fresh `uuid4()`. Because `sessions.user_id` (a FK into `public.users`) is populated from the token's `sub`, and `public.users.id` *equals* that `sub`, the FK resolves. This is only possible because Module 2.3 chose client-assignable UUID PKs — auto-increment integers could never equal an externally-minted id. One design decision, three lessons apart, paying off here.

**Idempotency by necessity:** the mirror must be safe to call repeatedly (once at register, again on every session create) and must no-op after the first time. Check → return existing → else insert. Never duplicates, never errors on the second call.

## 7. Project mapping

| Where the mirror runs | File | Why here |
|---|---|---|
| At registration | `routers/auth.py` `register` → `db_call.get_or_create_user` | The natural first moment we know the new user |
| At first session create | `routers/sessions.py` `create_session` → `db_call.get_or_create_user` | The safety net — see §8 |
| The function | `db_call.py` `get_or_create_user` | Idempotent, same-id insert |
| The FK it satisfies | `models.py` `Session.user_id → users.id` | The constraint that started it all |

## 8. Code walkthrough

**The failure first.** Read the FK-FIX comment in `routers/sessions.py` `create_session` — it names the exact Postgres error the mirror prevents: *"Key (user_id)=… is not present in table users."* Picture the sequence that produces it: a user authenticates (valid token, real `sub`), calls `POST /sessions`, the insert sets `user_id = sub` — and Postgres rejects it because no `public.users` row has that id yet. Authentication succeeded; *referential integrity* failed. Two different notions of "this user exists."

**Why the mirror lives in two places.** If register always mirrored, why does `create_session` mirror again? Enumerate the paths that reach a valid token *without* going through *our* register:
- Google OAuth (when real) — Supabase creates the auth user; our `/auth/register` never runs.
- A user created directly in the Supabase dashboard.
- Register succeeded but the mirror insert failed transiently (network blip) while the auth user was made.
- Email-confirmation flows where the first *app* action is a session, not a re-register.

In every case the *first API write* is the last safe place to ensure the mirror exists — so `create_session` does it defensively. `get_or_create_user`'s idempotency is what makes "mirror in two places" harmless rather than a double-insert bug. Read how `create_session` builds the name: `user_metadata.name or full_name or email or "User"` — a graceful fallback chain, because OAuth users may carry `full_name` while password users carry `name`, and either might be absent.

> **Guiding question:** `db_call.get_or_create_user` checks by `id`; `db_call.create_user` (the other one) checks by `email`. Why the different keys, and which one must the mirror use? (Mirror asks "is *this auth identity* already projected?" → id. An email check would misfire if a user changed their email in Supabase, or collide if two auth users ever shared one — id is the stable identity. `create_user`'s email check answers a different question and isn't on the mirror path.)

**What the mirror is *not*.** It is not kept in sync. If a user changes their name in Supabase later, `public.users.name` goes stale (the mirror only writes on *create*). Is that a bug? Mostly no — the mirror exists for FK integrity, and display name is read from the *token* (`getCurrentUser` in `api.js` reads `user_metadata`, not our table). So the stale column is simply unused for display. Knowing *which* field is authoritative for *which* purpose (token for display, mirror row for FK target) is the subtle competence here.

## 9. Trade-offs & alternative implementations

- **Mirror-on-demand (this design) vs webhook sync:** Supabase can emit auth webhooks to keep `public.users` continuously synced. That gives a fresher, complete mirror — at the cost of a new endpoint, webhook auth, retry/idempotency handling, and an ordering dependency (webhook vs first request race). For this app's needs (FK target + a name it doesn't even rely on), lazy mirror-on-write is dramatically simpler and sufficient. Know when you'd flip: the moment you need to *query* users the app hasn't seen act yet (e.g. an admin "list all users" screen).
- **No `public.users` at all** (store `sub` as a bare string, no FK): removes the whole problem — and removes referential integrity, cascade deletes, and any place to hang user-scoped data. The FK is worth the mirror.
- **Mirror-only-at-register** (drop the session-create call): simpler, but breaks the instant Google OAuth or dashboard-created users appear. The defensive second call is cheap insurance (idempotent, one indexed lookup).
- **Same-id vs surrogate-id + lookup table:** a surrogate PK plus an `auth_id` column would also work and decouple the two id spaces — at the cost of a join/lookup on every request to translate `sub`→our id. Same-id erases that translation entirely. The UUID choice made it free.

## 10. Common mistakes

- Inserting the mirror with a fresh `uuid4()` — now `public.users.id ≠ sub`, and the FK fails anyway. The *same id* is the entire trick.
- Mirroring only at register and being surprised when OAuth users hit FK errors on their first session.
- Treating `public.users` as the identity authority and writing profile edits there — they belong in Supabase (`user_metadata`); the mirror is downstream.
- Making `get_or_create_user` non-idempotent (e.g. unconditional insert) — the second call (session create) then explodes on the unique/PK constraint.
- Reading the stale mirror name as a bug without checking whether anything actually *reads* it for display (it doesn't).

## 11. Production considerations

The mirror is a small **eventual-consistency** system between two stores, and its correctness rests entirely on idempotency + same-id. Two things to watch at scale: a race where two concurrent first-writes both pass the existence check and both insert (the PK constraint turns the loser into an error — is it caught? trace it) — a `get_or_create` with `ON CONFLICT DO NOTHING` is the robust form; and the fact that a *failed* mirror at register but *succeeded* auth user leaves a user who can authenticate but whose first write self-heals via the session-create mirror — which is exactly why the second call exists. This is a clean example of **defense in depth applied to data integrity, not just security.**

## 12. Exercises

1. **(Reproduce the FK error)** Temporarily comment out the `get_or_create_user` call in `create_session`, register a brand-new user, and `POST /sessions`. Capture the exact Postgres/SQLAlchemy error. Restore. (You've now *seen* the failure the comment describes.)
2. **(Same-id proof)** After a normal register+session, query both: the token's `sub` (3.1 ex.1) and `SELECT id FROM users WHERE email=…`. Confirm they're byte-identical. Explain why a `uuid4()` mirror would have broken the session insert.
3. **(Two-places reasoning)** Write the four distinct paths (from §8) by which a valid token can reach `POST /sessions` without our `/auth/register` running. For each, say what the session-create mirror does.
4. **(Staleness audit)** Change your Supabase `user_metadata.name` (dashboard or API), then check: does the app's displayed name update? Does `public.users.name`? Explain the split, citing which source each reader trusts.

## 13. Assignment

Folded into the checkpoint (Part C q7 tests this directly). Optional stretch: rewrite `get_or_create_user` as an idempotent upsert using Postgres `ON CONFLICT (id) DO NOTHING` and argue whether it's worth it here (consider the race in §11).

## 14. Quiz

1. Why does `public.users` exist at all if Supabase already stores users?
2. What one property must the mirror row share with the Supabase auth user, and which PK design makes it possible?
3. Name two reasons the mirror must also run at session-create, not only register.
4. Why does `get_or_create_user` check by id while `create_user` checks by email?
5. A user renames themselves in Supabase. Which displayed name changes, and which stored value goes stale — and does anything read the stale one?
6. What Postgres error does the mirror prevent, verbatim in spirit?

## 15. Best practices & further reading

- Pattern name to know: this is a *local user projection / shadow table* over an external IdP — extremely common with Auth0/Cognito/Supabase.
- Supabase docs: *Managing user data*, *Auth Hooks / Webhooks* (the sync alternative you weighed).
- PostgreSQL docs: *INSERT … ON CONFLICT* (the robust idempotent-insert form).

## 16. Completion checklist

- [ ] I reproduced the FK error and restored the fix.
- [ ] I proved `sub` and `public.users.id` are the same UUID and can explain why that's required.
- [ ] I can list the paths that make the second mirror call necessary.
- [ ] I know which store is authoritative for display vs FK integrity.
- [ ] Quiz clean.
