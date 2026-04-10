import json
import os
import sqlite3
from pathlib import Path

from backend.app.auth import hash_password
from backend.app.board_seed import BOARD_TEMPLATES, DEFAULT_BOARD

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
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Board',
  description TEXT NOT NULL DEFAULT '',
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
        _migrate_boards_table(conn)
        _migrate_remove_unique_user_id(conn)
        existing = conn.execute("SELECT id FROM users LIMIT 1").fetchone()
        if existing is None:
            conn.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                ("user", hash_password("password")),
            )
            user_row = conn.execute(
                "SELECT id FROM users WHERE username = ?", ("user",)
            ).fetchone()
            if user_row:
                _create_board_for_user(conn, int(user_row["id"]), "My Board", "")
        conn.commit()


def _migrate_boards_table(conn: sqlite3.Connection) -> None:
    columns = {
        row["name"] for row in conn.execute("PRAGMA table_info(boards)").fetchall()
    }
    if "name" not in columns:
        conn.execute("ALTER TABLE boards ADD COLUMN name TEXT NOT NULL DEFAULT 'My Board'")
    if "description" not in columns:
        conn.execute("ALTER TABLE boards ADD COLUMN description TEXT NOT NULL DEFAULT ''")


def _migrate_remove_unique_user_id(conn: sqlite3.Connection) -> None:
    idx = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='sqlite_autoindex_boards_1'"
    ).fetchone()
    if idx is not None:
        # Recreate the table without the UNIQUE constraint
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS boards_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              name TEXT NOT NULL DEFAULT 'My Board',
              description TEXT NOT NULL DEFAULT '',
              board_json TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              CHECK (json_valid(board_json))
            );
            INSERT INTO boards_new (id, user_id, name, description, board_json, created_at, updated_at)
              SELECT id, user_id, name, description, board_json, created_at, updated_at FROM boards;
            DROP TABLE boards;
            ALTER TABLE boards_new RENAME TO boards;
            CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id);
        """)


def _get_user_id(conn: sqlite3.Connection, username: str) -> int | None:
    row = conn.execute(
        "SELECT id FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    if row is None:
        return None
    return int(row["id"])


def _create_board_for_user(
    conn: sqlite3.Connection,
    user_id: int,
    name: str,
    description: str,
    board_data: dict | None = None,
) -> dict:
    board = board_data or DEFAULT_BOARD
    board_json = json.dumps(board)
    cursor = conn.execute(
        "INSERT INTO boards (user_id, name, description, board_json) VALUES (?, ?, ?, ?)",
        (user_id, name, description, board_json),
    )
    return {
        "id": cursor.lastrowid,
        "name": name,
        "description": description,
        "board": board,
    }


def _normalize_board_shape(board: dict) -> dict:
    default_columns = {column["id"]: column for column in DEFAULT_BOARD["columns"]}
    columns = board.get("columns", [])

    for index, column in enumerate(columns):
        fallback = default_columns.get(column.get("id"))
        if "color" not in column:
            columns[index]["color"] = (
                fallback["color"] if fallback is not None else "#3B82F6"
            )
        if "icon" not in column:
            columns[index]["icon"] = (
                fallback["icon"] if fallback is not None else "inbox"
            )

    cards = board.get("cards", {})
    for card_id, card in cards.items():
        if "priority" not in card:
            fallback = DEFAULT_BOARD["cards"].get(card_id)
            cards[card_id]["priority"] = (
                fallback["priority"] if fallback is not None else "medium"
            )
        if "dueDate" not in card:
            cards[card_id]["dueDate"] = None
        if "labelIds" not in card:
            cards[card_id]["labelIds"] = []
        if "comments" not in card:
            cards[card_id]["comments"] = []

    if "labels" not in board:
        board["labels"] = []

    return board


# --- User management ---


def create_user(username: str, password_hash: str) -> dict:
    with get_connection() as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, password_hash),
            )
            user_id = cursor.lastrowid
            # Create a default board for new users
            _create_board_for_user(conn, user_id, "My Board", "Default project board")
            conn.commit()
            return {"id": user_id, "username": username}
        except sqlite3.IntegrityError:
            raise ValueError("username_taken")


def get_user_by_username(username: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash, created_at FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if row is None:
            return None
        return dict(row)


def get_user_by_id(user_id: int) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if row is None:
            return None
        return dict(row)


def get_user_by_id_with_hash(user_id: int) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if row is None:
            return None
        return dict(row)


# --- Board management (multi-board) ---


def list_boards(user_id: int) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT id, name, description, created_at, updated_at
               FROM boards WHERE user_id = ? ORDER BY updated_at DESC""",
            (user_id,),
        ).fetchall()
        return [dict(row) for row in rows]


