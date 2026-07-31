"""Guide-refinement service: polish a just-recorded guide with Gemini + GCP docs.

When the Recorder stops, the raw steps carry machine-made wording ("Click
"Deploy container"."). This service rewrites ONLY the human-readable fields so
the guide reads like an official tutorial, grounding the added context in the
live Google Cloud documentation.

THE RECORDING IS THE SOURCE OF TRUTH — enforced by construction, not by prompt
hope: the model never returns the guide JSON. It returns per-step editorial
text (title/description keyed by step index), which _merge() copies onto
untouched copies of the recorded steps. Step count, order, and every technical
field (selector, role, action, value, isParameter, urlPattern, ...) survive
verbatim because the model physically cannot emit them. This is the same
anti-hallucination stance as guidance_service's verbatim-selector guard.

Two-stage chain (both LangChain, per the backend rule):
  1. docs lookup (best-effort, skippable via REFINE_SEARCH_GROUNDING): Gemini
     with the built-in google_search grounding tool summarises the relevant
     official cloud.google.com docs. ANY failure degrades to "no docs context".
  2. refine (structured output): rewrite title/description per step index,
     with the docs summary as extra context.

External call (Gemini via LangChain) -> lives in services/, per the four-layers
rule.
"""

import logging

from google.api_core.exceptions import ResourceExhausted
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_google_genai.chat_models import ChatGoogleGenerativeAIError
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from config import settings
from schemas.guidance import RefineRequest, RefineResponse

logger = logging.getLogger(__name__)

# Interactive endpoint: the user is staring at a spinner, so fail fast and let
# the frontend fall back to the raw recording instead of retrying for minutes.
_TIMEOUT_S = 60
_MAX_RETRIES = 2

# Guard rail: a legit recording is a few dozen actions. Anything bigger is
# either a runaway recorder or someone stuffing the public endpoint — refuse
# and let the frontend keep the raw steps.
_MAX_STEPS = 60

# Errors worth retrying on a cheaper model. langchain-google-genai ≥3 (new
# google-genai SDK) wraps EVERY API error — including 429 quota — in
# ChatGoogleGenerativeAIError, so keying only on api_core's ResourceExhausted
# (as older code did) means fallbacks never fire. Non-quota API errors slip
# through this net too; the fallback then fails the same way and refine_guide's
# outer try/except still degrades to ok=False, so that is safe.
_FALLBACK_ERRORS = (ResourceExhausted, ChatGoogleGenerativeAIError)


# ---------------------------------------------------------------------------
# What the model is allowed to produce: editorial text only, never actions.
# (Internal Gemini tool schema, not an API shape — so it lives here, not in
# schemas/. RefineRequest/RefineResponse, the API shapes, are in schemas/.)
# ---------------------------------------------------------------------------
class _StepText(BaseModel):
    """Polished wording for one recorded step."""

    index: int = Field(description="0-based index of the recorded step this text is for")
    title: str = Field(
        description="Polished step title: a short imperative phrase naming the "
        "action, 3-8 words, plain text (no markdown, no quotes around it)"
    )
    description: str = Field(
        description="Polished step description: 1-3 sentences of plain text "
        "telling the user what to do plus genuinely helpful context (why the "
        "step is performed / what the option does / an important consideration)"
    )


class _GuideText(BaseModel):
    """Editorial rewrite of a recorded guide — text only."""

    title: str = Field(
        description="Polished guide title: short and task-shaped, "
        "e.g. 'Deploy a service to Cloud Run'"
    )
    summary: str = Field(
        description="One plain-text sentence describing what this workflow "
        "accomplishes and, if docs were consulted, what was verified"
    )
    steps: list[_StepText] = Field(
        description="One entry per recorded step — every index from the "
        "recording exactly once, in order"
    )


def _build_llm(model_name: str) -> ChatGoogleGenerativeAI:
    # Mild temperature: this is editorial writing, not matching — but it must
    # stay faithful to the recorded facts, so keep it low.
    return ChatGoogleGenerativeAI(
        model=model_name,
        temperature=0.2,
        api_key=settings.GEMINI_API_KEY,
        timeout=_TIMEOUT_S,
        max_retries=_MAX_RETRIES,
    )


