from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.app.main import app


def test_bootstrap_creates_db_and_default_board(monkeypatch, tmp_path: Path) -> None:
    db_path = tmp_path / "pm.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))

    with TestClient(app) as client:
        response = client.get("/api/board/user")
        assert response.status_code == 200
        body = response.json()
        assert "columns" in body
        assert "cards" in body
        assert len(body["columns"]) == 5

    assert db_path.exists()


def test_get_board_unknown_user_returns_404(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))

    with TestClient(app) as client:
        response = client.get("/api/board/unknown-user")
        assert response.status_code == 404
        assert response.json() == {"detail": "User not found"}


def test_update_board_round_trip(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))

    with TestClient(app) as client:
        initial = client.get("/api/board/user")
        assert initial.status_code == 200
        board = initial.json()
        board["columns"][0]["title"] = "Updated Backlog"

        updated = client.put("/api/board/user", json=board)
        assert updated.status_code == 200
        assert updated.json()["columns"][0]["title"] == "Updated Backlog"

        after = client.get("/api/board/user")
        assert after.status_code == 200
        assert after.json()["columns"][0]["title"] == "Updated Backlog"


def test_update_board_rejects_invalid_payload(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))

    with TestClient(app) as client:
        response = client.put(
            "/api/board/user",
            json={"columns": "not-a-list", "cards": {}},
        )
        assert response.status_code == 422
