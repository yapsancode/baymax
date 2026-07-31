"""Chat request/response shapes + the deployment blueprint the model produces.

DeploymentPlan doubles as the Gemini tool schema in services/chat_service.py:
the model "calls" it when the user asks for actionable deployment steps, so the
class docstring and field descriptions below are instructions the model reads.

FinalNavigationPayload is the RAG output schema — the LLM fills only the
parameterized value fields of a pre-tested recipe from the knowledge base.
"""

from typing import List, Literal

from pydantic import BaseModel, Field, field_validator


class StepBlueprint(BaseModel):
    step_number: int = Field(description="Step sequence number")
    title: str = Field(description="Step action name")
    description: str = Field(description="Clear instructions on what to do in the console UI.")
    action: str = Field(description="Action type: click, fill, or highlight")
    selector: str = Field(description="CSS selector matching the target UI button or input")
    value: str = Field(description="String value to input if action is fill, otherwise empty string ''")
    url: str = Field(description="Explicit GCP console URL, otherwise empty string ''")
    urlPattern: str = Field(description="Current regex url filter pattern, otherwise empty string ''")
    advanceOnUrlPattern: str = Field(description="Destination regex url pattern after completing action, otherwise empty string ''")


class DeploymentPlan(BaseModel):
    """Produce the COMPLETE step-by-step GCP Console UI blueprint for the
    deployment task the user asked for — every step from the first click to the
    final confirmation, in one call."""

    id: str = Field(description="Hyphen-separated unique identifier for the deployment blueprint")
    title: str = Field(description="Human readable overall goal description")
    steps: List[StepBlueprint] = Field(description="The complete list of sequential deployment steps")


# ---------------------------------------------------------------------------
# RAG output schema — used by services/rag_service.py
# ---------------------------------------------------------------------------

class NavigationStep(BaseModel):
    """A single navigation step from a RAG recipe. The LLM copies the recipe
    exactly and only fills in the `value` fields for parameterized steps."""
    id: int = Field(description="Step sequence number")
    title: str = Field(description="Step action name")
    description: str = Field(description="Clear instructions on what to do in the console UI.")
    action: str = Field(description="Action type: click, fill, highlight, or radio")
    role: str | None = Field(default=None, description="ARIA role of the target element")
    name: str | None = Field(default=None, description="Accessible name of the target element")
    selector: str = Field(description="CSS selector matching the target UI element — must be copied exactly from the recipe")
    value: str = Field(default="", description="Text to type for fill actions; empty string '' otherwise. For parameterized steps, the LLM fills this from the user's request or generates a smart default.")
    url: str | None = Field(default=None, description="Explicit GCP console URL if the step starts on a specific page")
    urlPattern: str | None = Field(default=None, description="Current URL regex pattern to verify the step is on the right page")
    advanceOnUrlPattern: str | None = Field(default=None, description="URL regex pattern that confirms the step completed successfully")
    isParameter: bool = Field(default=False, description="True if this step requires user-specific input (name, password, region, etc.)")
    avoidText: str | None = Field(default=None, description="Text to avoid when matching elements")


class FinalNavigationPayload(BaseModel):
    """RAG output: a complete navigation payload with all selectors copied
    exactly from the tested recipe. The LLM only fills `value` fields where
    `isParameter: true`."""
    id: str = Field(description="Hyphen-separated unique identifier matching the recipe")
    title: str = Field(description="Human readable overall goal description")
    steps: List[NavigationStep] = Field(description="Complete list of navigation steps with selectors copied exactly from the recipe")


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"] = Field(description="Message sender role")
    content: str = Field(description="Message text content")


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, description="The user's chat message, exactly as typed")
    history: list[ChatMessage] = Field(
        default_factory=list,
        description="Previous conversation turns (user/assistant pairs) for multi-turn context",
    )
    context: str | None = Field(
        default=None,
        description=(
            "Optional situational context (e.g. the current guide step) shown to the "
            "text-reply model for awareness. Never used for RAG/action-guide matching, "
            "so it can't make an unrelated message look like a deployment request."
        ),
    )
    page_context: str | None = Field(
        default=None,
        max_length=4000,
        description=(
            "Optional compact text summary of the Console page the user is viewing "
            "(URL, title, visible headings). Grounds page-directed questions; like "
            "`context`, never used for guide matching."
        ),
    )
    screenshot: str | None = Field(
        default=None,
        max_length=2_000_000,
        description=(
            "Optional data:image/* data URL of the visible Console tab, passed to the "
            "multimodal model so it can read charts and layouts the DOM text can't convey."
        ),
    )

    @field_validator("screenshot")
    @classmethod
    def _screenshot_must_be_image_data_url(cls, v: str | None) -> str | None:
        if v is not None and not v.startswith("data:image/"):
            raise ValueError("screenshot must be a data:image/* data URL")
        return v


class ChatResponse(BaseModel):
    """Discriminated by `type` — the frontend switches on it.

    text            → data is the markdown reply string
    blueprint_json  → data is the DeploymentPlan or FinalNavigationPayload dict,
                      message is the CTA
    """

    type: Literal["text", "blueprint_json", "guide_match"]
    message: str | None = None
    data: str | dict | None = None
