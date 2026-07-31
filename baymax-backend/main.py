import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

from config import settings
from observability import setup_tracing
from rate_limit import limiter, rate_limit_handler
from routers import auth, sessions, chat, steps, guidance, guides, tts, feedback

# App-level logging: INFO so per-request lines (e.g. chat turns in
# routers/chat.py) show up in the terminal / Cloud Run logs alongside
# uvicorn's access log. Python's default would hide anything below WARNING.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

# Enable LangSmith tracing if configured (no-op otherwise).
setup_tracing()

app = FastAPI(title="Baymax API")

# Rate limiting: register the shared limiter + a friendly 429 handler. The
# per-endpoint limits live on the routes via @limiter.limit(...).
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(chat.router)
app.include_router(steps.router)
app.include_router(guidance.router)
app.include_router(guides.router)
app.include_router(tts.router)
app.include_router(feedback.router)

