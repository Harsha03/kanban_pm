from pathlib import Path
import json
import sys
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.app import ai
from backend.app.main import app


def test_ai_status_disabled_without_key(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    with TestClient(app) as client:
        response = client.get("/api/ai/status")
        assert response.status_code == 200
        assert response.json() == {"enabled": False}

        test_response = client.get("/api/ai/test")
        assert test_response.status_code == 503
        assert test_response.json() == {
            "detail": "AI is disabled because OPENROUTER_API_KEY is not set."
        }


def test_ai_connectivity_success_with_mocked_provider(
    monkeypatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    fake_response = MagicMock()
    fake_response.read.return_value = json.dumps(
        {"choices": [{"message": {"content": "4"}}]}
    ).encode("utf-8")
    fake_context_manager = MagicMock()
    fake_context_manager.__enter__.return_value = fake_response
    fake_context_manager.__exit__.return_value = False

    captured = {}

    def fake_urlopen(request, timeout=30):
        captured["timeout"] = timeout
        captured["url"] = request.full_url
        captured["headers"] = dict(request.header_items())
        captured["body"] = json.loads(request.data.decode("utf-8"))
        return fake_context_manager

    monkeypatch.setattr(ai, "urlopen", fake_urlopen)

    with TestClient(app) as client:
        status_response = client.get("/api/ai/status")
        assert status_response.status_code == 200
        assert status_response.json() == {"enabled": True}

        response = client.get("/api/ai/test")
        assert response.status_code == 200
        assert response.json()["answer"] == "4"
        assert response.json()["model"] == "anthropic/claude-sonnet-4.6"

    assert captured["url"] == "https://openrouter.ai/api/v1/chat/completions"
    assert captured["timeout"] == 30
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["body"]["model"] == "anthropic/claude-sonnet-4.6"
    assert captured["body"]["messages"][1]["content"] == "What is 2+2? Reply with just the number."
