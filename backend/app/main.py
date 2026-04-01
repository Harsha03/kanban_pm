from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from backend.app.ai import (
    AIProviderError,
    AIUnavailableError,
    is_ai_enabled,
    run_connectivity_test,
    run_structured_board_chat,
)
from backend.app.db import get_board, initialize_database, update_board
from backend.app.models import AIChatAPIResponse, AIChatRequest, BoardData


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="Project Management MVP API", lifespan=lifespan)

app_dir = Path(__file__).resolve().parent
static_dir = app_dir / "static"
frontend_dist_dir = app_dir / "frontend_dist"


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/hello")
def hello() -> dict[str, str]:
    return {"message": "hello from fastapi"}


@app.get("/api/ai/status")
def ai_status() -> dict[str, bool]:
    return {"enabled": is_ai_enabled()}


@app.get("/api/ai/test")
def ai_test() -> dict[str, str]:
    try:
        return run_connectivity_test()
    except AIUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail="AI is disabled because OPENROUTER_API_KEY is not set.",
        ) from exc
    except AIProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/board/{username}", response_model=BoardData)
def read_board(username: str) -> BoardData:
    try:
        board = get_board(username)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="User not found") from exc
    return BoardData.model_validate(board)


@app.put("/api/board/{username}", response_model=BoardData)
def write_board(username: str, payload: BoardData) -> BoardData:
    try:
        board = update_board(username, payload.model_dump())
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="User not found") from exc
    return BoardData.model_validate(board)


@app.post("/api/ai/chat/{username}", response_model=AIChatAPIResponse)
def ai_chat(username: str, payload: AIChatRequest) -> AIChatAPIResponse:
    if not is_ai_enabled():
        raise HTTPException(
            status_code=503,
            detail="AI is disabled because OPENROUTER_API_KEY is not set.",
        )

    try:
        current_board = BoardData.model_validate(get_board(username))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="User not found") from exc

    try:
        structured = run_structured_board_chat(
            board=current_board,
            history=payload.history,
            question=payload.question,
        )
    except AIUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail="AI is disabled because OPENROUTER_API_KEY is not set.",
        ) from exc
    except AIProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if structured.board_update is not None:
        try:
            persisted = update_board(username, structured.board_update.model_dump())
        except LookupError as exc:
            raise HTTPException(status_code=404, detail="User not found") from exc
        return AIChatAPIResponse(
            reply=structured.reply,
            board_update=BoardData.model_validate(persisted),
        )

    return AIChatAPIResponse(reply=structured.reply, board_update=None)


if frontend_dist_dir.exists():
    app.mount("/", StaticFiles(directory=frontend_dist_dir, html=True), name="frontend")
else:
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="fallback-static")
