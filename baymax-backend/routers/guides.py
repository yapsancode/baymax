"""Saved recorded-guide routes: POST/GET/DELETE /guides.

Thin HTTP layer (per the four-layers rule). Reads are own-or-official: a user
sees their own recordings plus every official (Baymax-curated) guide. Writes
stay strictly owner-scoped — POST always creates a personal guide (there is no
client path to set is_official; officials are seeded via
data/seed_official_guide.py), and DELETE cannot touch official guides.
"""

from uuid import UUID
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

import db_call
from database import get_db
from schemas.guide import (
    AdminGuideListResponse,
    AdminGuideSummary,
    GuideCreate,
    GuideResponse,
    GuideSearchResult,
    GuideSummary,
)
from services.auth_service import get_current_user, require_admin
from services.embedding_service import get_embedding, guide_embed_text

log = logging.getLogger(__name__)

router = APIRouter(prefix="/guides", tags=["guides"])


@router.get("/admin", response_model=AdminGuideListResponse)
def list_guides_admin(
    is_official: bool | None = Query(default=None, description="Filter by official status"),
    search: str | None = Query(default=None, description="Search guide titles"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """Admin-only listing of ALL guides across all users."""
    items, total = db_call.list_all_guides(
        db, is_official=is_official, search=search, page=page, page_size=page_size
    )
    return AdminGuideListResponse(
        items=[AdminGuideSummary.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.delete("/admin/{guide_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_guide_admin(
    guide_id: UUID,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """Admin-only delete — no owner checks."""
    deleted = db_call.admin_delete_guide(db, str(guide_id))
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guide not found")


@router.post("", status_code=status.HTTP_201_CREATED, response_model=GuideResponse)
def save_guide(
    body: GuideCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Persist a guide recorded on the Recorder screen and generate its embedding."""
    guide = db_call.create_recorded_guide(
        db, current_user["sub"], body.title, body.steps
    )
    try:
        embed_text = guide_embed_text(body.title, body.steps)
        embedding = get_embedding(embed_text)
        db_call.set_guide_embedding(db, str(guide.id), embedding)
    except Exception:
        log.exception("Embedding generation failed for guide %s — guide saved without vector.", guide.id)
    return guide


@router.get("", response_model=list[GuideSummary])
def list_guides(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List the guides the user can run — official first, then their own
    (no steps — see GET /guides/{id})."""
    return db_call.get_recorded_guides_by_user(db, current_user["sub"])


@router.get("/search", response_model=list[GuideSearchResult])
def search_guides(
    q: str = Query(..., description="Natural language query to match against saved guides"),
    threshold: float = Query(0.5, ge=0.0, le=1.0, description="Minimum cosine similarity (0–1)"),
    limit: int = Query(3, ge=1, le=10),
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Semantic search over saved guides using vector similarity.

    Returns guides ordered by relevance. Use `threshold` to tighten or loosen
    matches; 0.5 is a reasonable default for GCP task queries.
    """
    try:
        embedding = get_embedding(q)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Embedding failed: {exc}") from exc

    rows = db_call.search_guides(db, embedding, threshold=threshold, limit=limit)
    return [
        GuideSearchResult(id=row.id, title=row.title, steps=row.steps, meta=row.meta, similarity=row.similarity)
        for row in rows
    ]


@router.get("/{guide_id}", response_model=GuideResponse)
def get_guide(
    guide_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Load one saved guide in full so it can be run through the guide engine."""
    guide = db_call.get_recorded_guide(db, str(guide_id), current_user["sub"])
    if not guide:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guide not found")
    return guide


@router.delete("/{guide_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_guide(
    guide_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Delete one saved guide."""
    deleted = db_call.delete_recorded_guide(db, str(guide_id), current_user["sub"])
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guide not found")
