from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

import db_call
from schemas.auth import RegisterRequest, LoginRequest, AuthResponse
from services import auth_service
from database import get_db

try:
    from supabase_auth.errors import AuthApiError
except ImportError:  # older client layouts
    from gotrue.errors import AuthApiError

router = APIRouter(prefix="/auth", tags=["auth"])

# Logout needs the raw bearer token to revoke, not the decoded payload —
# so we read the credentials directly instead of via get_current_user.
_bearer = HTTPBearer()


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    try:
        response = auth_service.register_user(request.email, request.password, request.name)
    except AuthApiError as e:
        # e.g. invalid email, weak password, user already registered
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not response.user:
        raise HTTPException(status_code=400, detail="Registration failed")

    # Mirror the Supabase auth user into our users table (same UUID) so the
    # sessions FK constraint is satisfied.
    db_call.get_or_create_user(db, response.user.id, request.name, request.email)

    # With email confirmation disabled, Supabase returns a session right away —
    # hand the token back so the client can use it immediately. Otherwise the
    # user still needs to confirm via email first.
    if response.session:
        return AuthResponse(
            access_token=response.session.access_token,
            user_id=str(response.user.id),
        )
    return {"message": "Check your email to confirm your account", "user_id": str(response.user.id)}


@router.post("/login", response_model=AuthResponse)
def login(request: LoginRequest):
    try:
        response = auth_service.login_user(request.email, request.password)
    except AuthApiError as e:
        # e.g. wrong password, email not confirmed
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    if not response.session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return AuthResponse(
        access_token=response.session.access_token,
        user_id=str(response.user.id),
    )


@router.get("/google")
def google_login(redirect_to: str):
    """Returns the Supabase OAuth URL. Frontend opens it to begin Google login."""
    url = auth_service.get_google_oauth_url(redirect_to)
    return {"url": url}


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(credentials: HTTPAuthorizationCredentials = Depends(_bearer)):
    """Revoke the caller's Supabase session. Idempotent from the client's view:
    the frontend discards its token regardless, so an already-invalid token
    still reports success."""
    try:
        auth_service.logout_user(credentials.credentials)
    except AuthApiError:
        # Token already expired/revoked — nothing left to do, treat as logged out.
        pass
    return {"message": "Logged out"}
