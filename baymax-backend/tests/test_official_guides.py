"""RAG + schema tests — recipe matching, ChatResponse types, guide schemas.

No database or Gemini needed: the matcher is a pure function and the schema
checks are in-memory. DB visibility rules (own-or-official reads, owner-only
delete) live in db_call and need a real session, so they are exercised in the
live end-to-end pass instead.

Run from baymax-backend/:  pytest tests/ -v
"""
from datetime import datetime, timezone
from uuid import uuid4

import pytest


# ── RAG recipe matching ──────────────────────────────────────────────────────

class TestRAGMatch:
    """Test the keyword-based recipe matcher in services/rag_service.py."""

    def test_action_plus_keyword_matches(self):
        from services.rag_service import match_recipe
        r = match_recipe("help me deploy to cloud run")
        assert r is not None
        assert r["id"] == "gcp-deploy-cloud-run-container-service"

    def test_conceptual_question_does_not_match(self):
        """'What is Cloud Run?' has the keyword but no action word — must not
        trigger a RAG match (Option C: text fallback instead)."""
        from services.rag_service import match_recipe
        assert match_recipe("what is cloud run?") is None

    def test_no_match_for_unknown_topic(self):
        from services.rag_service import match_recipe
        assert match_recipe("deploy my flask app somewhere") is None
        assert match_recipe("help me set up a load balancer") is None

    def test_case_insensitive(self):
        from services.rag_service import match_recipe
        r = match_recipe("How To Do Cloud Run Deployment")
        assert r is not None
        assert r["id"] == "gcp-deploy-cloud-run-container-service"

    def test_all_five_recipes_matchable(self):
        from services.rag_service import match_recipe
        cases = [
            ("deploy cloud run", "gcp-deploy-cloud-run-container-service"),
            ("create a storage bucket", "gcp-create-cloud-storage-bucket"),
            ("set up postgres database", "gcp-create-cloud-sql-postgres-instance"),
            ("spin up a compute engine vm", "gcp-create-compute-engine-vm-instance"),
            ("make a service account with json key", "gcp-create-service-account-and-generate-key"),
        ]
        for message, expected_id in cases:
            r = match_recipe(message)
            assert r is not None, f"No match for: {message}"
            assert r["id"] == expected_id, f"Wrong match for: {message}"

    def test_empty_input_returns_none(self):
        from services.rag_service import match_recipe
        assert match_recipe("") is None
        assert match_recipe("   ") is None


# ── ChatResponse types ───────────────────────────────────────────────────────

class TestChatResponseType:
    def test_text_type_accepted(self):
        from schemas.chat import ChatResponse
        r = ChatResponse(type="text", data="hello")
        assert r.type == "text"

    def test_blueprint_json_type_accepted(self):
        from schemas.chat import ChatResponse
        r = ChatResponse(type="blueprint_json", message="Start!", data={"id": "x", "title": "t", "steps": []})
        assert r.type == "blueprint_json"

    def test_unknown_type_rejected(self):
        import pydantic
        from schemas.chat import ChatResponse
        with pytest.raises(pydantic.ValidationError):
            ChatResponse(type="totally_new_mode", data="x")


# ── RAG schema shapes ────────────────────────────────────────────────────────

class TestRAGSchemas:
    def test_navigation_step_defaults(self):
        from schemas.chat import NavigationStep
        s = NavigationStep(id=1, title="t", description="d", action="click", selector="div")
        assert s.isParameter is False
        assert s.value == ""
        assert s.role is None

    def test_final_navigation_payload_round_trip(self):
        from schemas.chat import FinalNavigationPayload, NavigationStep
        steps = [
            NavigationStep(id=1, title="Search", description="Type", action="fill",
                           selector="input#q", value="cloudrun", isParameter=True),
            NavigationStep(id=2, title="Click", description="Click result", action="click",
                           selector="a.result"),
        ]
        p = FinalNavigationPayload(id="gcp-test", title="Test Guide", steps=steps)
        dumped = p.model_dump(mode="json")
        assert len(dumped["steps"]) == 2
        assert dumped["steps"][0]["isParameter"] is True
        assert dumped["steps"][1]["isParameter"] is False


# ── Guide schemas carry is_official + meta ───────────────────────────────────

class TestGuideSchemaFields:
    def test_summary_defaults(self):
        from schemas.guide import GuideSummary
        now = datetime.now(timezone.utc)
        s = GuideSummary(
            id=uuid4(), title="g", step_count=1, created_at=now, updated_at=now
        )
        assert s.is_official is False
        assert s.meta is None

    def test_response_round_trips_meta(self):
        from schemas.guide import GuideResponse
        now = datetime.now(timezone.utc)
        meta = {"task": "backend", "keywords": ["cloud run"], "nextSteps": ["a"]}
        r = GuideResponse(
            id=uuid4(), user_id=uuid4(), title="g", steps=[{"action": "click"}],
            is_official=True, meta=meta, created_at=now, updated_at=now,
        )
        dumped = r.model_dump(mode="json")
        assert dumped["is_official"] is True
        assert dumped["meta"] == meta


# ── ORM model surface ────────────────────────────────────────────────────────

class TestGuideModel:
    def test_columns_exist(self):
        from models import Guide
        cols = {c.name for c in Guide.__table__.columns}
        assert "is_official" in cols
        assert "meta" in cols

    def test_is_official_defaults_false(self):
        from models import Guide
        col = Guide.__table__.columns["is_official"]
        assert col.nullable is False
        assert col.default.arg is False
