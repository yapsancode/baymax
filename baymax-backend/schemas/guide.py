"""Pydantic shapes for saved recorded guides (the /guides endpoints).

A recorded guide's steps carry a rich, frontend-owned intent shape (role, name,
text, href, selector, extraSelector, value, isParameter, exactName, urlPattern,
…). Rather than pin every field here — and risk silently dropping new ones — we
carry steps as a list of plain dicts so they round-trip losslessly.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class GuideCreate(BaseModel):
    title: str
    steps: list[dict] = Field(default_factory=list)


class GuideSummary(BaseModel):
    """List view — omits steps so the payload stays light.

    `meta` stays in the summary (it is small) so the frontend can find a guide
    by its Home task id (meta["task"]) without fetching every guide in full.
    """

    id: UUID
    title: str
    step_count: int
    is_official: bool = False
    meta: dict | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GuideSearchResult(BaseModel):
    """One hit from the vector similarity search."""

    id: UUID
    title: str
    steps: list[dict]
    meta: dict | None = None
    similarity: float


class GuideResponse(BaseModel):
    """Full view — includes steps so the guide can be run."""

    id: UUID
    user_id: UUID
    title: str
    steps: list[dict]
    is_official: bool = False
    meta: dict | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdminGuideSummary(BaseModel):
    """Admin list view — mirrors GuideSummary but adds the owner's email."""

    id: UUID
    title: str
    step_count: int
    is_official: bool = False
    meta: dict | None = None
    user_email: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdminGuideListResponse(BaseModel):
    items: list[AdminGuideSummary]
    total: int
    page: int
    page_size: int
