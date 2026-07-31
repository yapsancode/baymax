# Lesson 3.2 — Verifying Without a Shared Secret: JWKS

## 1. Learning objectives

- Explain symmetric (HS256) vs asymmetric (ES256/RS256) JWT signing, and why asymmetric fits a decoupled identity provider.
- Explain what JWKS is, how `PyJWKClient` uses `kid` to fetch the right public key, and why this survives key rotation.
- Read `get_current_user` line by line and name what each step defends against.
- Explain why accepting `["ES256", "RS256"]` (two algorithms) is robustness, not sloppiness — and why an `alg: none` or algorithm-confusion attack fails here.

## 2. Prerequisites

Lesson 3.1 (you can read a JWT and know its claims). Knowledge graph: *JWT & asymmetric crypto* (the crypto half).

## 3. Estimated duration

~2.5 hours.

## 4. Mastery levels covered

Levels 3–6.

## 5. The problem

The backend must answer "did Supabase sign this token?" without being Supabase. With a **shared secret** (HS256), the same key both signs and verifies — so the API would need a copy of Supabase's signing secret. That's a liability: every service holding it can *mint* tokens, and leaking it from any one of them forges identities everywhere. Baymax needs to *verify* without being able to *sign*. That is exactly what asymmetric cryptography provides — and Supabase has deprecated the legacy HS256 secret precisely to push everyone here.

## 6. Theory

**Symmetric:** one secret, sign = verify. Simple; but verification requires signing power. Bad fit when the verifier isn't the issuer.

