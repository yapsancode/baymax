import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from supabase import create_client, Client

from config import settings
from database import get_db
import db_call

_security = HTTPBearer()
_jwks_client: PyJWKClient | None = None


def _client() -> Client:
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SECRET_KEY,
    )


# --- Supabase auth calls ---
def register_user(email: str, password: str, name: str):
    return _client().auth.sign_up({
        "email": email,
        "password": password,
        "options": {"data": {"name": name}},
    })


def login_user(email: str, password: str):
    return _client().auth.sign_in_with_password({
        "email": email,
        "password": password,
    })


def get_google_oauth_url(redirect_to: str) -> str:
    response = _client().auth.sign_in_with_oauth({
        "provider": "google",
        "options": {"redirect_to": redirect_to},
    })
    return response.url


def logout_user(token: str) -> None:
    """Revoke the user's Supabase session. Uses the admin API (service key) to
    sign out the session tied to this access token. Access tokens stay valid
    until they expire (~1h) since they're stateless JWTs — this revokes the
    refresh token so the session can't be renewed."""
    _client().auth.admin.sign_out(token)


# --- JWT verification (RS256 via Supabase JWKS) ---
def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        url = settings.SUPABASE_JWKS_URL or f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(url, cache_keys=True)
    return _jwks_client


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(_security),
) -> dict:
    token = credentials.credentials
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            # Supabase asymmetric signing keys may be ES256 (EC) or RS256 (RSA).
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
        if not payload.get("sub"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        # Expose the verified user id for per-user rate limiting (rate_limit.py).
        request.state.user_id = payload["sub"]
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def require_admin(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Gate for admin-only endpoints (e.g. GET /feedback). Layered on top of
    get_current_user: the JWT proves who the caller is, this checks their
    `role` in our own users table (Supabase auth claims don't carry it)."""
    if not db_call.is_admin(db, current_user["sub"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
