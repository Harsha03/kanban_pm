from contextlib import asynccontextmanager
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from backend.app.ai import (
    AIProviderError,
    AIUnavailableError,
    is_ai_enabled,
    run_connectivity_test,
    run_structured_board_chat,
)
from backend.app.db import get_board, initialize_database, update_board
from backend.app.models import AIChatAPIResponse, AIChatRequest, BoardData

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Initializing database...")
    initialize_database()
    logger.info("Application startup complete")
    yield
    logger.info("Application shutdown")


app = FastAPI(
    title="Kanban PM API",
    description="Single-board project management with AI assistant",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js dev server
        "http://localhost:8000",  # Self (for same-origin requests)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app_dir = Path(__file__).resolve().parent
static_dir = app_dir / "static"
frontend_dist_dir = app_dir / "frontend_dist"


@app.get("/api/health", tags=["Health"])
def health() -> dict[str, str]:
    """
    Health check endpoint.

    Returns:
        dict: Status indicator {"status": "ok"}
    """
    return {"status": "ok"}


@app.get("/api/hello", tags=["Health"])
def hello() -> dict[str, str]:
    """
    Simple hello endpoint for testing.

    Returns:
        dict: Hello message from the API
    """
    return {"message": "hello from fastapi"}


@app.get("/api/ai/status", tags=["AI"])
def ai_status() -> dict[str, bool]:
    """
    Check if AI features are enabled.

    Returns:
        dict: {"enabled": bool} - True if OPENROUTER_API_KEY is set
    """
    return {"enabled": is_ai_enabled()}


@app.get("/api/ai/test", tags=["AI"])
def ai_test() -> dict[str, str]:
    """
    Test AI connectivity with a simple prompt.

    Returns:
        dict: {"model": str, "answer": str} - Model name and response to "2+2"

    Raises:
        HTTPException(503): AI is disabled (no API key)
        HTTPException(502): OpenRouter connection/response error
    """
    try:
        return run_connectivity_test()
    except AIUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail="AI is disabled because OPENROUTER_API_KEY is not set.",
        ) from exc
    except AIProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/board/{username}", response_model=BoardData, tags=["Board"])
def read_board(username: str) -> BoardData:
    """
    Fetch board data for a user.

    Args:
        username: The username to fetch board for

    Returns:
        BoardData: Complete board state including columns and cards

    Raises:
        HTTPException(404): User not found
    """
    try:
        board = get_board(username)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="User not found") from exc
    return BoardData.model_validate(board)


@app.put("/api/board/{username}", response_model=BoardData, tags=["Board"])
def write_board(username: str, payload: BoardData) -> BoardData:
    """
    Update board data for a user (full replacement).

    Args:
        username: The username to update board for
        payload: Complete board data (replaces existing board)

    Returns:
        BoardData: The persisted board state

    Raises:
        HTTPException(404): User not found
        HTTPException(422): Invalid board data (validation errors)
    """
    try:
        board = update_board(username, payload.model_dump())
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="User not found") from exc
    return BoardData.model_validate(board)


@app.post("/api/ai/chat/{username}", response_model=AIChatAPIResponse, tags=["AI"])
@limiter.limit("10/minute")
def ai_chat(request: Request, username: str, payload: AIChatRequest) -> AIChatAPIResponse:
    """
    Send a chat message to the AI assistant.

    The AI can respond with text and optionally update the board state.
    Includes current board and conversation history in the AI prompt.

    Args:
        username: The username for board context
        payload: Chat request with question and conversation history

    Returns:
        AIChatAPIResponse: AI reply and optional board update

    Raises:
        HTTPException(503): AI is disabled (no API key)
        HTTPException(502): OpenRouter connection/response error
        HTTPException(404): User not found
    """
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
