from pydantic import BaseModel
from typing import Literal, Optional
from uuid import UUID
from datetime import datetime


class FeedbackCreate(BaseModel):
    """POST /feedback body — a single step's outcome (thumbs-down sends "fail")."""
    session_id: Optional[UUID] = None
    guide_id: str
    guide_title: str
    step_index: int
    step_title: str
    status: Literal["success", "fail"]


class FeedbackStepInput(BaseModel):
    """One completed step inside a completion-report request."""
    step_index: int
    step_title: str


class CompletionFeedbackRequest(BaseModel):
    """POST /feedback/completion body — reports every step that finished the
    guide without a thumbs-down; the backend only inserts success rows for
    steps that don't already have a feedback row for this session."""
    session_id: UUID
    guide_id: str
    guide_title: str
    steps: list[FeedbackStepInput]


class CompletionFeedbackResponse(BaseModel):
    inserted: int


class FeedbackResponse(BaseModel):
    id: UUID
    user_id: UUID
    session_id: Optional[UUID] = None
    guide_id: str
    guide_title: str
    step_index: int
    step_title: str
    status: str
    created_at: datetime
    # Populated via a join for the admin table's "User" column — not a column
    # on Feedback itself.
    user_email: Optional[str] = None

    model_config = {"from_attributes": True}


class FeedbackListResponse(BaseModel):
    items: list[FeedbackResponse]
    total: int
    page: int
    page_size: int
