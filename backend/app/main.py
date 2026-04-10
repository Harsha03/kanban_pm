from contextlib import asynccontextmanager
import logging
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
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
from backend.app.auth import create_token, hash_password, require_auth, verify_password
from backend.app.db import (
    _create_board_for_user,
    create_board,
    create_user,
    delete_board,
    get_board,
    get_board_by_id,
    get_connection,
    get_user_by_id,
    get_user_by_id_with_hash,
    get_user_by_username,
    initialize_database,
    list_boards,
    update_board,
    update_board_data,
    update_board_meta,
)
from backend.app.models import (
    AIChatAPIResponse,
    AIChatRequest,
    AuthResponse,
    BoardData,
    BoardSummary,
    CreateBoardRequest,
    ImportBoardRequest,
    LoginRequest,
    RegisterRequest,
    UpdateBoardMetaRequest,
    UserResponse,
)

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
    description="Multi-board project management with user auth and AI assistant",
    version="0.2.0",
    lifespan=lifespan,
)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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


# --- Health ---


@app.get("/api/health", tags=["Health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/hello", tags=["Health"])
def hello() -> dict[str, str]:
    return {"message": "hello from fastapi"}


# --- Auth ---


@app.post("/api/auth/register", response_model=AuthResponse, tags=["Auth"])
def register(payload: RegisterRequest) -> AuthResponse:
    hashed = hash_password(payload.password)
    try:
        user = create_user(payload.username, hashed)
    except ValueError:
        raise HTTPException(status_code=409, detail="Username already taken")
    token = create_token(user["id"], user["username"])
    return AuthResponse(token=token, user={"id": user["id"], "username": user["username"]})


@app.post("/api/auth/login", response_model=AuthResponse, tags=["Auth"])
def login(payload: LoginRequest) -> AuthResponse:
    user = get_user_by_username(payload.username)
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_token(user["id"], user["username"])
    return AuthResponse(
        token=token, user={"id": user["id"], "username": user["username"]}
    )


@app.get("/api/auth/me", response_model=UserResponse, tags=["Auth"])
def get_me(auth: dict = Depends(require_auth)) -> UserResponse:
    user = get_user_by_id(auth["sub"])
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(id=user["id"], username=user["username"])


@app.post("/api/auth/change-password", tags=["Auth"])
def change_password(
    payload: dict, auth: dict = Depends(require_auth)
) -> dict:
    current_password = payload.get("currentPassword", "")
    new_password = payload.get("newPassword", "")
    if not current_password or not new_password:
        raise HTTPException(status_code=422, detail="Both current and new passwords are required")
    if len(new_password) < 6:
        raise HTTPException(status_code=422, detail="New password must be at least 6 characters")

    user = get_user_by_id_with_hash(auth["sub"])
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    new_hash = hash_password(new_password)
    with get_connection() as conn:
        conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, auth["sub"]))
        conn.commit()
    return {"success": True}


# --- Multi-board endpoints ---


@app.get("/api/boards", response_model=list[BoardSummary], tags=["Boards"])
def list_user_boards(auth: dict = Depends(require_auth)) -> list[BoardSummary]:
    boards = list_boards(auth["sub"])
    return [BoardSummary(**b) for b in boards]


@app.post("/api/boards", tags=["Boards"])
def create_user_board(
    payload: CreateBoardRequest, auth: dict = Depends(require_auth)
) -> dict:
    result = create_board(auth["sub"], payload.name, payload.description, payload.template)
    return result


@app.get("/api/boards/{board_id}", tags=["Boards"])
def get_user_board(board_id: int, auth: dict = Depends(require_auth)) -> dict:
    result = get_board_by_id(board_id, auth["sub"])
    if result is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return result


@app.put("/api/boards/{board_id}", response_model=BoardData, tags=["Boards"])
def update_user_board(
    board_id: int, payload: BoardData, auth: dict = Depends(require_auth)
) -> BoardData:
    result = update_board_data(board_id, auth["sub"], payload.model_dump())
    if result is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return BoardData.model_validate(result)


@app.patch("/api/boards/{board_id}", tags=["Boards"])
def patch_user_board_meta(
    board_id: int, payload: UpdateBoardMetaRequest, auth: dict = Depends(require_auth)
) -> dict:
    result = update_board_meta(board_id, auth["sub"], payload.name, payload.description)
    if result is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return result


