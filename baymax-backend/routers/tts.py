"""Voice guide endpoint: POST /tts.

Thin HTTP layer (per the four-layers rule) — validates the request shape and
delegates the Gemini TTS call to services/tts_service. Public route, like
/guidance/repair: it carries no user data and must keep working before sign-in.

Returns raw audio/wav bytes (not JSON) so the frontend can play the blob
directly without base64 inflation.
"""

from fastapi import APIRouter, HTTPException, Request, Response, status

from config import settings
from rate_limit import limiter
from schemas.tts import TTSRequest
from services import tts_service

router = APIRouter(prefix="/tts", tags=["tts"])


@router.post("", status_code=status.HTTP_200_OK)
@limiter.limit(lambda: settings.TTS_RATE_LIMIT)
def synthesize_speech(request: Request, body: TTSRequest):
    """Speak the given text in the Baymax voice; returns audio/wav."""
    wav = tts_service.synthesize(body.text)
    if wav is None:
        # Frontend catches this and falls back to the browser voice.
        raise HTTPException(status_code=502, detail="Speech synthesis failed.")
    return Response(content=wav, media_type="audio/wav")
