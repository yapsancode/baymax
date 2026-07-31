"""Generates text embeddings via the Gemini embedding API.

Uses text-embedding-004 (768 dimensions) — matches the VECTOR(768) column on
guides. Call get_embedding() with any string; the result is a plain
Python list[float] ready to be stored or compared.
"""

from google import genai
from google.genai import types
from config import settings

_client = genai.Client(api_key=settings.GEMINI_API_KEY)

_EMBED_MODEL = "gemini-embedding-001"
_EMBED_CONFIG = types.EmbedContentConfig(output_dimensionality=768)


def get_embedding(text: str) -> list[float]:
    """Return a 768-dim embedding for `text` using Gemini gemini-embedding-001."""
    result = _client.models.embed_content(
        model=_EMBED_MODEL, contents=text, config=_EMBED_CONFIG
    )
    return result.embeddings[0].values


def guide_embed_text(title: str, steps: list[dict]) -> str:
    """Canonical text representation of a guide used for embedding.

    Combines the title with every step title so similarity search matches
    both high-level intent ("set up Cloud Run") and specific actions.
    """
    step_titles = ", ".join(s.get("title", "") for s in steps if s.get("title"))
    return f"{title}. Steps: {step_titles}" if step_titles else title