def get_board_by_id(board_id: int, user_id: int) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, user_id, name, description, board_json, created_at, updated_at FROM boards WHERE id = ? AND user_id = ?",
            (board_id, user_id),
        ).fetchone()
        if row is None:
            return None
        result = dict(row)
        result["board"] = _normalize_board_shape(json.loads(result["board_json"]))
        del result["board_json"]
        conn.commit()
        return result


def create_board(
    user_id: int, name: str, description: str = "", template: str = "kanban"
) -> dict:
    board_data = BOARD_TEMPLATES.get(template, BOARD_TEMPLATES["kanban"])
    with get_connection() as conn:
        result = _create_board_for_user(conn, user_id, name, description, board_data)
        conn.commit()
        return result


def update_board_data(board_id: int, user_id: int, board_payload: dict) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id FROM boards WHERE id = ? AND user_id = ?",
            (board_id, user_id),
        ).fetchone()
        if row is None:
            return None

        board_json = json.dumps(board_payload)
        conn.execute(
            "UPDATE boards SET board_json = ?, updated_at = datetime('now') WHERE id = ?",
            (board_json, board_id),
        )
        conn.commit()
        return board_payload


def update_board_meta(board_id: int, user_id: int, name: str, description: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id FROM boards WHERE id = ? AND user_id = ?",
            (board_id, user_id),
        ).fetchone()
        if row is None:
            return None

        conn.execute(
            "UPDATE boards SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?",
            (name, description, board_id),
        )
        conn.commit()
        return {"id": board_id, "name": name, "description": description}


def delete_board(board_id: int, user_id: int) -> bool:
    with get_connection() as conn:
        result = conn.execute(
            "DELETE FROM boards WHERE id = ? AND user_id = ?",
            (board_id, user_id),
        )
        conn.commit()
        return result.rowcount > 0


# --- Legacy functions (kept for backward compatibility with existing endpoints) ---


def get_board(username: str) -> dict:
    """Get the first board for a user by username (legacy single-board API)."""
    with get_connection() as conn:
        user_id = _get_user_id(conn, username)
        if user_id is None:
            raise LookupError("user_not_found")

        row = conn.execute(
            "SELECT board_json FROM boards WHERE user_id = ? ORDER BY id LIMIT 1",
            (user_id,),
        ).fetchone()
        if row is not None:
            board = _normalize_board_shape(json.loads(row["board_json"]))
            conn.execute(
                "UPDATE boards SET board_json = ?, updated_at = datetime('now') WHERE user_id = ? AND id = (SELECT MIN(id) FROM boards WHERE user_id = ?)",
                (json.dumps(board), user_id, user_id),
            )
            conn.commit()
            return board

        board_json = json.dumps(DEFAULT_BOARD)
        conn.execute(
            "INSERT INTO boards (user_id, board_json) VALUES (?, ?)",
            (user_id, board_json),
        )
        conn.commit()
        return DEFAULT_BOARD


def update_board(username: str, board_payload: dict) -> dict:
    """Update the first board for a user by username (legacy single-board API)."""
    with get_connection() as conn:
        user_id = _get_user_id(conn, username)
        if user_id is None:
            raise LookupError("user_not_found")

        board_json = json.dumps(board_payload)
        updated = conn.execute(
            """UPDATE boards SET board_json = ?, updated_at = datetime('now')
               WHERE user_id = ? AND id = (SELECT MIN(id) FROM boards WHERE user_id = ?)""",
            (board_json, user_id, user_id),
        )
        if updated.rowcount == 0:
            conn.execute(
                "INSERT INTO boards (user_id, board_json) VALUES (?, ?)",
                (user_id, board_json),
            )
        conn.commit()
        return board_payload
