import json
import os
import sqlite3
from pathlib import Path

from backend.app.board_seed import DEFAULT_BOARD

DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "pm.db"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  board_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (json_valid(board_json))
);

CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id);
"""


def get_db_path() -> Path:
    override = os.getenv("PM_DB_PATH")
    if override:
        return Path(override).resolve()
    return DEFAULT_DB_PATH


def get_connection() -> sqlite3.Connection:
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def initialize_database() -> None:
    with get_connection() as conn:
        conn.executescript(SCHEMA_SQL)
        conn.execute(
            "INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)",
            ("user", "dummy-password"),
        )
        _ensure_board_for_user(conn, "user")
        conn.commit()


def _get_user_id(conn: sqlite3.Connection, username: str) -> int | None:
    row = conn.execute(
        "SELECT id FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    if row is None:
        return None
    return int(row["id"])


def _ensure_board_for_user(conn: sqlite3.Connection, username: str) -> dict:
    user_id = _get_user_id(conn, username)
    if user_id is None:
        raise LookupError("user_not_found")

    row = conn.execute(
        "SELECT board_json FROM boards WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    if row is not None:
        board = _normalize_board_shape(json.loads(row["board_json"]))
        conn.execute(
            "UPDATE boards SET board_json = ?, updated_at = datetime('now') WHERE user_id = ?",
            (json.dumps(board), user_id),
        )
        return board

    board_json = json.dumps(DEFAULT_BOARD)
    conn.execute(
        "INSERT INTO boards (user_id, board_json) VALUES (?, ?)",
        (user_id, board_json),
    )
    return DEFAULT_BOARD


def _normalize_board_shape(board: dict) -> dict:
    """
    Ensure board data has all required fields for backwards compatibility.

    This function patches boards that were created before new fields were added,
    preventing validation errors when the schema evolves. It runs automatically
    on board read operations.

    Added fields:
    - columns.color (added in schema v2)
    - columns.icon (added in schema v2)
    - cards.priority (added in schema v3)

    Args:
        board: Raw board dictionary from database

    Returns:
        Board dictionary with all required fields populated
    """
    # Create lookup map of default columns for fallback values
    default_columns = {column["id"]: column for column in DEFAULT_BOARD["columns"]}
    columns = board.get("columns", [])

    # Patch missing color and icon fields in columns
    for index, column in enumerate(columns):
        if "color" not in column:
            fallback = default_columns.get(column.get("id"))
            columns[index]["color"] = (
                fallback["color"] if fallback is not None else "#3B82F6"
            )
        if "icon" not in column:
            fallback = default_columns.get(column.get("id"))
            columns[index]["icon"] = (
                fallback["icon"] if fallback is not None else "inbox"
            )

    # Patch missing priority field in cards
    cards = board.get("cards", {})
    for card_id, card in cards.items():
        if "priority" not in card:
            fallback = DEFAULT_BOARD["cards"].get(card_id)
            cards[card_id]["priority"] = (
                fallback["priority"] if fallback is not None else "medium"
            )
    return board


def get_board(username: str) -> dict:
    with get_connection() as conn:
        board = _ensure_board_for_user(conn, username)
        conn.commit()
        return board


def update_board(username: str, board_payload: dict) -> dict:
    with get_connection() as conn:
        user_id = _get_user_id(conn, username)
        if user_id is None:
            raise LookupError("user_not_found")

        board_json = json.dumps(board_payload)
        updated = conn.execute(
            """
            UPDATE boards
            SET board_json = ?, updated_at = datetime('now')
            WHERE user_id = ?
            """,
            (board_json, user_id),
        )
        if updated.rowcount == 0:
            conn.execute(
                "INSERT INTO boards (user_id, board_json) VALUES (?, ?)",
                (user_id, board_json),
            )
        conn.commit()
        return board_payload
