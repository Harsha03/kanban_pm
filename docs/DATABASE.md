# Database design (Part 5)

This document defines the MVP database model for persistent Kanban storage.

## Goals

- Support multiple users in schema design.
- Enforce one board per user for MVP.
- Store full board payload as JSON in a single SQLite column per board.
- Keep initialization simple and deterministic for local Docker runs.

## Engine and file

- Engine: SQLite
- Planned file location: `backend/data/pm.db`
- Runtime behavior: create DB and tables automatically if missing

## Schema

```sql
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
```

## Why this shape

- `users.username` is unique for future multi-user support.
- `boards.user_id UNIQUE` enforces exactly one board per user.
- `boards.board_json` stores the full board document in one column as requested.
- `CHECK (json_valid(board_json))` prevents invalid JSON payload writes.
- `created_at` and `updated_at` support future audit/debug needs with minimal overhead.

## Board JSON contract

The persisted JSON mirrors the frontend board state shape from `frontend/src/lib/kanban.ts`:

```json
{
  "columns": [
    { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"] }
  ],
  "cards": {
    "card-1": {
      "id": "card-1",
      "title": "Card title",
      "details": "Card details"
    }
  }
}
```

## Initialization and migration approach

- MVP uses a startup bootstrap step in backend:
  1. ensure parent DB directory exists
  2. open SQLite connection
  3. execute `CREATE TABLE IF NOT EXISTS` statements
  4. seed dummy user record (`user`) if missing
  5. seed default board JSON for that user if missing
- No migration framework in MVP.
- Any schema change before production can be handled by:
  - SQL version notes in `docs/`
  - a simple SQL patch script executed during startup

## CRUD behavior for Part 6

- Read board by username:
  - join `users` and `boards` on `users.id = boards.user_id`
- Update board:
  - replace `board_json` and set `updated_at = datetime('now')`
- Missing board behavior:
  - initialize from default board payload and return it

## Validation performed for this design

Part 5 schema validation was performed with a local SQLite smoke script to confirm:

- schema creates from empty DB
- valid JSON can be inserted and read back
- invalid JSON is rejected
- second board insert for same user is rejected by unique constraint

## Open points deferred to later parts

- Password hashing implementation details (Part 6+ security hardening)
- Session/auth DB persistence strategy beyond dummy login
- Optional JSON schema-level validation beyond SQLite `json_valid(...)`
