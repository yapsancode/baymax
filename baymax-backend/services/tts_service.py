"""Text-to-speech service: Gemini TTS renders step text in the Baymax voice.

External call (Gemini) -> lives in services/, per the four-layers rule.

NOTE on the LangChain rule: this calls the Gemini REST API directly via httpx.
LangChain has no support for Gemini's AUDIO response modality (the TTS models),
so the "orchestrate Gemini through LangChain" rule cannot apply here.

The model returns raw 16-bit mono PCM (base64, sample rate in the part's
mimeType). Browsers can't play bare PCM, so we prepend a WAV header before
returning the bytes.

Voice character is configuration, not code: the voice name (Alnilam) and the
style instruction live in Settings (TTS_VOICE / TTS_STYLE_PROMPT), matching
what was auditioned in AI Studio.
"""

import base64
import struct

import httpx

from config import settings

_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

_DEFAULT_SAMPLE_RATE = 24000


def _sample_rate(mime_type: str) -> int:
    """Parse the rate out of e.g. "audio/L16;codec=pcm;rate=24000"."""
    for part in mime_type.split(";"):
        part = part.strip()
        if part.startswith("rate="):
            try:
                return int(part.removeprefix("rate="))
            except ValueError:
                break
    return _DEFAULT_SAMPLE_RATE


def _pcm_to_wav(pcm: bytes, sample_rate: int) -> bytes:
    """Wrap raw 16-bit mono PCM in a minimal WAV header so browsers can play it."""
    return (
        struct.pack(
            "<4sI4s4sIHHIIHH4sI",
            b"RIFF",
            36 + len(pcm),
            b"WAVE",
            b"fmt ",
            16,  # fmt chunk size
            1,  # PCM
            1,  # mono
            sample_rate,
            sample_rate * 2,  # byte rate (16-bit mono)
            2,  # block align
            16,  # bits per sample
            b"data",
            len(pcm),
        )
        + pcm
    )


def synthesize(text: str) -> bytes | None:
    """Return WAV bytes speaking `text`, or None on any failure.

    None (not an exception) so the router can 502 and the frontend falls back
    to the browser voice — a broken TTS call must never break the guide.
    """
    payload = {
        "contents": [{"parts": [{"text": f"{settings.TTS_STYLE_PROMPT}\n\n{text}"}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": settings.TTS_VOICE}}
            },
        },
    }

    try:
        resp = httpx.post(
            _API_URL.format(model=settings.TTS_MODEL),
            params={"key": settings.GEMINI_API_KEY},
            json=payload,
            timeout=30.0,
        )
        resp.raise_for_status()
        part = resp.json()["candidates"][0]["content"]["parts"][0]["inlineData"]
        pcm = base64.b64decode(part["data"])
        return _pcm_to_wav(pcm, _sample_rate(part.get("mimeType", "")))
    except Exception as exc:  # network/model/shape error — caller falls back
        print(f"[tts] synthesis failed: {exc}")
        return None
