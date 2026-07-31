"""Pydantic schema for POST /tts.

Request only — the response is raw audio/wav bytes, not JSON, so there is no
response schema.
"""

from pydantic import BaseModel, Field


class TTSRequest(BaseModel):
    # Cap the length: a step announcement is a sentence or three. Anything huge
    # is a mistake (or abuse) and would burn TTS quota.
    text: str = Field(min_length=1, max_length=1200)
