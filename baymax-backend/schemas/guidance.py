"""Pydantic shapes for the self-heal endpoint (POST /guidance/repair).

When the extension's authored CSS selector for a guide step stops matching the
live GCP Console DOM, the frontend sends the failing step's intent plus a
snapshot of the page's real interactive elements. The backend LLM picks the
element that now matches and returns it (RepairedIntent). The selector it
returns must be one that was present in the snapshot — see guidance_service.
"""

from pydantic import BaseModel, Field


class SnapshotElement(BaseModel):
    """One visible interactive element captured from the live page."""

    role: str = ""
    name: str = ""
    text: str = ""
    href: str = ""
    selector: str = ""


class FailingStep(BaseModel):
    """The guide step whose selector no longer resolves, by intent."""

    title: str = ""
    description: str = ""
    action: str = ""
    role: str = ""
    name: str = ""
    text: str = ""
    href: str = ""
    selector: str = ""


class RepairRequest(BaseModel):
    goal: str = ""           # the overall guide title, for context
    url: str = ""            # current page URL
    step: FailingStep
    elements: list[SnapshotElement] = Field(default_factory=list)


class RepairedIntent(BaseModel):
    """The element the model believes the step now maps to."""

    selector: str = Field(
        default="",
        description="CSS selector of the chosen element, copied VERBATIM from the "
        "provided snapshot. Empty string if no element fits.",
    )
    role: str = Field(default="", description="ARIA role of the chosen element")
    name: str = Field(default="", description="Accessible name of the chosen element")
    text: str = Field(default="", description="Visible text of the chosen element")
    href: str = Field(default="", description="href of the chosen element, if any")
    confidence: float = Field(
        default=0.0, description="0..1 — how sure this element is the step's target"
    )
    reason: str = Field(default="", description="One short sentence on why it matches")


class RepairResponse(BaseModel):
    ok: bool
    intent: RepairedIntent | None = None


# ── Guide refinement (POST /guidance/refine) ─────────────────────────────────
# After the Recorder stops, the raw recorded guide is sent here so Gemini can
# cross-check it against the official Google Cloud docs and rewrite the
# human-readable step wording. Steps travel as plain dicts (same reasoning as
# schemas/guide.py): the rich frontend intent shape round-trips losslessly, and
# the service only ever rewrites title/description on a copy.


class RefineRequest(BaseModel):
    """A just-recorded guide, in the exact shape the Recorder exports."""

    title: str = ""
    steps: list[dict] = Field(default_factory=list)


class RefineResponse(BaseModel):
    """The same guide with polished wording — or ok=False, keep the raw one.

    On ok=True, `steps` is the full step list (same length/order as the
    request) with only title/description rewritten; every technical field is
    preserved verbatim by the merge in services/refine_service.
    """

    ok: bool
    title: str = ""
    steps: list[dict] = Field(default_factory=list)
    # One short model-written sentence on what was checked/improved (UI hint).
    summary: str = ""
