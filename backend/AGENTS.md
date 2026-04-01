# Backend agent guide

Current backend scope (through Part 6):

- FastAPI app entrypoint: `backend/app/main.py`
- Serves built frontend static export at `/` when present in `backend/app/frontend_dist`
- Falls back to `backend/app/static/index.html` if frontend build output is missing
- API endpoints:
  - `GET /api/health` returns `{"status":"ok"}`
  - `GET /api/hello` returns `{"message":"hello from fastapi"}`
  - `GET /api/ai/status` returns whether AI is enabled by config
  - `GET /api/ai/test` runs OpenRouter connectivity test with `2+2`
  - `POST /api/ai/chat/{username}` runs structured-output board chat and optional board update
  - `GET /api/board/{username}` returns a user's board JSON
  - `PUT /api/board/{username}` validates and updates board JSON
- DB bootstrap and storage:
  - init on startup via FastAPI lifespan
  - SQLite file defaults to `backend/data/pm.db` (override with `PM_DB_PATH`)
  - schema and data helpers live in `backend/app/db.py`
  - default board seed lives in `backend/app/board_seed.py`
  - request/response models live in `backend/app/models.py`
- Tests:
  - smoke tests in `backend/tests/test_smoke.py`
  - board API/unit tests in `backend/tests/test_board_api.py`
  - AI connectivity and fallback tests in `backend/tests/test_ai.py`
  - structured AI chat tests in `backend/tests/test_ai_chat.py`

Notes:

- Docker runs the backend with `uvicorn`.
- Python dependency management in container is handled by `uv` via `pyproject.toml`.
- Single-container Docker build now includes frontend static export.
- OpenRouter integration lives in `backend/app/ai.py`.