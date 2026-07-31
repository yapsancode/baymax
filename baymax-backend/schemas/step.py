from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class StepCreate(BaseModel):
    """Used internally — not exposed directly since steps are bulk-created from a guide."""
    step_number: int
    title: Optional[str] = None
    description: Optional[str] = None
    action: str
    selector: Optional[str] = None
    url: Optional[str] = None
    url_pattern: Optional[str] = None
    advance_on_url_pattern: Optional[str] = None
    value: Optional[str] = None


class StepStatusUpdate(BaseModel):
    """PATCH body — only status is mutable by the client."""
    status: str  # e.g. "pending", "completed", "skipped", "failed"


class StepResponse(BaseModel):
    """Canonical step response — used by both the sessions and steps routers.

    Frontend reads camelCase (step.urlPattern / step.advanceOnUrlPattern); the DB
    columns are snake_case, so we serialize out under the camelCase aliases.
    """
    id: UUID
    session_id: UUID
    step_number: int
    title: Optional[str] = None
    description: Optional[str] = None
    action: str
    selector: Optional[str] = None
    url: Optional[str] = None
    url_pattern: Optional[str] = Field(default=None, serialization_alias="urlPattern")
    advance_on_url_pattern: Optional[str] = Field(default=None, serialization_alias="advanceOnUrlPattern")
    value: Optional[str] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}  # lets Pydantic read SQLAlchemy ORM objects directly