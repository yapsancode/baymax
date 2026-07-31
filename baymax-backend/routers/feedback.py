"""Guide feedback routes: POST /feedback (step thumbs-down), POST
/feedback/completion (implicit success for a finished guide), and the
admin-only GET /feedback listing.

Thin HTTP layer — all DB work lives in db_call.py. Session ownership is
verified the same way routers/steps.py does, by reusing db_call.get_session.
"""

from datetime import datetime
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

import db_call
from config import settings
from database import get_db
from rate_limit import limiter
from schemas.feedback import (
    CompletionFeedbackRequest,
    CompletionFeedbackResponse,
    FeedbackCreate,
    FeedbackListResponse,
    FeedbackResponse,
)
from services.auth_service import get_current_user, require_admin

log = logging.getLogger(__name__)

router = APIRouter(prefix="/feedback", tags=["feedback"])

VALID_STATUSES = {"success", "fail"}


@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(lambda: settings.FEEDBACK_RATE_LIMIT)
def submit_feedback(
    request: Request,
    body: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Record a single step's outcome — the thumbs-down control sends
    status="fail". user_id always comes from the token, never the body."""
    user_id = current_user["sub"]

    if body.session_id is not None:
        owned = db_call.get_session(db, str(body.session_id), user_id)
        if not owned:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    feedback = db_call.upsert_step_feedback(
        db,
        user_id=user_id,
        session_id=str(body.session_id) if body.session_id else None,
        guide_id=body.guide_id,
        guide_title=body.guide_title,
        step_index=body.step_index,
        step_title=body.step_title,
        status=body.status,
    )
    return feedback


@router.post("/completion", response_model=CompletionFeedbackResponse)
@limiter.limit(lambda: settings.FEEDBACK_RATE_LIMIT)
def report_completion(
    request: Request,
    body: CompletionFeedbackRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Report every step that finished the guide. Only steps without an
    existing feedback row for this session/guide get a success row — a
    thumbs-downed step is never overwritten, and retries never duplicate."""
    user_id = current_user["sub"]

    owned = db_call.get_session(db, str(body.session_id), user_id)
    if not owned:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    inserted = db_call.insert_success_feedback(
        db,
        user_id=user_id,
        session_id=str(body.session_id),
        guide_id=body.guide_id,
        guide_title=body.guide_title,
        steps=[s.model_dump() for s in body.steps],
    )
    return CompletionFeedbackResponse(inserted=inserted)


@router.get("", response_model=FeedbackListResponse)
def list_feedback_admin(
    status_filter: str | None = Query(default=None, alias="status"),
    guide_id: str | None = Query(default=None),
    guide_title: str | None = Query(default=None),
    step_index: int | None = Query(default=None),
    date_from: datetime | None = Query(default=None, alias="from"),
    date_to: datetime | None = Query(default=None, alias="to"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """Admin-only feedback listing, filterable by status/guide/date range."""
    if status_filter is not None and status_filter not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}",
        )

    items, total = db_call.list_feedback(
        db,
        status=status_filter,
        guide_id=guide_id,
        guide_title=guide_title,
        step_index=step_index,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    return FeedbackListResponse(items=items, total=total, page=page, page_size=page_size)


@router.delete("/{feedback_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_feedback_admin(
    feedback_id: UUID,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """Admin-only delete of a single feedback row."""
    deleted = db_call.admin_delete_feedback(db, str(feedback_id))
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")
