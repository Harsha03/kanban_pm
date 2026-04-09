from typing import Literal

from pydantic import BaseModel, Field, field_validator


PriorityLevel = Literal["critical", "high", "medium", "low"]

# --- Auth models ---


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class AuthResponse(BaseModel):
    token: str
    user: dict


class UserResponse(BaseModel):
    id: int
    username: str


# --- Board list models ---


BoardTemplate = Literal["blank", "kanban", "scrum", "bug-tracking"]


class CreateBoardRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    template: BoardTemplate = "kanban"


class UpdateBoardMetaRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)


class BoardSummary(BaseModel):
    id: int
    name: str
    description: str
    created_at: str
    updated_at: str
StageIconName = Literal[
    "inbox",
    "search",
    "play",
    "eye",
    "check-circle",
    "circle-dot",
    "clock",
    "pause",
    "skip-forward",
    "archive",
    "rocket",
    "lightbulb",
    "flame",
    "bookmark",
    "bell",
    "shield",
    "settings",
    "flag",
    "target",
    "zap",
    "star",
]


class Label(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=50)
    color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")


class CardComment(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=1000)
    createdAt: str


class Card(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    details: str = Field(max_length=2000)
    priority: PriorityLevel
    dueDate: str | None = None
    labelIds: list[str] = Field(default_factory=list, max_length=20)
    comments: list[CardComment] = Field(default_factory=list, max_length=100)


class Column(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=100)
    color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: StageIconName
    cardIds: list[str] = Field(default_factory=list, max_length=500)


class BoardData(BaseModel):
    columns: list[Column] = Field(min_length=1, max_length=20)
    cards: dict[str, Card] = Field(max_length=500)
    labels: list[Label] = Field(default_factory=list, max_length=50)

    @field_validator('columns')
    @classmethod
    def validate_unique_column_ids(cls, columns: list[Column]) -> list[Column]:
        """Ensure all column IDs are unique."""
        ids = [col.id for col in columns]
        if len(ids) != len(set(ids)):
            raise ValueError("Column IDs must be unique")
        return columns

    @field_validator('cards')
    @classmethod
    def validate_card_ids_match_keys(cls, cards: dict[str, Card]) -> dict[str, Card]:
        """Ensure card IDs match their dictionary keys."""
        for key, card in cards.items():
            if key != card.id:
                raise ValueError(f"Card key '{key}' does not match card ID '{card.id}'")
        return cards


class ImportBoardRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    board: BoardData


class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AIChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    history: list[ChatHistoryItem] = Field(default_factory=list, max_length=50)


class AIChatStructuredResponse(BaseModel):
    reply: str
    board_update: BoardData | None = None


class AIChatAPIResponse(BaseModel):
    reply: str
    board_update: BoardData | None = None