@app.delete("/api/boards/{board_id}", tags=["Boards"])
def delete_user_board(board_id: int, auth: dict = Depends(require_auth)) -> dict:
    deleted = delete_board(board_id, auth["sub"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Board not found")
    return {"deleted": True}


@app.get("/api/boards/{board_id}/export", tags=["Boards"])
def export_board(board_id: int, auth: dict = Depends(require_auth)) -> dict:
    """Export a board as a JSON object for download."""
    result = get_board_by_id(board_id, auth["sub"])
    if result is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return {
        "name": result["name"],
        "description": result["description"],
        "board": result["board"],
    }


@app.post("/api/boards/{board_id}/duplicate", tags=["Boards"])
def duplicate_board(board_id: int, auth: dict = Depends(require_auth)) -> dict:
    """Duplicate an existing board with all its data."""
    result = get_board_by_id(board_id, auth["sub"])
    if result is None:
        raise HTTPException(status_code=404, detail="Board not found")
    new_name = f"{result['name']} (copy)"
    with get_connection() as conn:
        new_board = _create_board_for_user(
            conn, auth["sub"], new_name, result["description"], result["board"]
        )
        conn.commit()
        return new_board


@app.post("/api/boards/import", tags=["Boards"])
def import_board(payload: ImportBoardRequest, auth: dict = Depends(require_auth)) -> dict:
    """Import a board from a JSON export."""
    with get_connection() as conn:
        result = _create_board_for_user(
            conn, auth["sub"], payload.name, payload.description, payload.board.model_dump()
        )
        conn.commit()
        return result


# --- AI ---


@app.get("/api/ai/status", tags=["AI"])
def ai_status() -> dict[str, bool]:
    return {"enabled": is_ai_enabled()}


@app.get("/api/ai/test", tags=["AI"])
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


@app.post(
    "/api/ai/chat/{board_id}",
    response_model=AIChatAPIResponse,
    tags=["AI"],
)
@limiter.limit("10/minute")
def ai_chat_board(
    request: Request,
    board_id: int,
    payload: AIChatRequest,
    auth: dict = Depends(require_auth),
) -> AIChatAPIResponse:
    """AI chat scoped to a specific board (authenticated)."""
    if not is_ai_enabled():
        raise HTTPException(
            status_code=503,
            detail="AI is disabled because OPENROUTER_API_KEY is not set.",
        )

    board_record = get_board_by_id(board_id, auth["sub"])
    if board_record is None:
        raise HTTPException(status_code=404, detail="Board not found")

    current_board = BoardData.model_validate(board_record["board"])

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
        persisted = update_board_data(
            board_id, auth["sub"], structured.board_update.model_dump()
        )
        if persisted is None:
            raise HTTPException(status_code=404, detail="Board not found")
        return AIChatAPIResponse(
            reply=structured.reply,
            board_update=BoardData.model_validate(persisted),
        )

    return AIChatAPIResponse(reply=structured.reply, board_update=None)


# --- Legacy endpoints (keep backward compatibility) ---


@app.get("/api/board/{username}", response_model=BoardData, tags=["Board (Legacy)"])
def read_board(username: str) -> BoardData:
    try:
        board = get_board(username)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="User not found") from exc
    return BoardData.model_validate(board)


@app.put("/api/board/{username}", response_model=BoardData, tags=["Board (Legacy)"])
def write_board(username: str, payload: BoardData) -> BoardData:
    try:
        board = update_board(username, payload.model_dump())
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="User not found") from exc
    return BoardData.model_validate(board)


@app.post(
    "/api/ai/chat/legacy/{username}",
    response_model=AIChatAPIResponse,
    tags=["AI"],
)
@limiter.limit("10/minute")
def ai_chat(
    request: Request, username: str, payload: AIChatRequest
) -> AIChatAPIResponse:
    """Legacy AI chat endpoint using username."""
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


# --- Static files ---

if frontend_dist_dir.exists():
    app.mount("/", StaticFiles(directory=frontend_dist_dir, html=True), name="frontend")
else:
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="fallback-static")
