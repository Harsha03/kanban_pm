from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.app.main import app


def _register(client, username="testuser", password="testpass123"):
    return client.post(
        "/api/auth/register",
        json={"username": username, "password": password},
    )


def _login(client, username="testuser", password="testpass123"):
    return client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )


def _auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def test_register_creates_user(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        response = _register(client)
        assert response.status_code == 200
        body = response.json()
        assert "token" in body
        assert body["user"]["username"] == "testuser"
        assert "id" in body["user"]


def test_register_duplicate_username_returns_409(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        _register(client)
        response = _register(client)
        assert response.status_code == 409
        assert response.json()["detail"] == "Username already taken"


def test_register_short_username_rejected(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        response = _register(client, username="ab")
        assert response.status_code == 422


def test_register_short_password_rejected(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        response = _register(client, password="12345")
        assert response.status_code == 422


def test_register_invalid_username_chars_rejected(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        response = _register(client, username="test user!")
        assert response.status_code == 422


def test_login_succeeds_with_correct_credentials(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        _register(client)
        response = _login(client)
        assert response.status_code == 200
        body = response.json()
        assert "token" in body
        assert body["user"]["username"] == "testuser"


def test_login_fails_with_wrong_password(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        _register(client)
        response = _login(client, password="wrongpassword")
        assert response.status_code == 401


def test_login_fails_with_nonexistent_user(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        response = _login(client, username="nobody", password="nopassword")
        assert response.status_code == 401


def test_get_me_with_valid_token(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        reg = _register(client)
        token = reg.json()["token"]
        response = client.get("/api/auth/me", headers=_auth_header(token))
        assert response.status_code == 200
        assert response.json()["username"] == "testuser"


def test_get_me_without_token_returns_422(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        response = client.get("/api/auth/me")
        assert response.status_code == 422


def test_get_me_with_invalid_token_returns_401(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        response = client.get(
            "/api/auth/me", headers={"Authorization": "Bearer invalid-token"}
        )
        assert response.status_code == 401


def test_register_creates_default_board(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        reg = _register(client)
        token = reg.json()["token"]
        boards = client.get("/api/boards", headers=_auth_header(token))
        assert boards.status_code == 200
        board_list = boards.json()
        assert len(board_list) == 1
        assert board_list[0]["name"] == "My Board"


def test_default_user_can_login(monkeypatch, tmp_path: Path) -> None:
    """The default 'user' account created at startup should be loginable."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        response = _login(client, username="user", password="password")
        assert response.status_code == 200
        assert response.json()["user"]["username"] == "user"


def test_change_password(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        resp = _register(client)
        token = resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Change password
        resp = client.post(
            "/api/auth/change-password",
            json={"currentPassword": "testpass123", "newPassword": "newpass456"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["success"] is True

        # Old password should fail
        resp = _login(client, password="testpass123")
        assert resp.status_code == 401

        # New password should work
        resp = _login(client, password="newpass456")
        assert resp.status_code == 200


def test_change_password_wrong_current(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        resp = _register(client)
        token = resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        resp = client.post(
            "/api/auth/change-password",
            json={"currentPassword": "wrongpassword", "newPassword": "newpass456"},
            headers=headers,
        )
        assert resp.status_code == 401


def test_change_password_too_short(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))
    with TestClient(app) as client:
        resp = _register(client)
        token = resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        resp = client.post(
            "/api/auth/change-password",
            json={"currentPassword": "testpass123", "newPassword": "ab"},
            headers=headers,
        )
        assert resp.status_code == 422
