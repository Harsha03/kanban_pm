from pathlib import Path
import pytest
import sys

from pydantic import ValidationError
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.app.main import app
from backend.app.models import BoardData, Column, Card


def test_board_requires_at_least_one_column(tmp_path: Path, monkeypatch) -> None:
    """Test that boards must have at least one column."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))

    with pytest.raises(ValidationError) as exc_info:
        BoardData(columns=[], cards={})
    assert "at least 1 item" in str(exc_info.value).lower()


def test_board_rejects_too_many_columns(tmp_path: Path, monkeypatch) -> None:
    """Test that boards cannot have more than 20 columns."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))

    columns = [
        Column(id=f"col-{i}", title=f"Column {i}", color="#3B82F6", icon="inbox", cardIds=[])
        for i in range(21)
    ]

    with pytest.raises(ValidationError) as exc_info:
        BoardData(columns=columns, cards={})
    assert "at most 20 items" in str(exc_info.value).lower()


def test_board_rejects_duplicate_column_ids(tmp_path: Path, monkeypatch) -> None:
    """Test that column IDs must be unique."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))

    columns = [
        Column(id="col-1", title="Column 1", color="#3B82F6", icon="inbox", cardIds=[]),
        Column(id="col-1", title="Column 2", color="#8B5CF6", icon="search", cardIds=[]),
    ]

    with pytest.raises(ValidationError) as exc_info:
        BoardData(columns=columns, cards={})
    assert "Column IDs must be unique" in str(exc_info.value)


def test_board_rejects_too_many_cards(tmp_path: Path, monkeypatch) -> None:
    """Test that boards cannot have more than 500 cards."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))

    columns = [Column(id="col-1", title="Column", color="#3B82F6", icon="inbox", cardIds=[])]
    cards = {
        f"card-{i}": Card(id=f"card-{i}", title=f"Card {i}", details="Details", priority="medium")
        for i in range(501)
    }

    with pytest.raises(ValidationError) as exc_info:
        BoardData(columns=columns, cards=cards)
    assert "at most 500 items" in str(exc_info.value).lower()


def test_board_rejects_card_id_key_mismatch(tmp_path: Path, monkeypatch) -> None:
    """Test that card IDs must match their dictionary keys."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))

    columns = [Column(id="col-1", title="Column", color="#3B82F6", icon="inbox", cardIds=["card-1"])]
    cards = {
        "card-wrong": Card(id="card-1", title="Card", details="Details", priority="medium")
    }

    with pytest.raises(ValidationError) as exc_info:
        BoardData(columns=columns, cards=cards)
    assert "does not match card ID" in str(exc_info.value)


def test_card_title_cannot_be_empty(tmp_path: Path, monkeypatch) -> None:
    """Test that card titles must have at least 1 character."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))

    with pytest.raises(ValidationError) as exc_info:
        Card(id="card-1", title="", details="Details", priority="medium")
    assert "at least 1 character" in str(exc_info.value).lower()


def test_card_title_too_long(tmp_path: Path, monkeypatch) -> None:
    """Test that card titles cannot exceed 200 characters."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))

    with pytest.raises(ValidationError) as exc_info:
        Card(id="card-1", title="x" * 201, details="Details", priority="medium")
    assert "at most 200 characters" in str(exc_info.value).lower()


def test_column_color_must_be_hex(tmp_path: Path, monkeypatch) -> None:
    """Test that column colors must be valid hex codes."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))

    with pytest.raises(ValidationError) as exc_info:
        Column(id="col-1", title="Column", color="red", icon="inbox", cardIds=[])
    assert "should match pattern" in str(exc_info.value).lower()


def test_api_rejects_invalid_board_payload(tmp_path: Path, monkeypatch) -> None:
    """Test that API rejects invalid board updates."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))

    with TestClient(app) as client:
        # Try to send empty columns
        response = client.put(
            "/api/board/user",
            json={"columns": [], "cards": {}},
        )
        assert response.status_code == 422


def test_api_rejects_duplicate_column_ids(tmp_path: Path, monkeypatch) -> None:
    """Test that API rejects boards with duplicate column IDs."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))

    with TestClient(app) as client:
        response = client.put(
            "/api/board/user",
            json={
                "columns": [
                    {"id": "col-1", "title": "A", "color": "#3B82F6", "icon": "inbox", "cardIds": []},
                    {"id": "col-1", "title": "B", "color": "#8B5CF6", "icon": "search", "cardIds": []},
                ],
                "cards": {},
            },
        )
        assert response.status_code == 422
        assert "Column IDs must be unique" in response.json()["detail"][0]["msg"]


def test_api_rejects_invalid_card_data(tmp_path: Path, monkeypatch) -> None:
    """Test that API rejects cards with empty titles."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))

    with TestClient(app) as client:
        response = client.put(
            "/api/board/user",
            json={
                "columns": [
                    {"id": "col-1", "title": "Column", "color": "#3B82F6", "icon": "inbox", "cardIds": ["card-1"]},
                ],
                "cards": {
                    "card-1": {"id": "card-1", "title": "", "details": "Details", "priority": "medium"}
                },
            },
        )
        assert response.status_code == 422
