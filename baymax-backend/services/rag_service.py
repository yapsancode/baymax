"""RAG service: retrieve tested GCP navigation recipes and fill parameters.

Instead of having Gemini generate entire blueprints (including selectors) from
scratch — which hallucinates CSS selectors and breaks the guide overlay — this
service retrieves a pre-tested recipe from the knowledge base and lets Gemini
fill ONLY the parameterized value fields (instance names, passwords, regions,
etc.) using structured output.

Flow:
    1. User asks "deploy cloud run with service name hello"
    2. Keyword match finds "gcp-deploy-cloud-run-container-service"
    3. Gemini with_structured_output fills value fields from the user's message
    4. Complete FinalNavigationPayload returned — selectors are 100% correct
"""

import json
import logging
from pathlib import Path

from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

from config import settings
from schemas.chat import FinalNavigationPayload

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Load the knowledge base once at import time
# ---------------------------------------------------------------------------

_KB_PATH = Path(__file__).resolve().parent.parent / "data" / "gcp_recipes.json"

with open(_KB_PATH, encoding="utf-8") as _f:
    RECIPES: list[dict] = json.load(_f)

# Pre-lowercase all recipe keywords for fast matching.
_RECIPE_INDEX: list[tuple[list[str], dict]] = []
for recipe in RECIPES:
    kws = [kw.lower() for kw in (recipe.get("keywords") or [])]
    _RECIPE_INDEX.append((kws, recipe))

logger.info("Loaded %d RAG recipes from %s", len(RECIPES), _KB_PATH.name)

# ---------------------------------------------------------------------------
# Action words — same as chat_service.py but duplicated to avoid circular imports
# ---------------------------------------------------------------------------
_ACTION_WORDS = (
    "deploy", "host", "create", "set up", "setup", "launch", "provision",
    "start", "build", "guide me", "walk me", "how to", "help me do",
    "make", "spin up", "open", "go to",
)

# ---------------------------------------------------------------------------
# Available guides list (for the "Coming Soon" fallback message)
# ---------------------------------------------------------------------------
AVAILABLE_GUIDES = "\n".join(
    f"- **{r['title']}**" for r in RECIPES
)

# ---------------------------------------------------------------------------
# Gemini structured-output chain
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are a GCP navigation assistant. You receive a static navigation recipe (a JSON object with pre-tested CSS selectors and actions) and a user request.

Your job:
1. Copy the recipe EXACTLY — every selector, action, URL pattern, and step ID must be preserved verbatim. Never invent or modify selectors.
2. Look at the user's request. If they specified names, passwords, regions, or other values, fill those into the `value` field of the matching parameterized step (where `isParameter: true`).
3. If the user did NOT specify a value for a parameterized step, generate a sensible default:
   - Instance/service names: a short descriptive name like "my-service" or "db-instance-01"
   - Passwords: a secure random string like "SecureP@ss123"
   - Regions: "asia-southeast1" (Singapore) as the default
   - Other parameters: a reasonable default appropriate for the field
4. Return the complete FinalNavigationPayload with ALL steps included."""

_RAG_PROMPT = ChatPromptTemplate.from_messages([
    ("system", _SYSTEM_PROMPT),
    ("human", "User Request: {user_message}\n\nStatic Recipe from Knowledge Base:\n{recipe_json}"),
])


def _build_llm():
    return ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        temperature=0.0,
        api_key=settings.GEMINI_API_KEY,
    )


_llm = _build_llm()
_structured_llm = _llm.with_structured_output(FinalNavigationPayload)
_chain = (_RAG_PROMPT | _structured_llm).with_config(run_name="baymax_rag")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def match_recipe(message: str) -> dict | None:
    """Find the best matching recipe for a user message.

    Matches explicit multi-word keywords from each recipe against the user's
    message. Requires an action word in the message (so "What is Cloud Run?"
    doesn't trigger the deploy recipe).
    """
    text = (message or "").lower()
    if not any(w in text for w in _ACTION_WORDS):
        return None

    best_recipe = None
    best_score = 0

    for keywords, recipe in _RECIPE_INDEX:
        # Count how many explicit keywords appear in the message
        score = sum(1 for kw in keywords if kw in text)
        if score > best_score:
            best_score = score
            best_recipe = recipe

    if best_score > 0:
        return best_recipe
    return None


def fill_parameters(user_message: str, recipe: dict) -> dict:
    """Use Gemini to fill parameterized value fields in the recipe.

    Returns a FinalNavigationPayload dict ready for the frontend.
    """
    recipe_json = json.dumps(recipe, indent=2)
    result = _chain.invoke({
        "user_message": user_message,
        "recipe_json": recipe_json,
    })
    return result.model_dump()
