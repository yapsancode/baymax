"""Rate limiting (slowapi) — infrastructure, like database.py / config.py.

The limiter keys per authenticated user: services/auth_service.get_current_user
stashes the Supabase user id on request.state.user_id, and _user_key reads it.
Unauthenticated requests fall back to the client IP (they're already blocked by
the auth dependency on /chat, so this is just a safe default).

Storage is in-memory: counts are per-process and reset on restart. Fine for a
single Cloud Run instance / demo. For multi-instance production, point slowapi
at a shared store (e.g. Redis via `storage_uri`).
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address


def _user_key(request: Request) -> str:
    # user_id is set by get_current_user once the JWT is verified.
    return getattr(request.state, "user_id", None) or get_remote_address(request)


limiter = Limiter(key_func=_user_key)


def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Friendly 429. Uses `detail` so the frontend's error extractor picks it up."""
    return JSONResponse(
        status_code=429,
        content={"detail": "You're sending messages too fast. Please wait a moment and try again."},
        headers={"Retry-After": "5"},
    )
