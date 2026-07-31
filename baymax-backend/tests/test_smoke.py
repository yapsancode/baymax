"""Smoke tests — import checks and route registration.

These tests do NOT need a running database or active external APIs.
They verify that after the models/ → schemas/ refactor:
  1. Every module can be imported without broken paths or circular imports.
  2. All six routers are mounted and expose the expected routes.

Run from baymax-backend/:  pytest tests/ -v
"""
import importlib
import pytest


# Every module that changed its import path in the refactor is listed here.
# If any of these breaks, pytest will tell you exactly which one.
MODULES = [
    # core
    "config",
    "database",
    "models",
    "db_call",
    # schemas (renamed from models/)
    "schemas.auth",
    "schemas.session",
    "schemas.step",
    "schemas.guide",
    "schemas.guidance",
    "schemas.feedback",
    # data (moved from guides.py)
    "data.seed_guides",
    # services (chat moved from chatbox_prompt.py)
    "services.auth_service",
    "services.chat_service",
    "services.guidance_service",
    "services.refine_service",
    # routers
    "routers.auth",
    "routers.sessions",
    "routers.steps",
    "routers.chat",
    "routers.guides",
    "routers.guidance",
    "routers.feedback",
    # entry point
    "main",
]


@pytest.mark.parametrize("module_path", MODULES)
def test_module_imports(module_path: str):
    """Every module must import cleanly — catches broken paths from the refactor."""
    mod = importlib.import_module(module_path)
    assert mod is not None


def test_all_expected_routes_registered():
    """The FastAPI app must expose every route we had before the refactor."""
    from main import app

    paths = set(app.openapi()["paths"].keys())

    required = {
        # auth
        "/auth/register",
        "/auth/login",
        "/auth/google",
        "/auth/logout",
        # sessions
        "/sessions",
        "/sessions/{session_id}",
        "/sessions/{session_id}/steps",
        # steps
        "/sessions/{session_id}/steps/{step_id}",
        # chat
        "/chat",
        # guides
        "/guides",
        "/guides/{guide_id}",
        # guidance / self-heal + recorded-guide refinement
        "/guidance/repair",
        "/guidance/refine",
        # feedback
        "/feedback",
        "/feedback/completion",
    }

    missing = required - paths
    assert not missing, (
        f"Routes missing from OpenAPI spec: {sorted(missing)}\n"
        f"Registered paths: {sorted(paths)}"
    )


def test_route_count():
    """Sanity guard: at least 12 distinct route paths must be registered."""
    from main import app

    paths = app.openapi()["paths"]
    assert len(paths) >= 12, (
        f"Only {len(paths)} route paths found — expected ≥ 12.\n"
        f"Registered: {sorted(paths)}"
    )
