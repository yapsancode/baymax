"""Chat service: RAG-powered GCP assistant with Gemini text fallback.

Mode selection:
    1. RAG (first): user message is matched against the knowledge base of
       tested GCP navigation recipes. If a recipe matches, Gemini fills only
       the parameterized value fields (instance names, passwords, regions)
       using structured output. The CSS selectors are copied verbatim from the
       recipe — no hallucination possible.

    2. Text fallback: if no recipe matches, Gemini answers as a normal text
       chatbot — answering GCP questions, having a conversation, and mentioning
       "guided navigation coming soon" when appropriate. No blueprint is ever
       generated from scratch.

The text fallback maintains conversation history within a session: the frontend
sends prior user/assistant turns, and the model sees them for multi-turn context.
"""

import logging
import time

from google.api_core.exceptions import ResourceExhausted
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_google_genai.chat_models import ChatGoogleGenerativeAIError
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from config import settings
from schemas.chat import ChatMessage
from services.embedding_service import get_embedding
import db_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Text-only Gemini chain (no DeploymentPlan tool — no blueprint generation)
# ---------------------------------------------------------------------------

_TEXT_SYSTEM = """You are Baymax, a GCP deployment assistant — NOT the healthcare robot from Big Hero 6. You help developers with Google Cloud Platform.

You can:
- Answer questions about GCP services (Cloud Run, Cloud SQL, Compute Engine, etc.)
- Explain concepts, compare services, and give architectural advice
- Have a normal conversation

IMPORTANT: Do NOT introduce yourself on every reply. Only introduce yourself when the user greets you (hi, hello, hey) or asks who you are / what you can do. For all other questions, answer directly without any greeting or self-introduction.

If the user asks for step-by-step deployment guidance for a task you don't have a tested guide for, say "Guided navigation for that is coming soon!" but still provide a helpful text explanation of how to do it.

When your response is about a GCP deployment or setup topic (Cloud Run, Cloud SQL, Compute Engine, IAM, etc.), always end your reply with this exact line on a new line:
💡 For a guided step-by-step session, try saying **"let's deploy"** or **"let's start"** followed by what you want to do.

Do NOT add this hint for general conversation or non-GCP topics.

You may be given a snapshot of the user's CURRENT Cloud Console page — a text summary (URL, title, visible sections) and/or a screenshot image. When present:
- Ground your answer in what is actually visible: name the specific page, metric, chart, table, or error the user is asking about.
- For graphs/charts, describe what the visible data shows (trends, spikes, flat lines, the time window) AND what the metric means.
- If the question is about something not visible in the snapshot, say so instead of guessing.
- Don't mention screenshots or snapshots mechanically — just answer naturally about "this page" / "this graph".

Keep responses concise and helpful. Use markdown formatting when appropriate."""

MAX_HISTORY = 20


def _build_text_llm(model_name: str):
    return ChatGoogleGenerativeAI(
        model=model_name,
        temperature=0.3,
        api_key=settings.GEMINI_API_KEY,
    )


_text_llm = _build_text_llm(settings.GEMINI_MODEL)

# Quota fallback chain
_ERRORS = (ResourceExhausted, ChatGoogleGenerativeAIError)
_fallbacks = [
    _build_text_llm(name.strip())
    for name in settings.GEMINI_FALLBACK_MODELS.split(",")
    if name.strip()
]
if _fallbacks:
    _text_llm = _text_llm.with_fallbacks(_fallbacks, exceptions_to_handle=_ERRORS)


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


def _embed_with_retry(text: str, attempts: int = 3) -> list[float]:
    """get_embedding() with a short backoff.

    A transient embedding-API/quota blip used to be swallowed by the caller's
    bare `except` and silently turn a guide request into a plain text reply (no
    card, no signal). Retrying recovers that common case; only a genuine, repeated
    failure propagates to the caller — which logs it distinctly rather than
    conflating it with "no guide matched".
    """
    for attempt in range(attempts):
        try:
            return get_embedding(text)
        except Exception:
            if attempt == attempts - 1:
                raise
            time.sleep(0.4 * (attempt + 1))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def stream_reply(
    user_input: str,
    history: list[ChatMessage] | None = None,
    db=None,
    context: str | None = None,
    page_context: str | None = None,
    screenshot: str | None = None,
):
    """One chat turn with conversation history.

    `context` (e.g. the current guide step's title/description) is ONLY used to
    inform the text-fallback reply — never for the action-word check or the RAG
    vector search below. Those must see the user's literal words, otherwise a
    step's own instructions (which are full of words like "create", "deploy",
    "open") make every message during that step look like a new deployment
    request, regardless of what the user actually typed.

    `page_context` (a text summary of the Console page) and `screenshot` (a
    data:image/* URL of the visible tab) ground page-directed questions like
    "what does this graph mean". Both, like `context`, feed ONLY the text-reply
    model — never the guide match. When the message reads as a question ABOUT the
    current page (see `_PAGE_DEICTIC`), the vector guide search is skipped
    entirely so a "what does this show?" can never return a deployment guide card.

    Yields:
        ("delta", text)                          — streamed text chunk
        ("final", (text, plan, type))            — type is one of:
            "blueprint_json"  static recipe match (fill_parameters ran)
            "guide_match"     vector-matched saved guide
            "text"            plain Gemini reply
    """
    # TODO: Remove this on production deployment
    # from services import rag_service
    #  --- 1. Static recipe: keyword match → Gemini fills parameters ---
