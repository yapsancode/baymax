"""Central application configuration.

One typed place for every environment variable. Loaded once from .env at import
time. Import `settings` anywhere instead of calling os.getenv / load_dotenv.

Two distinct URLs (don't mix them up):
  - DATABASE_URL  → Postgres connection string, used by SQLAlchemy in database.py
  - SUPABASE_URL  → https project API URL, used by the supabase client and JWT
                    verification in services/auth_service.py
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # extra="ignore" — tolerate env vars we don't declare (e.g. future keys)
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Database (Postgres connection string for SQLAlchemy) ---
    DATABASE_URL: str | None = None

    # --- Supabase (API URL + keys for the supabase client & JWT verification) ---
    SUPABASE_URL: str | None = None
    SUPABASE_SECRET_KEY: str | None = None
    SUPABASE_JWKS_URL: str | None = None
    SUPABASE_PUBLISHABLE_KEY: str | None = None

    # --- AI ---
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_FALLBACK_MODELS: str = "gemini-2.5-flash-lite,gemini-2.5-pro"

    # --- Text-to-speech (Gemini TTS voice guide — the "Baymax voice") ---
    # Preview model ids change; if this one 404s, check AI Studio for the
    # current TTS model and override via .env.
    TTS_MODEL: str = "gemini-3.1-flash-tts-preview"
    TTS_VOICE: str = "Alnilam"
    TTS_STYLE_PROMPT: str = (
        "Speak normal but very calmly, in a gentle, even, slightly flat tone, "
        "like a soft-spoken robotic healthcare companion. "
        "Pause briefly between sentences. Say the following:"
    )

    # --- Observability (LangSmith tracing) ---
    # Off by default. Set LANGSMITH_TRACING=true + LANGSMITH_API_KEY in .env to
    # trace every LangChain call (prompts, completions, tool calls, latency,
    # errors) at smith.langchain.com. observability.py bridges these to the
    # env vars the langsmith SDK reads.
    LANGSMITH_TRACING: bool = False
    LANGSMITH_API_KEY: str | None = None
    LANGSMITH_PROJECT: str = "baymax"
    LANGSMITH_ENDPOINT: str = "https://api.smith.langchain.com"

    # --- CORS (comma-separated origins, e.g. chrome-extension://<id>,http://localhost:5173) ---
    ALLOWED_ORIGINS: str = "*"

    # --- Rate limiting (slowapi syntax, e.g. "20/minute", "100/hour") ---
    # Applied per authenticated user on /chat to cap Gemini quota burn.
    CHAT_RATE_LIMIT: str = "20/minute"
    # Applied per client IP on the public /guidance/repair (no auth to key on).
    # Higher than chat: repair can legitimately fire several times mid-guide.
    GUIDANCE_RATE_LIMIT: str = "30/minute"
    # Applied per client IP on the public /tts. One call per NEW step text
    # (the frontend caches audio), so a normal guide stays well under this.
    TTS_RATE_LIMIT: str = "30/minute"
    # Applied per client IP on the public /guidance/refine. Fires once per
    # finished recording (plus manual retries) and each call is a whole guide
    # through Gemini, so keep it tight.
    REFINE_RATE_LIMIT: str = "5/minute"
    # Applied per authenticated user on POST /feedback and /feedback/completion.
    # Generous — a thumbs-down per step plus one completion report per guide
    # run stays well under this even for a long guide.
    FEEDBACK_RATE_LIMIT: str = "30/minute"

    # /guidance/refine: set false to skip the live Google-Search lookup of the
    # official GCP docs (stage 1) and rely on the model's built-in knowledge —
    # halves latency/quota if grounding misbehaves. Stage 1 is best-effort
    # either way: any failure degrades to no docs context, never an error.
    REFINE_SEARCH_GROUNDING: bool = True

    # --- Google OAuth (reserved; not yet read by code) ---
    CLIENT_ID: str | None = None
    CLIENT_SECRET: str | None = None


# Single shared instance — import this, not the class.
settings = Settings()
