"""Tests for the guide-refinement endpoint (POST /guidance/refine).

No LLM calls here — what makes /refine safe is pure Python, and that's what we
pin down:
  - _merge copies ONLY title/description onto the recorded steps (technical
    metadata, count, and order survive verbatim, whatever the model returned).
  - _format_steps masks parameter values so secrets never reach the prompt.
  - the route is registered and the schemas default sanely.

Run from baymax-backend/:  pytest tests/ -v
"""


def _recorded_steps():
    """A miniature recorded guide with the rich frontend intent shape."""
    return [
        {
            "id": 1,
            "title": "Deploy container",
            "description": 'Click "Deploy container".',
            "action": "click",
            "role": "button",
            "name": "Deploy container",
            "selector": "#deploy > button.mat-primary",
            "url": "https://console.cloud.google.com/run",
            "urlPattern": "console\\.cloud\\.google\\.com/run",
        },
        {
            "id": 2,
            "title": "Service name",
            "description": 'Enter a value for "Service name".',
            "action": "fill",
            "role": "textbox",
            "name": "Service name",
            "value": "",
            "isParameter": True,
        },
    ]


# ── _merge: the recording is preserved by construction ───────────────────────


class TestMerge:
    def _merge(self, originals, refined):
        from services.refine_service import _merge

        return _merge(originals, refined)

    def _step_text(self, **kwargs):
        from services.refine_service import _StepText

        return _StepText(**kwargs)

    def test_rewrites_only_title_and_description(self):
        originals = _recorded_steps()
        refined = [
            self._step_text(
                index=0,
                title="Start deploying a container",
                description="Click Deploy container to begin creating a service.",
            )
        ]
        merged = self._merge(originals, refined)

        assert merged[0]["title"] == "Start deploying a container"
        assert merged[0]["description"] == "Click Deploy container to begin creating a service."
        # Every technical field survives verbatim.
        for key in ("id", "action", "role", "name", "selector", "url", "urlPattern"):
            assert merged[0][key] == originals[0][key]

    def test_count_and_order_preserved(self):
        originals = _recorded_steps()
        merged = self._merge(originals, [])
        assert len(merged) == len(originals)
        assert [s["id"] for s in merged] == [1, 2]

    def test_out_of_range_indexes_ignored(self):
        originals = _recorded_steps()
        refined = [
            self._step_text(index=5, title="Ghost step", description="Should be dropped."),
            self._step_text(index=-1, title="Ghost step", description="Should be dropped."),
        ]
        merged = self._merge(originals, refined)
        assert merged[0]["title"] == "Deploy container"
        assert merged[1]["title"] == "Service name"

    def test_empty_strings_do_not_clobber(self):
        originals = _recorded_steps()
        refined = [self._step_text(index=0, title="  ", description="")]
        merged = self._merge(originals, refined)
        assert merged[0]["title"] == "Deploy container"
        assert merged[0]["description"] == 'Click "Deploy container".'

    def test_originals_not_mutated(self):
        originals = _recorded_steps()
        self._merge(originals, [self._step_text(index=0, title="New", description="New.")])
        assert originals[0]["title"] == "Deploy container"


# ── _format_steps: what the model gets to see ────────────────────────────────


class TestFormatSteps:
    def test_parameter_values_masked(self):
        from services.refine_service import _format_steps

        steps = _recorded_steps()
        steps[1]["value"] = "hunter2"  # would be a secret if the client sent one
        text = _format_steps(steps)
        assert "hunter2" not in text
        assert "<user-provided parameter>" in text

    def test_selectors_left_out(self):
        """CSS noise doesn't help a writer — identity fields do."""
        from services.refine_service import _format_steps

        text = _format_steps(_recorded_steps())
        assert "mat-primary" not in text
        assert 'name="Deploy container"' in text
        assert "[0]" in text and "[1]" in text


# ── schemas + route registration ─────────────────────────────────────────────


class TestRefineShapes:
    def test_request_defaults(self):
        from schemas.guidance import RefineRequest

        req = RefineRequest()
        assert req.title == ""
        assert req.steps == []

    def test_request_ignores_extra_keys(self):
        """buildGuide() sends {id, title, steps} — the extra id must not 422."""
        from schemas.guidance import RefineRequest

        req = RefineRequest(id="recorded-my-guide", title="t", steps=[{"a": 1}])
        assert req.steps == [{"a": 1}]

    def test_response_failure_shape(self):
        from schemas.guidance import RefineResponse

        res = RefineResponse(ok=False)
        assert res.steps == [] and res.title == "" and res.summary == ""

    def test_route_registered(self):
        from main import app

        assert "/guidance/refine" in app.openapi()["paths"]


class TestRefineGuards:
    def test_empty_and_oversized_recordings_refused(self, monkeypatch):
        """No LLM call should even be attempted for garbage input."""
        from types import SimpleNamespace

        from schemas.guidance import RefineRequest
        from services import refine_service

        def boom(*a, **k):  # fails the test if any model call is attempted
            raise AssertionError("LLM should not be called")

        monkeypatch.setattr(refine_service, "_lookup_docs", boom)
        # Runnables are pydantic objects (attrs frozen) — swap the module global.
        monkeypatch.setattr(refine_service, "_chain", SimpleNamespace(invoke=boom))

        empty = refine_service.refine_guide(RefineRequest(title="t", steps=[]))
        assert empty.ok is False

        huge = RefineRequest(title="t", steps=[{"action": "click"}] * 61)
        assert refine_service.refine_guide(huge).ok is False
