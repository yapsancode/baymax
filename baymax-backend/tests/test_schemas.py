"""Schema tests — verify Pydantic models after the models/ → schemas/ rename.

Key things tested:
  - StepResponse serialises url_pattern / advance_on_url_pattern as camelCase
    aliases (urlPattern / advanceOnUrlPattern) — the frontend reads camelCase.
  - All other schemas accept valid data without raising validation errors.

Run from baymax-backend/:  pytest tests/ -v
"""
from datetime import datetime, timezone
from uuid import uuid4

import pytest


# ── StepResponse ─────────────────────────────────────────────────────────────

class TestStepResponse:
    def _make_step(self, **overrides):
        from schemas.step import StepResponse
        defaults = dict(
            id=uuid4(),
            session_id=uuid4(),
            step_number=1,
            action="click",
            status="pending",
            created_at=datetime.now(timezone.utc),
        )
        return StepResponse(**{**defaults, **overrides})

    def test_basic_fields(self):
        step = self._make_step(title="Open console", description="Navigate to GCP")
        assert step.title == "Open console"
        assert step.status == "pending"

    def test_optional_fields_default_to_none(self):
        step = self._make_step()
        assert step.url_pattern is None
        assert step.advance_on_url_pattern is None
        assert step.selector is None

    def test_camel_case_serialisation(self):
        """url_pattern must appear as urlPattern in the serialised output."""
        step = self._make_step(
            url_pattern="https://console.cloud.google.com/*",
            advance_on_url_pattern="https://console.cloud.google.com/sql*",
        )
        data = step.model_dump(by_alias=True)
        assert "urlPattern" in data, "Expected 'urlPattern' key in serialised output"
        assert "advanceOnUrlPattern" in data, "Expected 'advanceOnUrlPattern' key"
        # snake_case keys must NOT appear when by_alias=True
        assert "url_pattern" not in data
        assert "advance_on_url_pattern" not in data

    def test_camel_case_values_correct(self):
        step = self._make_step(
            url_pattern="https://console.cloud.google.com/*",
            advance_on_url_pattern="https://console.cloud.google.com/sql*",
        )
        data = step.model_dump(by_alias=True)
        assert data["urlPattern"] == "https://console.cloud.google.com/*"
        assert data["advanceOnUrlPattern"] == "https://console.cloud.google.com/sql*"

    def test_from_attributes_config_present(self):
        """model_config must include from_attributes so SQLAlchemy rows convert cleanly."""
        from schemas.step import StepResponse
        cfg = StepResponse.model_config
        assert cfg.get("from_attributes") is True


# ── SessionResponse ───────────────────────────────────────────────────────────

class TestSessionResponse:
    def test_basic_instantiation(self):
        from schemas.session import SessionResponse
        now = datetime.now(timezone.utc)
        s = SessionResponse(
            id=uuid4(),
            user_id=uuid4(),
            title="My session",
            status="in_progress",
            created_at=now,
            updated_at=now,
        )
        assert s.title == "My session"

    def test_from_attributes_config_present(self):
        from schemas.session import SessionResponse
        assert SessionResponse.model_config.get("from_attributes") is True


# ── SessionCreate ─────────────────────────────────────────────────────────────

class TestSessionCreate:
    def test_requires_title(self):
        from schemas.session import SessionCreate
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            SessionCreate()  # title is required

    def test_valid(self):
        from schemas.session import SessionCreate
        s = SessionCreate(title="Deploy Cloud Run")
        assert s.title == "Deploy Cloud Run"


# ── StepStatusUpdate ─────────────────────────────────────────────────────────

class TestStepStatusUpdate:
    def test_valid(self):
        from schemas.step import StepStatusUpdate
        u = StepStatusUpdate(status="completed")
        assert u.status == "completed"


# ── GuideCreate / GuideSummary ────────────────────────────────────────────────

class TestGuideSchemas:
    def test_guide_create(self):
        from schemas.guide import GuideCreate
        g = GuideCreate(title="My guide", steps=[{"action": "click"}])
        assert g.title == "My guide"
        assert len(g.steps) == 1

    def test_guide_summary(self):
        from schemas.guide import GuideSummary
        now = datetime.now(timezone.utc)
        s = GuideSummary(
            id=uuid4(),
            user_id=uuid4(),
            title="My guide",
            step_count=5,
            created_at=now,
            updated_at=now,
        )
        assert s.step_count == 5


# ── Auth schemas ──────────────────────────────────────────────────────────────

class TestAuthSchemas:
    def test_register_request(self):
        from schemas.auth import RegisterRequest
        r = RegisterRequest(email="test@example.com", password="secret123", name="Alice")
        assert r.email == "test@example.com"

    def test_login_request(self):
        from schemas.auth import LoginRequest
        r = LoginRequest(email="test@example.com", password="secret123")
        assert r.password == "secret123"

    def test_auth_response(self):
        from schemas.auth import AuthResponse
        r = AuthResponse(access_token="abc.def.ghi", user_id="some-uuid")
        assert r.access_token == "abc.def.ghi"


# ── ChatRequest (page-aware chat) ─────────────────────────────────────────────

class TestChatRequest:
    def test_minimal_valid(self):
        from schemas.chat import ChatRequest
        r = ChatRequest(message="hi")
        assert r.message == "hi"
        # The page-aware fields are optional and default to None.
        assert r.page_context is None
        assert r.screenshot is None

    def test_message_required_and_nonempty(self):
        from schemas.chat import ChatRequest
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            ChatRequest(message="")  # min_length=1

    def test_page_context_and_screenshot_accepted(self):
        from schemas.chat import ChatRequest
        r = ChatRequest(
            message="what does this graph mean",
            page_context="Page: Cloud Run\nURL: https://console.cloud.google.com/run",
            screenshot="data:image/jpeg;base64,/9j/xyz",
        )
        assert r.page_context.startswith("Page:")
        assert r.screenshot.startswith("data:image/")

    def test_screenshot_must_be_image_data_url(self):
        from schemas.chat import ChatRequest
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            ChatRequest(message="hi", screenshot="https://evil.example/pixel.png")

    def test_oversized_fields_rejected(self):
        from schemas.chat import ChatRequest
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            ChatRequest(message="hi", page_context="x" * 4001)
        with pytest.raises(pydantic.ValidationError):
            ChatRequest(message="hi", screenshot="data:image/jpeg;base64," + "A" * 2_000_001)


# ── seed data ─────────────────────────────────────────────────────────────────

class TestSeedGuides:
    def test_cloud_sql_guide_structure(self):
        from data.seed_guides import CLOUD_SQL_POSTGRES_GUIDE
        assert "steps" in CLOUD_SQL_POSTGRES_GUIDE
        steps = CLOUD_SQL_POSTGRES_GUIDE["steps"]
        assert len(steps) > 0

    def test_each_step_has_required_fields(self):
        from data.seed_guides import CLOUD_SQL_POSTGRES_GUIDE
        for i, step in enumerate(CLOUD_SQL_POSTGRES_GUIDE["steps"]):
            assert "step_number" in step, f"step[{i}] missing step_number"
            assert "action" in step, f"step[{i}] missing action"
