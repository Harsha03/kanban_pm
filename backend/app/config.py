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


def get_openrouter_api_key() -> str | None:
    """Get OpenRouter API key from environment."""
    return os.getenv("OPENROUTER_API_KEY")
