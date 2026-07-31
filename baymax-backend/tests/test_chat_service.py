"""Tests for the page-aware chat service (services/chat_service.py).

No real Gemini calls: `_text_llm` is swapped for a fake that captures the exact
message list it's asked to stream, and `get_embedding` / `search_guides` are
stubbed. What we pin down:
  - a page-directed question ("...this graph") skips the vector guide search,
    even when it also contains an action word — so it can never return a guide
    card instead of an answer;
  - a plain action message still uses the guide search (positive control);
  - a screenshot produces a multimodal HumanMessage (text + image_url parts);
  - no screenshot produces a plain-string HumanMessage;
  - page_context is placed ahead of the user's words in the final turn;
  - "{braces}" in history no longer crash prompt building (the old
    ChatPromptTemplate.from_messages path treated them as template variables).

Run from baymax-backend/:  pytest tests/ -v
"""


class _FakeChunk:
    """Minimal stand-in for a LangChain message chunk: has `.content` and adds."""

    def __init__(self, content):
        self.content = content

    def __add__(self, other):
        return _FakeChunk(self.content + other.content)


class _FakeLLM:
    """Captures the message list passed to .stream() and yields two chunks."""

    def __init__(self):
        self.captured_messages = None

    def with_config(self, **_kwargs):
        return self

    def stream(self, messages):
        self.captured_messages = messages
        yield _FakeChunk("Answer ")
        yield _FakeChunk("text")


def _install_fake_llm(monkeypatch):
    from services import chat_service

    fake = _FakeLLM()
    monkeypatch.setattr(chat_service, "_text_llm", fake)
    return chat_service, fake


def _finals(outputs):
    return [payload for kind, payload in outputs if kind == "final"]


# ── the deictic guard: page questions never hit the guide search ─────────────


class TestGuideSearchGuard:
    def _track_embedding(self, monkeypatch, chat_service):
        calls = {"embedded": False}

        def track(_text):
            calls["embedded"] = True
            return [0.0] * 768

        monkeypatch.setattr(chat_service, "get_embedding", track)
        # Never actually query the DB with the dummy handle.
        monkeypatch.setattr(chat_service.db_call, "search_guides", lambda *a, **k: [])
        return calls

    def test_page_question_skips_search(self, monkeypatch):
        chat_service, _fake = _install_fake_llm(monkeypatch)
        calls = self._track_embedding(monkeypatch, chat_service)
        # "help me" is an action word AND "this graph" is deictic — the guard
        # must win so the search is skipped.
        list(chat_service.stream_reply("help me understand this graph", db=object()))
        assert calls["embedded"] is False

    def test_plain_action_uses_search(self, monkeypatch):
        chat_service, _fake = _install_fake_llm(monkeypatch)
        calls = self._track_embedding(monkeypatch, chat_service)
        list(chat_service.stream_reply("help me deploy a cloud run service", db=object()))
        assert calls["embedded"] is True


# ── multimodal message construction ──────────────────────────────────────────


class TestMultimodalMessage:
    def test_screenshot_produces_image_part(self, monkeypatch):
        from langchain_core.messages import HumanMessage

        chat_service, fake = _install_fake_llm(monkeypatch)
        list(
            chat_service.stream_reply(
                "what does this graph mean",
                page_context="Page: Cloud Run metrics",
                screenshot="data:image/jpeg;base64,/9j/abc",
            )
        )
        human = fake.captured_messages[-1]
        assert isinstance(human, HumanMessage)
        assert isinstance(human.content, list)
        types = [part.get("type") for part in human.content]
        assert "text" in types and "image_url" in types
        image_part = next(p for p in human.content if p.get("type") == "image_url")
        assert image_part["image_url"] == {"url": "data:image/jpeg;base64,/9j/abc"}

    def test_no_screenshot_is_plain_text(self, monkeypatch):
        chat_service, fake = _install_fake_llm(monkeypatch)
        list(chat_service.stream_reply("what does this page do"))
        human = fake.captured_messages[-1]
        assert isinstance(human.content, str)

    def test_page_context_precedes_user_words(self, monkeypatch):
        chat_service, fake = _install_fake_llm(monkeypatch)
        list(
            chat_service.stream_reply(
                "what is this",
                page_context="Page: Cloud SQL instances",
            )
        )
        text = fake.captured_messages[-1].content
        assert "Cloud SQL instances" in text
        assert text.index("Cloud SQL instances") < text.index("what is this")


# ── the braces regression ────────────────────────────────────────────────────


class TestBracesInHistory:
    def test_braces_do_not_crash(self, monkeypatch):
        from schemas.chat import ChatMessage

        chat_service, _fake = _install_fake_llm(monkeypatch)
        history = [
            ChatMessage(role="user", content="what about the {region} field?"),
            ChatMessage(role="assistant", content="Set it to {your-region}."),
        ]
        outputs = list(chat_service.stream_reply("thanks", history=history))
        # A final frame means we built the messages and streamed without a
        # template KeyError/ValueError on the braces.
        assert _finals(outputs)
