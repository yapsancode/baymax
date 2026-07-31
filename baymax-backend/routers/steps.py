from typing import Optional, List
from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from data.seed_guides import CLOUD_SQL_POSTGRES_GUIDE
from schemas.step import StepCreate, StepResponse, StepStatusUpdate
from services.auth_service import get_current_user
import db_call

router = APIRouter(prefix="/sessions/{session_id}/steps", tags=["steps"])


# ── POST /sessions/{session_id}/steps ────────────────────────────────────────
# Bulk-creates steps for a session.
# If a request body with steps is provided, those are used (dynamic/AI guide).
# If no body is provided, falls back to the hardcoded CLOUD_SQL_POSTGRES_GUIDE.
@router.post("", response_model=list[StepResponse], status_code=status.HTTP_201_CREATED)
def create_steps(
    session_id: str,
    steps_body: Optional[List[StepCreate]] = Body(default=None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]

    # Confirm the session exists and belongs to this user
    session = db_call.get_session(db, session_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Avoid duplicate seeding if steps already exist for this session
    existing = db_call.get_steps_by_session(db, session_id, user_id)
    if existing:
        raise HTTPException(status_code=409, detail="Steps already created for this session")

    # Use provided steps or fall back to hardcoded guide
    if steps_body:
        raw_steps = [s.model_dump() for s in steps_body]
    else:
        raw_steps = CLOUD_SQL_POSTGRES_GUIDE["steps"]

    created_steps = []
    for raw_step in raw_steps:
        step = db_call.save_ai_step(
            db=db,
            session_id=session_id,
            step_number=raw_step.get("step_number"),
            title=raw_step.get("title"),
            description=raw_step.get("description"),
            action=raw_step.get("action", "highlight"),
            selector=raw_step.get("selector"),
            url=raw_step.get("url"),
            url_pattern=raw_step.get("url_pattern") or raw_step.get("urlPattern"),
            advance_on_url_pattern=raw_step.get("advance_on_url_pattern") or raw_step.get("advanceOnUrlPattern"),
            value=raw_step.get("value"),
            status="pending",
        )
        created_steps.append(step)

    return created_steps


# ── GET /sessions/{session_id}/steps ─────────────────────────────────────────
@router.get("", response_model=list[StepResponse])
def get_steps(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]

    steps = db_call.get_steps_by_session(db, session_id, user_id)
    if steps is None:           # None = session not found / not owned; [] = found but empty
        raise HTTPException(status_code=404, detail="Session not found")

    return steps


# ── PATCH /sessions/{session_id}/steps/{step_id} ─────────────────────────────
@router.patch("/{step_id}", response_model=StepResponse)
def update_step_status(
    session_id: str,
    step_id: str,
    body: StepStatusUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]

    VALID_STATUSES = {"pending", "in_progress", "completed", "skipped", "failed"}
    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}"
        )

    updated = db_call.update_step_status(db, session_id, step_id, body.status, user_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Step not found")

    return updated