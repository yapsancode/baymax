from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import db_call
from schemas.session import SessionCreate, SessionResponse, SessionStatusUpdate
from database import get_db
from services.auth_service import get_current_user

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _owned_session_or_404(session_id: UUID, db: Session, user_id: str):
    """HTTP concern: turn a missing/none-owned session into a 404. The actual
    DB lookup lives in db_call."""
    session = db_call.get_session(db, str(session_id), user_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


@router.post("", status_code=status.HTTP_201_CREATED, response_model=SessionResponse)
def create_session(
    body: SessionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    # FK FIX: current_user["sub"] is the user's Supabase auth id, which lives in
    # Supabase's auth.users — NOT our public.users table. sessions.user_id is a
    # foreign key into public.users, so we must mirror the auth user in first, or
    # the insert fails with "Key (user_id)=... is not present in table users".
    # get_or_create_user is idempotent (no-op after the first session per user).
    meta = current_user.get("user_metadata") or {}
    email = current_user.get("email") or ""
    name = meta.get("name") or meta.get("full_name") or email or "User"
    db_call.get_or_create_user(db, current_user["sub"], name, email)
    return db_call.create_session(db, current_user["sub"], body.title)


@router.get("", response_model=list[SessionResponse])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return db_call.get_sessions_by_user(db, current_user["sub"])


@router.patch("/{session_id}", response_model=SessionResponse)
def update_session(
    session_id: UUID,
    body: SessionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if body.status is not None:
        VALID_STATUSES = {"in_progress", "completed", "abandoned"}
        if body.status not in VALID_STATUSES:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}"
            )
    updated = db_call.update_session(
        db, str(session_id), current_user["sub"],
        status=body.status,
        current_step_index=body.current_step_index,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return updated


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return _owned_session_or_404(session_id, db, current_user["sub"])

@router.delete("/{session_id}", response_model=SessionResponse)
def delete_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    session = _owned_session_or_404(session_id, db, current_user["sub"])
    db.delete(session)
    db.commit()
    return session

