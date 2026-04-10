# Kanban PM

A full-stack project management application with multi-board Kanban interface, user authentication, and an optional AI chat assistant.

## Features

### Boards
- **Multi-board support** — create, rename, duplicate, delete, and switch between independent boards
- **Board templates** — start from Blank, Kanban, Scrum, or Bug Tracking layouts
- **Export / Import** — download boards as JSON and import them on any account
- **Progress bar** — visual completion tracker based on cards in the last column

### Cards
- **Drag-and-drop** — move cards between columns or reorder within a column
- **Priority levels** — Critical, High, Medium, Low with color-coded left border
- **Due dates** — optional dates with overdue highlighting
- **Labels** — board-level label definitions, assign multiple labels per card
- **Comments** — timestamped comments on any card
- **Search and filter** — text search, priority filter, label filter
- **Sorting** — sort cards by priority, due date, or title

### Columns
- **Customizable** — rename columns, change icons, pick colors
- **Reorder** — move columns left or right with arrow buttons
- **Add / Remove** — add new stages, remove with card migration

### User Management
- **JWT authentication** — register, login, and token-based sessions
- **Password change** — update password from the dashboard
- **Per-user isolation** — each user sees only their own boards

### UI / UX
- **"Warm Atelier" design** — rich earthy palette with amber/copper accents, Instrument Serif display type, DM Sans body text, subtle grain texture overlay
- **Dark mode** — toggle with persistence in localStorage, warm charcoal tones
- **Keyboard shortcuts** — `/` search, `n` new card, `?` AI chat, `Esc` close modals
- **Board statistics** — card count, stage count, critical items, overdue count
- **AI chat assistant** — optional sidebar that can read and update the board

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, dnd-kit
- **Backend**: FastAPI, SQLite, bcrypt, PyJWT, python-dotenv, uv
- **Design**: Instrument Serif + DM Sans typography, warm color system via CSS variables
- **Testing**: Vitest (44 tests), pytest (71 tests), Playwright (e2e)
- **Runtime**: Docker with multi-stage build

## Repository Layout

```
frontend/          Next.js app (components, lib, tests)
backend/           FastAPI app (routes, models, auth, db, AI)
  app/             Application code
  tests/           pytest test suite
  data/            SQLite database (gitignored)
docs/              Project notes and planning
scripts/           Start/stop scripts by OS
```

## Local Development

### Prerequisites

- Node.js 22+
- Python 3.12+
- Docker (optional, for containerized run)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
uv sync
uv run uvicorn backend.app.main:app --reload
```

## Run with Docker

```bash
docker build -t kanban-pm .
docker run --rm -p 8000:8000 --env-file .env kanban-pm
```

Then open `http://localhost:8000`.

## Authentication

A default account is created on first startup:

- **Username**: `user`
- **Password**: `password`

New accounts can be registered from the login screen.

## Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | For AI features | OpenRouter API key |
| `PM_DB_PATH` | No | Override default SQLite path |
| `PM_JWT_SECRET` | No | JWT signing secret (defaults to dev secret) |

## Testing

```bash
# Frontend (from frontend/)
npm run test:unit        # 44 Vitest tests
npm run test:e2e         # Playwright e2e tests
npm run lint             # ESLint

# Backend (from repo root)
uv run pytest            # 71 pytest tests
```

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/change-password` | Change password |
| GET | `/api/boards` | List boards |
| POST | `/api/boards` | Create board |
| GET | `/api/boards/:id` | Get board |
| PUT | `/api/boards/:id` | Update board |
| DELETE | `/api/boards/:id` | Delete board |
| POST | `/api/boards/:id/duplicate` | Duplicate board |
| GET | `/api/boards/:id/export` | Export board |
| POST | `/api/boards/import` | Import board |
| POST | `/api/ai/chat/:id` | AI chat |
