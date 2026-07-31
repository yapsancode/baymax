# Lesson 3.1 — Sessions, Tokens, and the Hybrid Topology

## 1. Learning objectives

- Explain cookie-sessions vs token auth, and why stateless tokens fit *this* client (an extension) and *this* server (Cloud Run).
- Draw Baymax's real auth topology — including the fact that **login never touches the backend** — and defend it.
- Read a JWT: header/payload/signature, the claims this system relies on (`sub`, `aud`, `exp`, `email`, `user_metadata`).
- Trace all four auth flows in the code: register, login, authenticated request, logout — and name which of the backend's four auth routes the frontend actually uses today.

## 2. Prerequisites

Module 2 (DI — you know `get_current_user` is a dependency; today: what's inside the token it verifies). Knowledge graph: *JWT & asymmetric crypto* → HTTP headers, client–server.

## 3. Estimated duration

~2.5 hours.

## 4. Mastery levels covered

Levels 2–4.

## 5. The problem

The server must know *who is calling* on every request, over a protocol (HTTP) that has no memory. The classic answer — a server-side session store plus a cookie — assumes things Baymax doesn't have: a single origin (the extension calls from `chrome-extension://…`, where third-party-cookie rules are hostile), and a server that keeps state between requests (Cloud Run instances appear and vanish; an in-memory session store dies with each one). Tokens invert the model: the client *carries* its identity proof, and any server that can verify the signature can authenticate the request — no shared store, no cookie, no sticky instance.

## 6. Theory

**A JWT is three base64url segments:** `header.payload.signature`. The header names the algorithm and key id (`alg`, `kid`); the payload is *readable by anyone* (it's encoding, not encryption — never put secrets in it); the signature is what makes it trustworthy. Verification = "was this signed by a key I trust, and do the claims fit?" The claims Baymax's verifier checks or uses:

- `sub` — the Supabase user id. Becomes `current_user["sub"]`, the `user_id` in every owner-scoped query. The single most load-bearing string in the system.
- `aud: "authenticated"` — the audience; `jwt.decode(..., audience="authenticated")` rejects tokens minted for anything else.
- `exp` — expiry (~1 h for Supabase access tokens); PyJWT enforces it automatically.
- `email`, `user_metadata.name` — profile data the sessions router uses to mirror the user (Lesson 3.3).

**Access token + refresh token, different lifetimes, different guardianship:** the short-lived access token is *shown around* (every API call); the long-lived refresh token is *hoarded* by supabase-js in the panel's localStorage and spent only to mint new access tokens. This split bounds the damage of a leaked access token to ~1 hour — and it's why logout semantics are subtle (§8).

**The hybrid topology** — draw it before reading on: who talks to whom during login?

```
            register: POST /auth/register ────────────► BACKEND ──(service key)──► SUPABASE
            (must mirror the user row — 3.3)                                          ▲
SIDE PANEL                                                                            │
(supabase-js) ── login: signInWithPassword ──────────────────────────────────────────┘
              ── refresh: automatic, client-side ────────────────────────────────────┘
              ── API calls: Bearer <access token> ─────► BACKEND ──(JWKS verify, no Supabase call)
              ── logout: supabase.auth.signOut() ────────────────────────────────────┘
```

The backend is **not in the login loop**. It never sees the password; it holds no session; it verifies signatures against Supabase's public keys (3.2). Identity provider and API are decoupled — the pattern behind "Sign in with Google/Auth0/Okta" everywhere, here in miniature.

## 7. Project mapping

| Flow | Frontend | Backend |
|---|---|---|
| Register | `pages/Register/index.jsx` → `api.register` → then `signInWithPassword` client-side | `routers/auth.py` `register` → `services/auth_service.register_user` + `db_call.get_or_create_user` |
| Login | `pages/Login/index.jsx` → `supabase.auth.signInWithPassword` — **backend not involved** | (`POST /auth/login` exists — see §8) |
| Session persistence & entry | `components/EntryGate.jsx` (`getSession` + `onAuthStateChange`) | — |
| Authenticated request | `lib/api.js` `authHeader()` | `services/auth_service.get_current_user` |
| Logout | `lib/api.js` `logout` → `supabase.auth.signOut()` | (`POST /auth/logout` exists — see §8) |
| Google OAuth | `Login`'s `handleGoogle` — **a stub** | (`GET /auth/google` exists, unused) |

## 8. Code walkthrough

**Register** (`Register/index.jsx` + `routers/auth.py`): the one flow that *must* be server-side — only the backend (with the service key) can create the auth user *and* mirror it into `public.users` in the same operation. Then notice the odd-looking move: the backend *returns* an `access_token`, and the frontend **ignores it** and calls `signInWithPassword` again. Why? supabase-js needs a full session object (access + refresh token) in *its own* storage to do persistence and auto-refresh; a bare access token handed over out-of-band would leave EntryGate blind and refresh broken. The double sign-in is the cost of keeping supabase-js the single owner of session state — a good trade, worth one comment (which the page's header comment indeed provides).

**Login** (`Login/index.jsx`): `signInWithPassword` straight to Supabase. On success the page does… nothing — no navigation call. Read the comment: EntryGate's `onAuthStateChange` fires with the new session and advances the stage. State change *is* the navigation. Meanwhile `POST /auth/login` sits unused by this frontend — dead-code-in-waiting or a deliberate second front door (curl users, future clients, tests)? Form your verdict; the checkpoint asks.

**The stub** (`handleGoogle`): calls `onLogin()` — UI advances, **no session exists**. Every subsequent API call goes out without an `Authorization` header and dies. Trace precisely what the user sees (which component catches the failure? what renders?). This is a *known temporary lie* in the product, and it's instructive: the UI's idea of "logged in" and the system's idea (a verifiable token) are different facts. EntryGate treats the session as truth; the stub bypasses EntryGate's truth. When the real OAuth lands (`signInWithOAuth` + PKCE — note `lib/supabase.js`'s comment says the client is already configured for it), the stub's removal is one line.

**Logout** (`api.js` → `supabase.auth.signOut()`): client-side sign-out revokes the session with Supabase *and* clears local storage; EntryGate hears `SIGNED_OUT` and returns to Login. Now read the backend's unused `POST /auth/logout` and its honest docstring: revoking kills the **refresh token**, but *"access tokens stay valid until they expire (~1h) since they're stateless JWTs."* Sit with that: **stateless verification means no server-side kill switch.** A stolen access token survives logout for up to an hour. Mitigations (short expiry — already in place; a denylist — reintroduces the state you removed; key rotation — nukes everyone) are all trade-offs, not fixes. This is the fundamental bargain of stateless auth, stated by the code itself.

## 9. Trade-offs & alternative implementations

- **Stateless JWT vs server-side sessions:** JWT buys horizontal scale and origin-independence; costs revocation latency (above) and larger requests. For an extension + Cloud Run, the wins are structural. A banking app would choose differently.
- **Hybrid (client↔Supabase) vs full proxy (all auth through the backend):** the proxy variant gives one audit point and lets you hide Supabase entirely, but re-implements session refresh, doubles latency on login, and the backend must now handle credentials. The hybrid leans on a hardened, purpose-built client library. The *risk* of the hybrid: two half-used paths (unused login/logout routes) that can drift — you're watching mild drift in real time.
- **Returning the register token vs always re-signing-in:** discussed in §8 — session-ownership consistency beat cleverness.

## 10. Common mistakes

- "The payload is signed, so it's private" — it's public. Decode any real token at jwt.io and see everything.
- Treating UI state as auth state (the Google stub is the cautionary tale — and so is any `if (loggedIn)` React state that isn't derived from the session).
- Fetching immediately on mount instead of waiting for the session to settle — the checkpoint's incident; `Tasks/index.jsx` shows the defensive pattern.
- Storing tokens "somewhere safer than localStorage" ad hoc — in an extension, localStorage of the panel origin is the standard supabase-js choice; inventing your own storage usually *lowers* the bar.
- Assuming logout invalidates outstanding access tokens.

## 11. Production considerations

Token lifetime is a dial: shorter = faster revocation, more refresh traffic; Supabase's ~1 h default is a sane middle. The unused auth routes deserve a decision before production (delete, or document as supported API surface — unused ≠ unmaintained ≠ safe). And the stub must die before any real user touches the build; a UI that *looks* signed-in with no session is a support-ticket machine. Finally: everything here presumes HTTPS everywhere — a bearer token over plaintext is game over, which is why "bearer" is the word (whoever *bears* it, is you).

## 12. Exercises

1. **(Read a real token)** Log in, grab the access token from the panel (`await supabase.auth.getSession()` in the panel console), paste into jwt.io. Identify `alg`, `kid`, `sub`, `aud`, `exp`, `user_metadata`. Compute how many minutes it has left.
2. **(Topology proof)** With the Network tab open: log out, log in. Confirm zero requests hit `127.0.0.1:8000` during login, and identify which Supabase endpoints were called instead.
3. **(The stub, observed)** Click "Continue with Google," then tap a quick-start chip. Record the exact failure surface (status code? UI message? console error?). Write the two-line bug report you'd file.
4. **(Attacker's hat)** Your access token leaks (assume pastebin). Enumerate what the attacker can do, for how long, and what you (as the user) can and cannot do about it. Cite §8's logout paragraph.

## 13. Assignment

Folded into the module checkpoint (the incident analysis uses everything here). Optional stretch: implement the real `signInWithOAuth` Google flow behind a `VITE_` feature flag and document what Supabase-side config it still needs.

## 14. Quiz

1. Why do cookies fit this client badly? Two reasons.
2. Which of the four `/auth/*` routes does the shipped frontend call today?
3. Why does Register sign in twice, in effect?
4. What survives logout, and why can't the server help?
5. Which claim becomes the `user_id` in every owner-scoped query?
6. How does EntryGate learn that login succeeded, given that Login's submit handler doesn't navigate?

## 15. Best practices & further reading

- jwt.io (decoder + spec links); RFC 7519 §4 (registered claims — skim `aud`, `exp`, `sub`).
- Supabase docs: *Auth architecture*, *Sessions* (access/refresh mechanics you just traced).
- OWASP Cheat Sheet: *JWT Security* — read the revocation section and notice it recommends exactly the trade-offs §8 named.

## 16. Completion checklist

- [ ] I drew the topology from memory, including what *doesn't* touch the backend.
- [ ] I decoded a real token and named every claim the backend checks.
- [ ] I observed the stub's failure surface firsthand.
- [ ] I can state the stateless-revocation bargain in one sentence.
- [ ] Quiz clean.