# --- Stage 1: official-docs lookup via the built-in Google Search tool -------
_docs_llm = _build_llm(settings.GEMINI_MODEL).bind_tools(
    [{"google_search": {}}]
).with_config(run_name="baymax_refine_docs")

_DOCS_PROMPT = """You are researching for a Google Cloud technical writer.
A user just recorded this workflow in the Google Cloud Console:

WORKFLOW: {title}
RECORDED STEPS (in order):
{step_titles}

Use Google Search to consult the LATEST official Google Cloud documentation —
pages on cloud.google.com ONLY, never blogs or third-party sites. Summarise in
at most 250 words of plain text:
- what this feature/workflow does,
- key prerequisites,
- what the main options and fields touched by the steps mean,
- naming rules or constraints,
- common considerations.

State facts only; do not describe or renumber the steps themselves. If you
cannot find relevant official documentation, reply with exactly: NO_DOCS"""


# --- Stage 2: structured rewrite of title/description per step ---------------
_refine_llm = _build_llm(settings.GEMINI_MODEL).with_structured_output(_GuideText)

# Quota fallback chain, same pattern as chat_service (list owned in config).
_fallbacks = [
    _build_llm(name).with_structured_output(_GuideText)
    for name in (m.strip() for m in settings.GEMINI_FALLBACK_MODELS.split(","))
    if name
]
if _fallbacks:
    _refine_llm = _refine_llm.with_fallbacks(
        _fallbacks, exceptions_to_handle=_FALLBACK_ERRORS
    )

_SYSTEM = """You are an expert Google Cloud Platform documentation writer. You transform the step titles and descriptions of a workflow that was recorded live in the Google Cloud Console into a polished, professional tutorial.

THE RECORDING IS THE SOURCE OF TRUTH. It was captured directly from the live Console UI. Official documentation may add context, but wherever it seems to disagree with what was recorded, always trust the recording. You rewrite ONLY the title and description of each step — you can never add, remove, merge, or reorder actions, and anything else you produce is discarded.

For every step index, write:
- title: a short imperative phrase naming the action (3-8 words).
- description: 1-3 sentences telling the user what to do, enriched with helpful, accurate context where it adds value — why the step is performed, what the option does, an important prerequisite or consideration. If you are not certain a piece of context is true, leave it out rather than guessing.

Rules:
- Refer to UI controls by their exact recorded label (e.g. Deploy container), in plain text — no markdown, no emojis.
- A "fill" step marked as a user-provided parameter must be described generically: say what to enter and what makes a good value. NEVER invent a hardcoded example value for it.
- A "fill" step with a recorded value may mention that value.
- A "click" step names the control and what clicking it does or opens.
- Clear, friendly, professional, action-oriented natural English — the voice of official Google Cloud documentation. Concise but informative.
- Also propose an overall guide title (short, task-shaped) and a one-sentence summary of what the workflow accomplishes.

Example transformations:
- Recorded: title Deploy container, description Click "Deploy container". -> title: Start deploying a container, description: Click Deploy container to begin creating a new Cloud Run service from a container image.
- Recorded: title Service name, description Enter a value for "Service name". (parameter) -> title: Name your service, description: Enter a unique name for your Cloud Run service. The name identifies the service within your project and region and cannot be changed later."""

_HUMAN = """GUIDE WORKING TITLE: {title}

OFFICIAL DOCUMENTATION CONTEXT (may be empty; ignore anything here that contradicts the recording):
{docs}

RECORDED STEPS (source of truth, in exact order):
{steps}

Rewrite the title and description for every step index from 0 to {last_index}, and propose the guide title and one-sentence summary."""

_prompt = ChatPromptTemplate.from_messages([("system", _SYSTEM), ("human", _HUMAN)])
# run_name labels the trace in LangSmith (else it shows as "RunnableSequence").
_chain = (_prompt | _refine_llm).with_config(run_name="baymax_refine_guide")


def _text_content(message) -> str:
    """Gemini responses may carry content as a string or a list of parts."""
    if isinstance(message.content, str):
        return message.content
    parts = []
    for part in message.content:
        if isinstance(part, str):
            parts.append(part)
        elif isinstance(part, dict) and part.get("type") == "text":
            parts.append(part.get("text", ""))
    return "".join(parts)


