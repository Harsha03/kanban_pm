# Kanban PM

Kanban PM is a single-board project management app with a Next.js frontend, FastAPI backend, and optional AI chat assistant for board updates.

## Features

- Login-gated Kanban board
- Stage renaming and icon customization
- Card create, edit, remove, and drag-and-drop movement
- Expanded stage popup with focused card management
- AI sidebar chat that can return board updates
- Dockerized full-stack runtime

## Tech Stack

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS, dnd-kit
- Backend: FastAPI, SQLite, python-dotenv, uv
- Tooling: Vitest, Playwright, pytest, ESLint, Docker

## Repository Layout

- `frontend/` - Next.js app
- `backend/` - FastAPI app and API routes
- `docs/` - project notes and planning docs
- `scripts/` - start/stop scripts by OS

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

From the repository root:

```bash
docker build -t kanban-pm .
docker run --rm -p 8000:8000 --env-file .env kanban-pm
```

Then open `http://localhost:8000`.

## Authentication (MVP)

- Username: `user`
- Password: `password`

## Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

The backend auto-loads `.env` from the project root via python-dotenv.
For AI features, set `OPENROUTER_API_KEY`.

## Testing

Frontend (from `frontend/`):

```bash
npm run lint
npm run test:unit
npm run test:e2e
```

Backend (from repo root):

```bash
uv run pytest
```
