"""Application configuration constants."""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


class AIConfig:
    """AI-related configuration."""

    OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
    OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6"
    MAX_HISTORY_ITEMS = 10
    TIMEOUT_SECONDS = 30
    TEMPERATURE = 0


class BoardConfig:
    """Board data validation limits."""

    MAX_COLUMNS = 20
    MIN_COLUMNS = 1
    MAX_CARDS = 500
    MAX_CARDS_PER_COLUMN = 500


class CardConfig:
    """Card data validation limits."""

    MAX_ID_LENGTH = 100
    MAX_TITLE_LENGTH = 200
    MAX_DETAILS_LENGTH = 2000


class ColumnConfig:
    """Column data validation limits."""

    MAX_ID_LENGTH = 100
    MAX_TITLE_LENGTH = 100


class ChatConfig:
    """Chat/AI request validation limits."""

    MAX_QUESTION_LENGTH = 2000
    MAX_HISTORY_LENGTH = 50


def get_openrouter_api_key() -> str | None:
    """Get OpenRouter API key from environment."""
    return os.getenv("OPENROUTER_API_KEY")


def is_ai_enabled() -> bool:
    """Check if AI features are enabled (API key is set)."""
    return bool(get_openrouter_api_key())