def _get(step: dict, key: str, limit: int = 80) -> str:
    """Read a step field defensively (frontend-owned dicts) as trimmed text."""
    value = step.get(key)
    if value is None or isinstance(value, bool):
        return ""
    return str(value).strip()[:limit]


def _format_steps(steps: list[dict]) -> str:
    """Compact per-step context for the model — identity, not CSS selectors."""
    lines = []
    for i, s in enumerate(steps):
        action = _get(s, "action") or "click"
        head = [f"[{i}] action={action}"]
        if action == "fill":
            if s.get("isParameter"):
                head.append("value=<user-provided parameter>")
            elif _get(s, "value", 60):
                head.append(f'value="{_get(s, "value", 60)}"')
            else:
                head.append("value=<empty>")
        control = ", ".join(
            f'{k}="{_get(s, k)}"' for k in ("role", "name", "text", "href") if _get(s, k)
        )
        if control:
            head.append(f"control: {control}")
        if _get(s, "url", 140):
            head.append(f"page: {_get(s, 'url', 140)}")
        lines.append(" | ".join(head))
        lines.append(f'    recorded title: "{_get(s, "title", 120)}"')
        lines.append(f'    recorded description: "{_get(s, "description", 200)}"')
    return "\n".join(lines)


def _lookup_docs(title: str, steps: list[dict]) -> str:
    """Best-effort stage 1: summary of the relevant official GCP docs, or ""."""
    step_titles = "\n".join(
        f"{i + 1}. {_get(s, 'title', 120) or _get(s, 'name', 120) or 'step'}"
        for i, s in enumerate(steps)
    )
    try:
        response = _docs_llm.invoke(
            _DOCS_PROMPT.format(title=title or "(untitled)", step_titles=step_titles)
        )
        docs = _text_content(response).strip()
    except Exception as exc:  # tool unsupported / quota / network — never fatal
        logger.warning("refine: docs lookup failed, continuing without: %s", exc)
        return ""
    if not docs or docs.upper().startswith("NO_DOCS"):
        return ""
    return docs


def _merge(original_steps: list[dict], refined_steps: list[_StepText]) -> list[dict]:
    """Copy the model's editorial text onto untouched copies of the recording.

    Only title/description can change; out-of-range indexes and empty strings
    are ignored, so every step keeps at least its recorded wording. This is the
    guarantee that makes the endpoint safe: sequence, count, and technical
    metadata are preserved no matter what the model produced.
    """
    merged = [dict(s) for s in original_steps]
    for item in refined_steps:
        if not 0 <= item.index < len(merged):
            continue
        title = (item.title or "").strip()
        description = (item.description or "").strip()
        if title:
            merged[item.index]["title"] = title
        if description:
            merged[item.index]["description"] = description
    return merged


def refine_guide(req: RefineRequest) -> RefineResponse:
    """Polish a recorded guide's wording. ok=False means: keep the raw one."""
    if not req.steps or len(req.steps) > _MAX_STEPS:
        if req.steps:
            logger.warning("refine: rejected %d steps (max %d)", len(req.steps), _MAX_STEPS)
        return RefineResponse(ok=False)

    docs = _lookup_docs(req.title, req.steps) if settings.REFINE_SEARCH_GROUNDING else ""

    try:
        result: _GuideText = _chain.invoke(
            {
                "title": req.title or "(untitled)",
                "docs": docs or "(none available — rely on your own accurate knowledge)",
                "steps": _format_steps(req.steps),
                "last_index": len(req.steps) - 1,
            }
        )
    except Exception as exc:  # model/network error — caller falls back gracefully
        logger.warning("refine: LLM error: %s", exc)
        return RefineResponse(ok=False)

    if not result or not result.steps:
        logger.warning("refine: model returned no step rewrites")
        return RefineResponse(ok=False)

    return RefineResponse(
        ok=True,
        title=(result.title or "").strip() or req.title,
        steps=_merge(req.steps, result.steps),
        summary=(result.summary or "").strip(),
    )
