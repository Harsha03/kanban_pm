"""Tests for card comments, labels, due dates, and board statistics."""

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


def _get_default_board(client, token):
    boards = client.get("/api/boards", headers=_auth_header(token)).json()
    board_id = boards[0]["id"]
    return board_id, client.get(
        f"/api/boards/{board_id}", headers=_auth_header(token)
    ).json()["board"]


def test_comments_roundtrip(monkeypatch, tmp_path: Path) -> None:
    """Comments added to cards persist through save/load cycle."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        board_id, board = _get_default_board(client, token)

        # Add a comment to the first card
        first_card_id = list(board["cards"].keys())[0]
        board["cards"][first_card_id]["comments"] = [
            {"id": "cmt-1", "text": "Test comment", "createdAt": "2026-01-01T00:00:00Z"}
        ]

        client.put(
            f"/api/boards/{board_id}",
            json=board,
            headers=_auth_header(token),
        )

        # Reload and verify
        reloaded = client.get(
            f"/api/boards/{board_id}", headers=_auth_header(token)
        ).json()["board"]

        assert len(reloaded["cards"][first_card_id]["comments"]) == 1
        assert reloaded["cards"][first_card_id]["comments"][0]["text"] == "Test comment"


def test_labels_roundtrip(monkeypatch, tmp_path: Path) -> None:
    """Board-level labels and card labelIds persist correctly."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        board_id, board = _get_default_board(client, token)

        # Add labels to the board
        board["labels"] = [
            {"id": "lbl-1", "name": "Bug", "color": "#EF4444"},
            {"id": "lbl-2", "name": "Feature", "color": "#3B82F6"},
        ]

        # Assign label to first card
        first_card_id = list(board["cards"].keys())[0]
        board["cards"][first_card_id]["labelIds"] = ["lbl-1"]

        client.put(
            f"/api/boards/{board_id}",
            json=board,
            headers=_auth_header(token),
        )

        reloaded = client.get(
            f"/api/boards/{board_id}", headers=_auth_header(token)
        ).json()["board"]

        assert len(reloaded["labels"]) == 2
        assert reloaded["cards"][first_card_id]["labelIds"] == ["lbl-1"]


def test_due_date_roundtrip(monkeypatch, tmp_path: Path) -> None:
    """Due dates on cards persist correctly."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        board_id, board = _get_default_board(client, token)

        first_card_id = list(board["cards"].keys())[0]
        board["cards"][first_card_id]["dueDate"] = "2026-04-15"

        client.put(
            f"/api/boards/{board_id}",
            json=board,
            headers=_auth_header(token),
        )

        reloaded = client.get(
            f"/api/boards/{board_id}", headers=_auth_header(token)
        ).json()["board"]

        assert reloaded["cards"][first_card_id]["dueDate"] == "2026-04-15"


def test_column_reorder_persists(monkeypatch, tmp_path: Path) -> None:
    """Reordered columns persist correctly."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        board_id, board = _get_default_board(client, token)

        original_first_title = board["columns"][0]["title"]
        original_second_title = board["columns"][1]["title"]

        # Swap first two columns
        board["columns"][0], board["columns"][1] = board["columns"][1], board["columns"][0]

        client.put(
            f"/api/boards/{board_id}",
            json=board,
            headers=_auth_header(token),
        )

        reloaded = client.get(
            f"/api/boards/{board_id}", headers=_auth_header(token)
        ).json()["board"]

        assert reloaded["columns"][0]["title"] == original_second_title
        assert reloaded["columns"][1]["title"] == original_first_title


def test_multiple_comments_on_card(monkeypatch, tmp_path: Path) -> None:
    """Multiple comments can be added and retrieved."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        board_id, board = _get_default_board(client, token)

        first_card_id = list(board["cards"].keys())[0]
        board["cards"][first_card_id]["comments"] = [
            {"id": "cmt-1", "text": "First comment", "createdAt": "2026-01-01T00:00:00Z"},
            {"id": "cmt-2", "text": "Second comment", "createdAt": "2026-01-02T00:00:00Z"},
            {"id": "cmt-3", "text": "Third comment", "createdAt": "2026-01-03T00:00:00Z"},
        ]

        client.put(
            f"/api/boards/{board_id}",
            json=board,
            headers=_auth_header(token),
        )

        reloaded = client.get(
            f"/api/boards/{board_id}", headers=_auth_header(token)
        ).json()["board"]

        assert len(reloaded["cards"][first_card_id]["comments"]) == 3


def test_card_with_all_fields(monkeypatch, tmp_path: Path) -> None:
    """A card with all fields populated persists correctly."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        board_id, board = _get_default_board(client, token)

        board["labels"] = [{"id": "lbl-urgent", "name": "Urgent", "color": "#EF4444"}]

        first_card_id = list(board["cards"].keys())[0]
        board["cards"][first_card_id].update({
            "title": "Full card",
            "details": "Complete card with all fields",
            "priority": "critical",
            "dueDate": "2026-05-01",
            "labelIds": ["lbl-urgent"],
            "comments": [
                {"id": "cmt-1", "text": "Important", "createdAt": "2026-04-08T12:00:00Z"}
            ],
        })

        resp = client.put(
            f"/api/boards/{board_id}",
            json=board,
            headers=_auth_header(token),
        )
        assert resp.status_code == 200

        reloaded = client.get(
            f"/api/boards/{board_id}", headers=_auth_header(token)
        ).json()["board"]

        card = reloaded["cards"][first_card_id]
        assert card["title"] == "Full card"
        assert card["priority"] == "critical"
        assert card["dueDate"] == "2026-05-01"
        assert card["labelIds"] == ["lbl-urgent"]
        assert len(card["comments"]) == 1
