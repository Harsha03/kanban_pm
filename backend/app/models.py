from typing import Literal

from pydantic import BaseModel, Field


PriorityLevel = Literal["critical", "high", "medium", "low"]
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


class Card(BaseModel):
    id: str
    title: str
    details: str
    priority: PriorityLevel


class Column(BaseModel):
    id: str
    title: str
    color: str
    icon: StageIconName
    cardIds: list[str] = Field(default_factory=list)


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]


class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AIChatRequest(BaseModel):
    question: str
    history: list[ChatHistoryItem] = Field(default_factory=list)


class AIChatStructuredResponse(BaseModel):
    reply: str
    board_update: BoardData | None = None


class AIChatAPIResponse(BaseModel):
    reply: str
    board_update: BoardData | None = None
