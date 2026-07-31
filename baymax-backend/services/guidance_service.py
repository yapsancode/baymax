"""Self-heal service: ask Gemini which live element a broken step now maps to.

This is the "reason" boundary of the capture -> reason -> interpret loop. The
frontend has already captured a snapshot of the page's real interactive
elements; here we let the LLM pick the single one that fulfils the failing
step's intent, under a hard constraint: the selector it returns must be one we
actually sent it. Anything invented is stripped before it leaves the backend,
so the interpreter on the page can trust the selector exists.

External call (Gemini via LangChain) -> lives in services/, per the backend's
four-layers rule.
"""

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from config import settings
from schemas.guidance import RepairRequest, RepairedIntent

# temperature 0 — this is a matching task, not a creative one.
_llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    temperature=0.0,
    api_key=settings.GEMINI_API_KEY,
)
# Structured output: the model is forced to return the RepairedIntent shape.
_repair_llm = _llm.with_structured_output(RepairedIntent)

_SYSTEM = """You repair a broken UI-automation step for the Google Cloud Console.

A guided-setup step failed because its CSS selector no longer matches any element
on the page. You are given the step's INTENT and a SNAPSHOT: the interactive
elements currently visible on the page, each with its role, accessible name,
visible text, href, and a real CSS selector.

Your job: choose the SINGLE snapshot element that best fulfils the step's intent
and return its details.

HARD RULES:
- The "selector" you return MUST be copied verbatim from one of the snapshot
  elements. NEVER invent, edit, shorten, or combine selectors. If no element
  fits the step, return an empty selector and confidence 0.
- Match primarily on the step's accessible name / visible text and its action
  (a "fill" step wants an input/textbox; a "click" step wants a button/link/
  menuitem/radio).
- Ignore unrelated navigation, headers, and footer chrome.
- confidence is 0..1: how sure you are this element is the step's target."""

_HUMAN = """GOAL: {goal}
URL: {url}

FAILING STEP:
  title: {title}
  description: {description}
  action: {action}
  wanted role: {role}
  wanted name: {name}
  wanted text: {text}
  wanted href: {href}

SNAPSHOT ELEMENTS (choose at most one):
{elements}

Return the best-matching element, or an empty selector if none fits."""

_prompt = ChatPromptTemplate.from_messages([("system", _SYSTEM), ("human", _HUMAN)])
# run_name labels the trace in LangSmith (else it shows as "RunnableSequence").
_chain = (_prompt | _repair_llm).with_config(run_name="baymax_guidance_repair")


def _format_elements(elements) -> str:
    if not elements:
        return "(no elements)"
    lines = []
    for i, e in enumerate(elements):
        lines.append(
            f'[{i}] role="{e.role}" name="{e.name}" '
            f'text="{e.text[:80]}" href="{e.href}" selector={e.selector}'
        )
    return "\n".join(lines)


def repair_step(req: RepairRequest) -> RepairedIntent | None:
    """Return the healed intent, or None if nothing usable could be produced."""
    if not req.elements:
        return None

    try:
        result: RepairedIntent = _chain.invoke(
            {
                "goal": req.goal,
                "url": req.url,
                "title": req.step.title,
                "description": req.step.description,
                "action": req.step.action,
                "role": req.step.role,
                "name": req.step.name,
                "text": req.step.text,
                "href": req.step.href,
                "elements": _format_elements(req.elements),
            }
        )
    except Exception as exc:  # network/model error — caller falls back gracefully
        print(f"[guidance.repair] LLM error: {exc}")
        return None

    if not result:
        return None

    # Anti-hallucination guard: a returned selector must be one we actually sent.
    # If the model invented one, drop it but keep name/role/text as soft hints so
    # the frontend resolver can still try to find the element by those.
    valid_selectors = {e.selector for e in req.elements if e.selector}
    if result.selector and result.selector not in valid_selectors:
        print(f"[guidance.repair] dropped invented selector: {result.selector!r}")
        result.selector = ""

    return result