**Asymmetric:** a keypair. The **private** key signs (Supabase keeps it, alone); the **public** key verifies (anyone may hold it — it can't forge anything). Baymax verifies with a public key it downloads. A leak of the public key is a non-event. This project's keys are **ES256** (elliptic-curve) — shorter keys, same security as much larger RSA (RS256).

**JWKS — JSON Web Key Set:** the issuer publishes its *public* keys at a well-known URL (`SUPABASE_JWKS_URL`, e.g. `https://<id>.supabase.co/auth/v1/.well-known/jwks.json`) as a list, each tagged with a `kid`. A token's header carries the `kid` of the key that signed it. Verification: read `kid` from the header → fetch the matching public key from JWKS (cached) → verify the signature. 

**Why this survives rotation:** when Supabase rotates keys, it publishes the new public key at the same JWKS URL with a new `kid`, and issues new tokens under it — while *old* tokens still name the *old* `kid`, still present in the set during the overlap. The verifier just follows `kid` each time. No coordinated secret redeploy, ever. This is the entire operational payoff, and it's why `get_current_user` doesn't hardcode a key.

**Why two algorithms are allowed:** `algorithms=["ES256", "RS256"]`. The token header states its `alg`; PyJWT will only accept a token whose `alg` is in this allowlist *and* whose signature verifies under the fetched key. Listing both means "I'll accept either curve/RSA family" — robustness across a provider that might rotate key *types*. Crucially, the allowlist is also the defense against the classic attacks: `alg: none` (unsigned) is rejected because `none` isn't listed; the HS256/RS256 *confusion* attack (feed the public key as an HMAC secret) fails because HS256 isn't listed. **The allowlist is a security control, not a convenience.**

## 7. Project mapping

- The verifier: `services/auth_service.py` — `_get_jwks_client`, `get_current_user`.
- The keys' source: `SUPABASE_JWKS_URL` in `config.py` (with a derived fallback from `SUPABASE_URL`).
- The rule stated: [CLAUDE.md](../../../CLAUDE.md) → "Key Rules for This Backend" #2.
- The consumer of the result: every router's `Depends(get_current_user)`; the `sub` it returns → every `db_call` owner check (Module 2).

## 8. Code walkthrough

Read `get_current_user` and `_get_jwks_client` together (they're short). Annotate each move with the threat it answers:

```python
signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
```
Reads the header's `kid`, fetches (or returns cached) the matching **public** key. `cache_keys=True` means the JWKS endpoint isn't hit per request — a hot-path and availability win (§11). *Defends:* nothing yet — this just locates the key.

```python
payload = jwt.decode(
    token, signing_key.key,
    algorithms=["ES256", "RS256"],   # ← the allowlist: rejects alg:none & confusion
    audience="authenticated",        # ← rejects tokens minted for another audience
)
```
*Defends:* forgery (signature must verify under Supabase's public key), algorithm attacks (allowlist), token-confusion/replay across audiences (`aud`). PyJWT *also* checks `exp` here automatically — expired tokens raise before your code sees them.

```python
if not payload.get("sub"):
    raise HTTPException(401, "Invalid token")
request.state.user_id = payload["sub"]   # ← smuggled to the rate limiter (3.5, 2.5)
return payload
```
*Defends:* a signature-valid but subject-less token (shouldn't happen from Supabase, but never trust structure you didn't assert). The `request.state` write is the per-user rate-limit key seam you met in 2.5.

```python
except jwt.InvalidTokenError:
    raise HTTPException(401, "Invalid or expired token")
```
One catch for the whole PyJWT error family (bad signature, expired, wrong audience, malformed) → one uniform 401. *Defends:* information leakage — the caller learns "no," not *why* ("expired" vs "bad signature" vs "wrong audience" would help an attacker tune their forgery).

> **Attacker's hat (do before reading on):** you have a *valid* token for audience `"authenticated"` and you want to hit an admin API elsewhere that expects audience `"admin"`. Does replay work? (No — `aud` mismatch → `InvalidTokenError` → 401.) Now: you strip the signature and set `alg: none`. (Rejected — not in the allowlist.) Now: you take Supabase's public key from the open JWKS URL and sign an HS256 token with it, hoping the server verifies HS256 using that same public key as the secret. (Rejected — HS256 not in the allowlist; this is *the* reason the allowlist must never include a symmetric alg alongside asymmetric keys.)

One honest wrinkle to notice: the module docstring/comment says "RS256 via Supabase JWKS," but the code accepts ES256 too and CLAUDE.md notes the signing key *is* ES256. A stale comment on a security-critical function — exactly the kind of drift worth a PR (and a reminder that comments are not verification).

## 9. Trade-offs & alternative implementations

- **JWKS fetch caching:** `cache_keys=True` trades freshness for speed/availability. Risk: if Supabase rotates and *retires* an old `kid` faster than a long-lived cache expires, verification of new tokens could miss the new key until cache refresh. PyJWKClient handles unknown-`kid` by re-fetching, so this is largely self-healing; know the mechanism rather than assume magic.
- **Verify-in-app vs an API gateway:** a gateway (or Supabase's own edge) could verify before requests reach FastAPI. Centralizes auth, offloads the app — but adds infra and a second config surface. For a single Cloud Run service, in-app verification via a 20-line dependency is the right size.
- **One JWKS client (module global) vs per-request:** the global with internal caching is correct; a per-request client would re-fetch keys constantly. Note it's lazily initialized (`_jwks_client is None`) — first request pays, the rest are warm.
- **Allowlist breadth:** listing only `ES256` would be tighter (this project's actual key type) but brittle if Supabase ever issues RS256; listing both is a deliberate robustness/attack-surface balance. Listing *many* would be sloppy. Two, chosen, is the sweet spot.

## 10. Common mistakes

- Putting a symmetric alg (HS256) in the same allowlist as asymmetric keys — opens the confusion attack. Never mix.
- Decoding without `algorithms=` (older PyJWT would infer from the header — attacker-controlled). Always pin.
- Skipping `audience=` — accepts tokens minted for other audiences of the same issuer.
- Hardcoding a public key instead of using JWKS — works until the first rotation, then every token 401s at once (a memorable outage).
- Leaking *why* verification failed — helpful to users, a gift to attackers; the uniform 401 is deliberate.
- Trusting the comment: this file's says RS256; the behavior (and reality) is ES256+RS256.

## 11. Production considerations

The JWKS endpoint is now an **availability dependency** of your auth: if it's unreachable when a cold instance needs a key it hasn't cached, verification fails. Caching (`cache_keys=True`) and Cloud Run keeping instances warm both mitigate; a hardened setup adds a short negative-cache/retry and monitors JWKS latency. Key rotation should be a *non-event* by design — but test it: the failure mode "all users 401 simultaneously" almost always traces to a hardcoded/over-cached key. And keep the algorithm allowlist in review scope forever; it's four characters that hold up the whole trust model.

## 12. Exercises

1. **(See the JWKS)** Open `SUPABASE_JWKS_URL` in a browser. Note the `kid`(s) and `kty`/`alg`. Then decode your token (3.1 ex.1) and confirm its header `kid` matches one in the set.
2. **(Break verification)** In a scratch call to `get_current_user`'s logic (or via `/docs` with a hand-tampered token): flip one character in the signature segment and confirm 401. Change the payload's `sub` and re-base64 it (without re-signing) and confirm 401. Explain why both fail at the *same* line.
3. **(Attacker's hat, written)** Write up the three attacks from §8 (`aud` replay, `alg:none`, HS256 confusion) as a mini threat-model table: attack → why it fails → which line/config stops it.
4. **(Drift PR)** Write the one-line docstring/comment fix for the RS256/ES256 staleness, and the commit message explaining why a wrong comment on an auth function is worth a PR.

## 13. Assignment

Folded into the checkpoint's Part B/C (threat model). Optional stretch: add a structured `logger.warning` on verification failure that records the *reason* server-side (safe — it's not in the response) while the client still gets a uniform 401. Note where in `get_current_user` it goes and why logging-server-side-but-not-client-side is the right split (foreshadows Module 9.4).

## 14. Quiz

1. Why can't an attacker forge a token even with the public key in hand?
2. What does `kid` do, and how does it make key rotation seamless?
3. Name three distinct attacks the `algorithms=["ES256","RS256"]` allowlist defeats.
4. Why is the 401 message identical for expired, malformed, and badly-signed tokens?
5. What does `cache_keys=True` trade, and how is the stale-key risk self-healed?
6. Which claim does PyJWT check automatically that isn't written in our code?

## 15. Best practices & further reading

- Auth0: *Navigating RS256 and JWKS* (the canonical explainer); *Critical vulnerabilities in JWT libraries* (the `alg` confusion history you just defended against).
- RFC 7517 (JWK/JWKS), RFC 7515 §4.1.1 (`alg` header) — skim.
- PyJWT docs: *Retrieve RSA/EC signing keys from a JWKS endpoint*, *Algorithms*.
- Supabase docs: *Signing keys* / JWT — note the HS256-deprecation guidance this repo is following.

## 16. Completion checklist

- [ ] I can explain sign-vs-verify asymmetry and why the API only needs to verify.
- [ ] I matched a real token's `kid` to the live JWKS set.
- [ ] I broke a token two ways and know why both fail at verification.
- [ ] My threat-model table (3 attacks) is written.
- [ ] I can state why the allowlist is a security control, not a convenience.
