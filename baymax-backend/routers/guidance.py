"""Self-heal endpoint: POST /guidance/repair.

Thin HTTP layer (per the four-layers rule) — validates the request shape and
delegates the LLM work to services/guidance_service. Public route, like /chat:
it carries no user data and must keep working before sign-in lands.
"""

from fastapi import APIRouter, Request, status

from config import settings
from rate_limit import limiter
from schemas.guidance import RefineRequest, RefineResponse, RepairRequest, RepairResponse
from services import guidance_service, refine_service

router = APIRouter(prefix="/guidance", tags=["guidance"])


@router.post("/repair", response_model=RepairResponse, status_code=status.HTTP_200_OK)
@limiter.limit(lambda: settings.GUIDANCE_RATE_LIMIT)
def repair_step(request: Request, body: RepairRequest):
    """Given a failing step + a page snapshot, return the element it now maps to."""
    intent = guidance_service.repair_step(body)

    # No confident match (or the model only invented a selector we stripped) —
    # tell the frontend so it falls back to "navigate there manually".
    if not intent or (not intent.selector and not intent.name):
        return RepairResponse(ok=False, intent=None)

    return RepairResponse(ok=True, intent=intent)


@router.post("/refine", response_model=RefineResponse, status_code=status.HTTP_200_OK)
@limiter.limit(lambda: settings.REFINE_RATE_LIMIT)
def refine_guide(request: Request, body: RefineRequest):
    """Polish a just-recorded guide's wording against the official GCP docs.

    Only step titles/descriptions (and the guide title) change — the recorded
    actions and technical metadata are preserved by construction in the
    service. ok=False tells the frontend to keep the raw recording.
    """
    return refine_service.refine_guide(body)
