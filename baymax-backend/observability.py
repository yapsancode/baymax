"""Observability (LangSmith tracing) — infrastructure, like rate_limit.py.

LangChain auto-traces every chain/LLM call when the langsmith SDK sees its
config in os.environ. Our config lives in the typed `settings` object (env vars
are read there, never via os.getenv), so setup_tracing() is the one-way bridge:
it copies the LangSmith settings into os.environ so the SDK picks them up.

Tracing is opt-in and fully no-op when LANGSMITH_TRACING is false or no API key
is set — the app runs identically with tracing off. LangSmith uploads happen on
a background thread and never block or fail a request.
"""

import logging
import os

from config import settings

logger = logging.getLogger(__name__)


def setup_tracing() -> None:
    """Enable LangSmith tracing if configured. Called once at startup."""
    if not settings.LANGSMITH_TRACING:
        logger.info("LangSmith tracing disabled (set LANGSMITH_TRACING=true to enable)")
        return

    if not settings.LANGSMITH_API_KEY:
        logger.warning("LANGSMITH_TRACING is on but LANGSMITH_API_KEY is missing — tracing off")
        return

    # Bridge settings -> the env vars the langsmith SDK reads at invoke time.
    os.environ["LANGSMITH_TRACING"] = "true"
    os.environ["LANGSMITH_API_KEY"] = settings.LANGSMITH_API_KEY
    os.environ["LANGSMITH_PROJECT"] = settings.LANGSMITH_PROJECT
    os.environ["LANGSMITH_ENDPOINT"] = settings.LANGSMITH_ENDPOINT

    logger.info("LangSmith tracing enabled → project=%s", settings.LANGSMITH_PROJECT)
