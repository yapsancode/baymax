import json
import logging
import time

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from rate_limit import limiter
from schemas.chat import ChatRequest, ChatResponse
from services import chat_service
from services.auth_service import get_current_user

router = APIRouter(tags=["chat"])

logger = logging.getLogger(__name__)


def _sse(payload: dict) -> str:
    """One Server-Sent-Events frame."""
    return f"data: {json.dumps(payload)}\n\n"


def _final(response: ChatResponse) -> str:
    """The closing SSE frame."""
    return _sse({"event": "final", **response.model_dump(exclude_none=True)})


@router.post("/chat")
@limiter.limit(lambda: settings.CHAT_RATE_LIMIT)
def handle_chat_message(
    request: Request,
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Unified chat endpoint, streamed as SSE. RAG-first: if the user's message
    matches a tested navigation recipe in the knowledge base, Gemini fills only
    the parameterized value fields and the complete blueprint is returned.
    Otherwise a text fallback lists the available guides.

    Conversation history is maintained within a session: the frontend sends
    prior user/assistant turns for multi-turn context.
    """
    incoming_text = body.message.strip()
    user_id = current_user["sub"]

    logger.info(
        "chat turn user=%.8s input=%r page_ctx=%s screenshot=%s",
        user_id, incoming_text[:120], bool(body.page_context), bool(body.screenshot),
    )
    started = time.perf_counter()

    def event_stream():
        try:
            reply_text, plan, plan_type = "", None, "text"
            for kind, payload in chat_service.stream_reply(
                incoming_text,
                history=body.history,
                db=db,
                context=body.context,
                page_context=body.page_context,
                screenshot=body.screenshot,
            ):
                if kind == "delta":
                    yield _sse({"event": "delta", "text": payload})
                else:
                    reply_text, plan, plan_type = payload
        except Exception:
            logger.exception("Chat generation failed")
            yield _final(ChatResponse(type="text", data="Sorry, couldn't resolve."))
            return

        elapsed = time.perf_counter() - started

        if plan is not None:
            if plan_type == "guide_match":
                logger.info(
                    "chat mode=guide_match user=%.8s title=%r steps=%d %.2fs",
                    user_id, plan.get("title"), len(plan.get("steps", [])), elapsed,
                )
                yield _final(ChatResponse(
                    type="guide_match",
                    message="I found a recorded guide for that! Start it below.",
                    data=plan,
                ))
            else:
                logger.info(
                    "chat mode=rag_blueprint user=%.8s recipe=%s steps=%d %.2fs",
                    user_id, plan.get("id"), len(plan.get("steps", [])), elapsed,
                )
                yield _final(ChatResponse(
                    type="blueprint_json",
                    message="This is a tested navigation guide. Start it below!",
                    data=plan,
                ))
            return

        logger.info("chat mode=text user=%.8s chars=%d %.2fs", user_id, len(reply_text), elapsed)
        yield _final(ChatResponse(type="text", data=reply_text))

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