#     recipe = rag_service.match_recipe(user_input)
#     if recipe:
#         try:
#             logger.info("RAG match: %s", recipe.get("id"))
#             payload = rag_service.fill_parameters(user_input, recipe)
#             yield "final", ("", payload, "blueprint_json")
#             return
#         except Exception:
#             logger.exception("RAG fill failed for recipe %s", recipe.get
# ("id"))

    # --- 1. Vector guide search: semantic match against saved guides ---
    _ACTION_WORDS = (
        "deploy", "host", "create", "set up", "setup", "launch", "provision",
        "start", "build", "guide me", "walk me", "how to", "help me do",
        "make", "spin up", "open", "go to", "i want to", "i would like to",
        "show me how", "can you help me", "help me",
    )
    # Phrases that mark a question ABOUT the page in front of the user rather
    # than a request to start something. These share verbs with the action words
    # ("show me this graph", "explain this error"), so without this guard a page
    # question would trip the guide search and return an unrelated deployment
    # card. When any of these appear, we skip the guide search and go straight to
    # a grounded text answer.
    _PAGE_DEICTIC = (
        "this graph", "this chart", "this page", "this error", "this table",
        "this metric", "this dashboard", "this screen", "this section",
        "this value", "this number", "this warning", "this button", "this field",
        "what am i looking at", "what does this", "what is this", "what's this",
        "whats this", "explain this", "my screen", "on screen", "on my screen",
        "on this page", "right now on", "currently showing", "am i looking",
    )
    lowered = user_input.lower()
    _is_page_question = any(p in lowered for p in _PAGE_DEICTIC)
    _is_action = any(w in lowered for w in _ACTION_WORDS)

    if db is not None and _is_action and not _is_page_question:
        try:
            embedding = _embed_with_retry(user_input)
            hits = db_call.search_guides(db, embedding, threshold=0.6, limit=1)
            if hits:
                hit = hits[0]
                guide = {
                    "id": str(hit.id),
                    "title": hit.title,
                    "steps": hit.steps,
                    **(hit.meta or {}),
                }
                logger.info("Vector guide match: %s (similarity=%.2f)", hit.title, hit.similarity)
                yield "final", ("", guide, "guide_match")
                return
            # No hits is a legitimate "no tested guide for this" — fall through to
            # a normal text answer. This is NOT the error path below.
            logger.debug("Guide search: no match above threshold for %r", user_input[:80])
        except Exception:
            # Reached only when the embedding call or DB search actually ERRORED
            # (after _embed_with_retry exhausted its retries) — never for a plain
            # "no match". Logged distinctly so an intermittent embedding outage is
            # diagnosable instead of masquerading as an ordinary chat turn.
            logger.exception("Guide search errored after retries — falling back to text")

    # --- 2. Text fallback: Gemini answers naturally (with history) ---
    try:
        # Build the message list directly (not ChatPromptTemplate.from_messages)
        # so that (a) a screenshot can ride along as a multimodal image part, and
        # (b) history/user text is passed as literal content — the template path
        # treated any "{...}" in a message as a variable and crashed on braces.
        # During an active guided session the frontend sends `context` (the
        # current step). The "try saying 'let's deploy'" hint is meant to help a
        # user START a session — it's noise once one is already running, so
        # suppress it when a step context is present.
        system_text = _TEXT_SYSTEM
        if context:
            system_text += (
                "\n\nThe user is ALREADY in a guided step-by-step session right now. "
                "Do NOT append the \"try saying 'let's deploy' / 'let's start'\" hint "
                "line to your reply — they don't need to start a session, they're in one."
            )
        messages = [SystemMessage(content=system_text)]
        if history:
            for msg in history[-MAX_HISTORY:]:
                if msg.role == "user":
                    messages.append(HumanMessage(content=msg.content))
                else:
                    messages.append(AIMessage(content=msg.content))

        # Compose the final human turn: page grounding first (so the model reads
        # it before the question), then the guide-step context, then the words
        # the user actually typed.
        preface_parts = []
        if page_context:
            preface_parts.append(page_context)
        if context:
            preface_parts.append(context)
        preface = "\n\n".join(preface_parts)
        text_part = f"{preface}\n\n{user_input}" if preface else user_input

        if screenshot:
            # Canonical LangChain multimodal block: image_url is a {"url": ...}
            # dict (the form langchain-google-genai documents). The screenshot is
            # already a `data:image/...;base64,` URL, which the loader accepts.
            human_content = [
                {"type": "text", "text": text_part},
                {"type": "image_url", "image_url": {"url": screenshot}},
            ]
        else:
            human_content = text_part
        messages.append(HumanMessage(content=human_content))

        chain = _text_llm.with_config(run_name="baymax_text")

        accumulated = None
        for chunk in chain.stream(messages):
            accumulated = chunk if accumulated is None else accumulated + chunk
            text = _text_content(chunk)
            if text:
                yield "delta", text

        if accumulated is None:
            yield "final", ("Sorry, I couldn't come up with a response.", None, "text")
            return

        yield "final", (_text_content(accumulated).strip(), None, "text")
    except Exception:
        logger.exception("Text generation failed")
        yield "final", ("Sorry, something went wrong. Please try again.", None, "text")


def generate_reply(user_input: str, history: list[ChatMessage] | None = None, db=None) -> tuple[str, dict | None, str]:
    """Non-streaming variant of stream_reply (kept for compatibility)."""
    for kind, payload in stream_reply(user_input, history=history, db=db):
        if kind == "final":
            return payload
    return ("Sorry, I couldn't come up with a response.", None, "text")
