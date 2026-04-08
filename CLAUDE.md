# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kanban PM is a full-stack project management application with a single-board Kanban interface, FastAPI backend, Next.js frontend, and optional AI chat assistant for board updates.

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, dnd-kit
- **Backend**: FastAPI, SQLite (via sqlite3), Python 3.12+, uv for dependency management
- **Testing**: Vitest (unit), Playwright (e2e), pytest (backend)
- **Runtime**: Docker with multi-stage build

## Common Commands

### Frontend Development

```bash
cd frontend
npm install
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # Run ESLint
npm run test:unit        # Run Vitest tests
npm run test:unit:watch  # Watch mode for unit tests
npm run test:e2e         # Run Playwright e2e tests
npm run test:all         # Run all tests (unit + e2e)
```

### Backend Development

```bash
# From repository root
uv sync                  # Install dependencies
uv run uvicorn backend.app.main:app --reload  # Start with hot-reload
uv run pytest            # Run all backend tests
uv run pytest backend/tests/test_board_api.py  # Run specific test file
uv run pytest -k test_name  # Run specific test by name
```

### Docker

```bash
# Full stack (from repo root)
docker build -t kanban-pm .
docker run --rm -p 8000:8000 --env-file .env kanban-pm

# Platform-specific scripts in scripts/
./scripts/start-mac.sh   # Builds pm-mvp:local, runs on port 8000
./scripts/stop-mac.sh    # Stops and removes container
```

## Architecture

### Data Model & State Synchronization

The application uses a **shared data model** between frontend and backend:

- **Frontend types** (`frontend/src/lib/kanban.ts`): TypeScript types for `BoardData`, `Column`, `Card`
- **Backend models** (`backend/app/models.py`): Pydantic models mirroring frontend types exactly
- **Storage**: SQLite with JSON column validation (`backend/app/db.py`)
  - Schema enforces `json_valid(board_json)` constraint
  - Board data stored as JSON in `boards.board_json` column
  - One board per user (UNIQUE constraint on `user_id`)

**Key invariant**: Frontend and backend must maintain identical schema for columns/cards. When adding fields:
1. Update TypeScript types in `frontend/src/lib/kanban.ts`
2. Update Pydantic models in `backend/app/models.py`
3. Update `STRUCTURED_RESPONSE_SCHEMA` in `backend/app/ai.py` if AI needs to generate the field
4. Add migration logic in `db._normalize_board_shape()` for backwards compatibility

### API Routes

All API routes defined in `backend/app/main.py`:

- `GET /api/health` - Health check
- `GET /api/board/{username}` - Fetch user's board
- `PUT /api/board/{username}` - Update entire board (replace)
- `POST /api/ai/chat/{username}` - AI chat that can return board updates
- `GET /api/ai/status` - Check if AI is enabled (OPENROUTER_API_KEY set)
- `GET /api/ai/test` - Test AI connectivity

### Frontend API Client

`frontend/src/lib/api.ts` provides typed fetch wrappers:
- `fetchBoard(username)` - GET board
- `persistBoard(username, board)` - PUT board
- `sendAIChat(username, {question, history})` - POST AI chat

### Drag & Drop State Management

Card movement logic in `frontend/src/lib/kanban.ts`:
- `moveCard(columns, activeId, overId)` - Pure function handling all drag scenarios
- Handles same-column reordering, cross-column moves, and drop-on-column vs drop-on-card
- Returns new columns array (immutable update pattern)

### AI Integration

`backend/app/ai.py` handles AI features:
- Uses OpenRouter API with Claude Sonnet 4.6 (`OPENROUTER_MODEL`)
- Structured output with retry logic (falls back to plain text if JSON parsing fails)
- AI can return board updates (new/modified/deleted cards, column changes)
- Response schema strictly validates against `STRUCTURED_RESPONSE_SCHEMA`
- History trimmed to last 10 messages (`MAX_HISTORY_ITEMS`)

**AI Flow**:
1. Frontend sends question + conversation history to `/api/ai/chat/{username}`
2. Backend fetches current board, builds context prompt with board JSON + history
3. Calls OpenRouter with structured output request
4. If response includes `board_update`, persists to database before returning
5. Frontend receives reply + optional board update, applies to UI

### Authentication

MVP uses hardcoded credentials (`backend/app/db.py`):
- Username: `user`
- Password: `dummy-password` (not validated, placeholder only)
- User created at database initialization in `initialize_database()`

### Database Initialization

On app startup (`lifespan` in `main.py`):
1. Creates schema if not exists (`backend/app/db.py:SCHEMA_SQL`)
2. Inserts default user `user` if not exists
3. Ensures user has a board (uses `DEFAULT_BOARD` from `board_seed.py`)

Database path configurable via `PM_DB_PATH` env var, defaults to `backend/data/pm.db`.

### Static File Serving

FastAPI mounts static files (`main.py`):
- Prefers `backend/app/frontend_dist` (Docker build output)
- Falls back to `backend/app/static` (placeholder for dev without frontend build)

### Docker Build

Multi-stage Dockerfile:
1. `frontend-builder`: Builds Next.js app (`npm run build`)
2. Final stage: Copies frontend build to `backend/app/frontend_dist`, installs Python deps with uv, runs uvicorn

## Environment Variables

Create `.env` in repository root:

```
OPENROUTER_API_KEY=your_key_here  # Required for AI features
PM_DB_PATH=path/to/db.sqlite      # Optional, override default DB location
```

## Testing Patterns

### Frontend Tests

- **Unit tests**: Co-located with source files (e.g., `kanban.test.ts`, `api.test.ts`)
- **Setup**: `frontend/src/test/setup.ts` configures jsdom and Testing Library
- **E2E tests**: `frontend/e2e/*.spec.ts` using Playwright

### Backend Tests

- **Location**: `backend/tests/`
- **Fixtures**: Many tests use in-memory database (`PM_DB_PATH=:memory:`)
- **API tests**: `test_board_api.py` uses FastAPI TestClient
- **AI tests**: `test_ai.py` mocks OpenRouter responses

## Key Design Decisions

1. **No real authentication**: MVP uses single hardcoded user for simplicity
2. **Full board replacement**: PUT endpoint replaces entire board (no PATCH/incremental updates)
3. **Client-side drag logic**: `moveCard()` runs in browser, then persists via PUT
4. **AI as optional feature**: App works without OPENROUTER_API_KEY, AI routes return 503
5. **JSON storage**: Board stored as JSON blob rather than normalized relational tables for MVP speed
6. **Backwards compatibility**: `_normalize_board_shape()` ensures old boards get new fields (color, icon, priority)
