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


def test_list_boards_returns_default_board(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        response = client.get("/api/boards", headers=_auth_header(token))
        assert response.status_code == 200
        boards = response.json()
        assert len(boards) == 1
        assert boards[0]["name"] == "My Board"


def test_create_board(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        response = client.post(
            "/api/boards",
            json={"name": "Sprint Board", "description": "For sprint tracking"},
            headers=_auth_header(token),
        )
        assert response.status_code == 200
        body = response.json()
        assert body["name"] == "Sprint Board"
        assert body["description"] == "For sprint tracking"
        assert "id" in body

        boards = client.get("/api/boards", headers=_auth_header(token)).json()
        assert len(boards) == 2


def test_get_board_by_id(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        boards = client.get("/api/boards", headers=_auth_header(token)).json()
        board_id = boards[0]["id"]

        response = client.get(
            f"/api/boards/{board_id}", headers=_auth_header(token)
        )
        assert response.status_code == 200
        body = response.json()
        assert "board" in body
        assert "columns" in body["board"]
        assert "cards" in body["board"]


def test_update_board_data(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        boards = client.get("/api/boards", headers=_auth_header(token)).json()
        board_id = boards[0]["id"]

        board_data = client.get(
            f"/api/boards/{board_id}", headers=_auth_header(token)
        ).json()["board"]

        board_data["columns"][0]["title"] = "Updated Column"
        response = client.put(
            f"/api/boards/{board_id}",
            json=board_data,
            headers=_auth_header(token),
        )
        assert response.status_code == 200
        assert response.json()["columns"][0]["title"] == "Updated Column"

        # Verify persistence
        after = client.get(
            f"/api/boards/{board_id}", headers=_auth_header(token)
        ).json()
        assert after["board"]["columns"][0]["title"] == "Updated Column"


def test_patch_board_meta(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        boards = client.get("/api/boards", headers=_auth_header(token)).json()
        board_id = boards[0]["id"]

        response = client.patch(
            f"/api/boards/{board_id}",
            json={"name": "Renamed Board", "description": "New desc"},
            headers=_auth_header(token),
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Renamed Board"

        boards_after = client.get("/api/boards", headers=_auth_header(token)).json()
        assert boards_after[0]["name"] == "Renamed Board"


def test_delete_board(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        # Create a second board so we can delete one
        client.post(
            "/api/boards",
            json={"name": "Temp Board"},
            headers=_auth_header(token),
        )
        boards = client.get("/api/boards", headers=_auth_header(token)).json()
        assert len(boards) == 2
        board_to_delete = boards[1]["id"]

        response = client.delete(
            f"/api/boards/{board_to_delete}", headers=_auth_header(token)
        )
        assert response.status_code == 200
        assert response.json()["deleted"] is True

        boards_after = client.get("/api/boards", headers=_auth_header(token)).json()
        assert len(boards_after) == 1


def test_delete_nonexistent_board_returns_404(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        response = client.delete(
            "/api/boards/99999", headers=_auth_header(token)
        )
        assert response.status_code == 404


def test_cannot_access_other_users_board(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token_a = _register_and_get_token(client, "alice", "password123")
        token_b = _register_and_get_token(client, "bob", "password123")

        alice_boards = client.get("/api/boards", headers=_auth_header(token_a)).json()
        alice_board_id = alice_boards[0]["id"]

        # Bob tries to access Alice's board
        response = client.get(
            f"/api/boards/{alice_board_id}", headers=_auth_header(token_b)
        )
        assert response.status_code == 404

        # Bob tries to update Alice's board
        response = client.put(
            f"/api/boards/{alice_board_id}",
            json={
                "columns": [
                    {
                        "id": "col-1",
                        "title": "Hacked",
                        "color": "#FF0000",
                        "icon": "inbox",
                        "cardIds": [],
                    }
                ],
                "cards": {},
            },
            headers=_auth_header(token_b),
        )
        assert response.status_code == 404

        # Bob tries to delete Alice's board
        response = client.delete(
            f"/api/boards/{alice_board_id}", headers=_auth_header(token_b)
        )
        assert response.status_code == 404


def test_boards_require_auth(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        assert client.get("/api/boards").status_code == 422
        assert client.post("/api/boards", json={"name": "Test"}).status_code == 422
        assert client.get("/api/boards/1").status_code == 422
        assert client.delete("/api/boards/1").status_code == 422


def test_create_board_validates_name(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        response = client.post(
            "/api/boards",
            json={"name": "", "description": "Empty name"},
            headers=_auth_header(token),
        )
        assert response.status_code == 422


def test_export_board(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        boards = client.get("/api/boards", headers=_auth_header(token)).json()
        board_id = boards[0]["id"]

        response = client.get(
            f"/api/boards/{board_id}/export", headers=_auth_header(token)
        )
        assert response.status_code == 200
        body = response.json()
        assert "name" in body
        assert "description" in body
        assert "board" in body
        assert "columns" in body["board"]
        assert "cards" in body["board"]


def test_export_nonexistent_board_returns_404(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        response = client.get(
            "/api/boards/99999/export", headers=_auth_header(token)
        )
        assert response.status_code == 404


def test_import_board(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)

        # First export a board
        boards = client.get("/api/boards", headers=_auth_header(token)).json()
        board_id = boards[0]["id"]
        exported = client.get(
            f"/api/boards/{board_id}/export", headers=_auth_header(token)
        ).json()

        # Import it
        response = client.post(
            "/api/boards/import",
            json={
                "name": "Imported Board",
                "description": "From export",
                "board": exported["board"],
            },
            headers=_auth_header(token),
        )
        assert response.status_code == 200
        body = response.json()
        assert body["name"] == "Imported Board"
        assert "id" in body

        # Verify we now have 2 boards
        boards_after = client.get("/api/boards", headers=_auth_header(token)).json()
        assert len(boards_after) == 2
        imported = next(b for b in boards_after if b["name"] == "Imported Board")
        assert imported["description"] == "From export"


def test_import_board_validates_data(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        # Missing required fields
        response = client.post(
            "/api/boards/import",
            json={"name": "Bad Board", "board": {"columns": [], "cards": {}}},
            headers=_auth_header(token),
        )
        assert response.status_code == 422


def test_export_import_roundtrip_preserves_data(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        boards = client.get("/api/boards", headers=_auth_header(token)).json()
        board_id = boards[0]["id"]

        # Get original board data
        original = client.get(
            f"/api/boards/{board_id}", headers=_auth_header(token)
        ).json()["board"]

        # Export
        exported = client.get(
            f"/api/boards/{board_id}/export", headers=_auth_header(token)
        ).json()

        # Import
        imported_resp = client.post(
            "/api/boards/import",
            json={
                "name": "Roundtrip Test",
                "description": "",
                "board": exported["board"],
            },
            headers=_auth_header(token),
        )
        new_board_id = imported_resp.json()["id"]

        # Fetch the imported board
        imported_board = client.get(
            f"/api/boards/{new_board_id}", headers=_auth_header(token)
        ).json()["board"]

        # Verify columns and cards match
        assert len(imported_board["columns"]) == len(original["columns"])
        assert len(imported_board["cards"]) == len(original["cards"])
        for orig_col, imp_col in zip(original["columns"], imported_board["columns"]):
            assert orig_col["title"] == imp_col["title"]
            assert orig_col["color"] == imp_col["color"]


def test_duplicate_board(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        boards = client.get("/api/boards", headers=_auth_header(token)).json()
        board_id = boards[0]["id"]

        response = client.post(
            f"/api/boards/{board_id}/duplicate", headers=_auth_header(token)
        )
        assert response.status_code == 200
        body = response.json()
        assert body["name"] == "My Board (copy)"
        assert "id" in body
        assert body["id"] != board_id

        # Verify we now have 2 boards
        boards_after = client.get("/api/boards", headers=_auth_header(token)).json()
        assert len(boards_after) == 2


def test_duplicate_nonexistent_board_returns_404(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        response = client.post(
            "/api/boards/99999/duplicate", headers=_auth_header(token)
        )
        assert response.status_code == 404


def test_multiple_boards_per_user(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        token = _register_and_get_token(client)
        for i in range(5):
            client.post(
                "/api/boards",
                json={"name": f"Board {i}"},
                headers=_auth_header(token),
            )
        boards = client.get("/api/boards", headers=_auth_header(token)).json()
        # 1 default + 5 created
        assert len(boards) == 6
