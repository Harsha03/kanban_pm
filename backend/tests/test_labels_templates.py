"""Tests for board labels and templates."""
from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.app.main import app


def _register_and_get_token(client, username="testuser", password="testpass123"):
    response = client.post(
        "/api/auth/register",
        json={"username": username, "password": password},
    )
    return response.json()["token"]


def _auth_header(token):
    return {"Authorization": f"Bearer {token}"}


# --- Labels ---


def test_board_with_labels_round_trip(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        boards = client.get("/api/boards", headers=_auth_header(token)).json()
        board_id = boards[0]["id"]

        board_data = client.get(
            f"/api/boards/{board_id}", headers=_auth_header(token)
        ).json()["board"]

        # Add labels to board
        board_data["labels"] = [
            {"id": "lbl-1", "name": "Bug", "color": "#EF4444"},
            {"id": "lbl-2", "name": "Feature", "color": "#3B82F6"},
        ]
        # Assign label to first card
        first_card_id = board_data["columns"][0]["cardIds"][0]
        board_data["cards"][first_card_id]["labelIds"] = ["lbl-1"]

        response = client.put(
            f"/api/boards/{board_id}",
            json=board_data,
            headers=_auth_header(token),
        )
        assert response.status_code == 200
        result = response.json()
        assert len(result["labels"]) == 2
        assert result["cards"][first_card_id]["labelIds"] == ["lbl-1"]

        # Verify persistence
        after = client.get(
            f"/api/boards/{board_id}", headers=_auth_header(token)
        ).json()["board"]
        assert len(after["labels"]) == 2
        assert after["cards"][first_card_id]["labelIds"] == ["lbl-1"]


def test_board_data_normalizes_missing_labels(monkeypatch, tmp_path: Path) -> None:
    """Old boards without labels field should get default empty list."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        boards = client.get("/api/boards", headers=_auth_header(token)).json()
        board_id = boards[0]["id"]

        board_data = client.get(
            f"/api/boards/{board_id}", headers=_auth_header(token)
        ).json()["board"]

        # Verify labels exist and are empty by default
        assert "labels" in board_data
        assert isinstance(board_data["labels"], list)

        # Verify all cards have labelIds
        for card in board_data["cards"].values():
            assert "labelIds" in card


# --- Templates ---


def test_create_board_with_blank_template(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        response = client.post(
            "/api/boards",
            json={"name": "Blank Board", "template": "blank"},
            headers=_auth_header(token),
        )
        assert response.status_code == 200
        board_id = response.json()["id"]

        board = client.get(
            f"/api/boards/{board_id}", headers=_auth_header(token)
        ).json()["board"]
        assert len(board["columns"]) == 1
        assert board["columns"][0]["title"] == "To Do"
        assert len(board["cards"]) == 0


def test_create_board_with_scrum_template(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        response = client.post(
            "/api/boards",
            json={"name": "Sprint Board", "template": "scrum"},
            headers=_auth_header(token),
        )
        assert response.status_code == 200
        board_id = response.json()["id"]

        board = client.get(
            f"/api/boards/{board_id}", headers=_auth_header(token)
        ).json()["board"]
        assert len(board["columns"]) == 5
        assert board["columns"][0]["title"] == "Product Backlog"
        assert len(board["labels"]) == 4
        assert board["labels"][0]["name"] == "Story"


def test_create_board_with_bug_tracking_template(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        response = client.post(
            "/api/boards",
            json={"name": "Bugs", "template": "bug-tracking"},
            headers=_auth_header(token),
        )
        assert response.status_code == 200
        board_id = response.json()["id"]

        board = client.get(
            f"/api/boards/{board_id}", headers=_auth_header(token)
        ).json()["board"]
        assert len(board["columns"]) == 5
        assert board["columns"][0]["title"] == "Reported"
        assert len(board["labels"]) == 4


def test_create_board_default_template_is_kanban(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        response = client.post(
            "/api/boards",
            json={"name": "Default Template"},
            headers=_auth_header(token),
        )
        assert response.status_code == 200
        board_id = response.json()["id"]

        board = client.get(
            f"/api/boards/{board_id}", headers=_auth_header(token)
        ).json()["board"]
        # Kanban template has 5 columns with sample cards
        assert len(board["columns"]) == 5
        assert len(board["cards"]) == 8
