from pathlib import Path
import json
import sys
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.app import ai
from backend.app.main import app


def _mock_openrouter(monkeypatch, response_content: str, captured: dict) -> None:
    fake_response = MagicMock()
    fake_response.read.return_value = json.dumps(
        {"choices": [{"message": {"content": response_content}}]}
    ).encode("utf-8")
    fake_context_manager = MagicMock()
    fake_context_manager.__enter__.return_value = fake_response
    fake_context_manager.__exit__.return_value = False

    def fake_urlopen(request, timeout=30):
        captured["timeout"] = timeout
        captured["url"] = request.full_url
        captured["headers"] = dict(request.header_items())
        captured["body"] = json.loads(request.data.decode("utf-8"))
        return fake_context_manager

    monkeypatch.setattr(ai, "urlopen", fake_urlopen)


def test_ai_chat_returns_503_when_key_missing(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    with TestClient(app) as client:
        response = client.post(
            "/api/ai/chat/user",
            json={"question": "hello", "history": []},
        )
        assert response.status_code == 503
        assert response.json() == {
            "detail": "AI is disabled because OPENROUTER_API_KEY is not set."
        }


def test_ai_chat_reply_only(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    captured: dict = {}
    _mock_openrouter(
        monkeypatch,
        '{"reply":"Done.","board_update":null}',
        captured,
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/ai/chat/user",
            json={
                "question": "Summarize the board",
                "history": [{"role": "user", "content": "Hi"}],
            },
        )
        assert response.status_code == 200
        assert response.json() == {"reply": "Done.", "board_update": None}

    assert captured["url"] == "https://openrouter.ai/api/v1/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["body"]["response_format"]["type"] == "json_object"
    assert "Current board JSON" in captured["body"]["messages"][1]["content"]
    assert "Conversation history JSON" in captured["body"]["messages"][1]["content"]
    assert "Summarize the board" in captured["body"]["messages"][1]["content"]


def test_ai_chat_applies_board_update(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    updated_board = {
        "columns": [
            {
                "id": "col-backlog",
                "title": "Updated by AI",
                "color": "#3B82F6",
                "icon": "inbox",
                "cardIds": [],
            },
            {
                "id": "col-discovery",
                "title": "Discovery",
                "color": "#8B5CF6",
                "icon": "search",
                "cardIds": [],
            },
            {
                "id": "col-progress",
                "title": "In Progress",
                "color": "#EC4899",
                "icon": "play",
                "cardIds": [],
            },
            {
                "id": "col-review",
                "title": "Review",
                "color": "#EF4444",
                "icon": "eye",
                "cardIds": [],
            },
            {
                "id": "col-done",
                "title": "Done",
                "color": "#F97316",
                "icon": "check-circle",
                "cardIds": [],
            },
        ],
        "cards": {},
    }
    _mock_openrouter(
        monkeypatch,
        json.dumps({"reply": "Updated.", "board_update": updated_board}),
        {},
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/ai/chat/user",
            json={"question": "Rename backlog", "history": []},
        )
        assert response.status_code == 200
        assert response.json()["reply"] == "Updated."
        assert response.json()["board_update"]["columns"][0]["title"] == "Updated by AI"

        board_after = client.get("/api/board/user")
        assert board_after.status_code == 200
        assert board_after.json()["columns"][0]["title"] == "Updated by AI"


def test_ai_chat_falls_back_to_plain_reply_when_structured_invalid(
    monkeypatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    _mock_openrouter(monkeypatch, "not-json", {})

    with TestClient(app) as client:
        response = client.post(
            "/api/ai/chat/user",
            json={"question": "Hi", "history": []},
        )
        assert response.status_code == 200
        assert response.json() == {"reply": "not-json", "board_update": None}


def test_ai_chat_falls_back_to_reply_when_board_update_invalid(
    monkeypatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    _mock_openrouter(
        monkeypatch,
        json.dumps({"reply": "I can help with that.", "board_update": {"bad": "shape"}}),
        {},
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/ai/chat/user",
            json={"question": "Hello", "history": []},
        )
        assert response.status_code == 200
        assert response.json() == {"reply": "I can help with that.", "board_update": None}
