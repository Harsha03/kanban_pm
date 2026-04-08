import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from backend.app.config import AIConfig, get_openrouter_api_key
from backend.app.models import AIChatStructuredResponse, BoardData, ChatHistoryItem


class AIUnavailableError(Exception):
    pass


class AIProviderError(Exception):
    pass


STRUCTURED_RESPONSE_SCHEMA = {
    "name": "kanban_assistant_response",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "reply": {"type": "string"},
            "board_update": {
                "anyOf": [
                    {"type": "null"},
                    {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "columns": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "additionalProperties": False,
                                    "properties": {
                                        "id": {"type": "string"},
                                        "title": {"type": "string"},
                                        "color": {"type": "string"},
                                        "icon": {
                                            "type": "string",
                                            "enum": [
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
                                            ],
                                        },
                                        "cardIds": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                        },
                                    },
                                    "required": ["id", "title", "color", "icon", "cardIds"],
                                },
                            },
                            "cards": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": "object",
                                    "additionalProperties": False,
                                    "properties": {
                                        "id": {"type": "string"},
                                        "title": {"type": "string"},
                                        "details": {"type": "string"},
                                        "priority": {
                                            "type": "string",
                                            "enum": ["critical", "high", "medium", "low"],
                                        },
                                    },
                                    "required": ["id", "title", "details", "priority"],
                                },
                            },
                        },
                        "required": ["columns", "cards"],
                    },
                ]
            },
        },
        "required": ["reply", "board_update"],
    },
}


def is_ai_enabled() -> bool:
    return bool(get_openrouter_api_key())


def _extract_json_object(text: str) -> dict:
    """
    Extract JSON object from AI response with multiple fallback strategies.

    The AI might return JSON in various formats:
    1. Plain JSON: {"reply": "..."}
    2. Markdown fenced: ```json\n{"reply": "..."}\n```
    3. With explanation: Here is the response: {"reply": "..."}

    Args:
        text: Raw AI response text

    Returns:
        Parsed JSON dictionary

    Raises:
        json.JSONDecodeError: If no valid JSON object can be extracted
    """
    stripped = text.strip()

    # Strategy 1: Strip markdown code fences
    if stripped.startswith("```"):
        stripped = stripped.strip("`").strip()
        # Remove 'json' language hint if present
        if stripped.startswith("json"):
            stripped = stripped[4:].strip()

    # Strategy 2: Try direct JSON parse (most common case)
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # Strategy 3: Extract first JSON object from surrounding text
    # Find first '{' and last '}' to isolate JSON object
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = stripped[start : end + 1]
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed

    raise json.JSONDecodeError("No JSON object found", stripped, 0)


def _extract_message_content(payload: dict) -> str:
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise AIProviderError("OpenRouter response did not include choices.")

    message = choices[0].get("message", {})
    content = message.get("content", "")
    if isinstance(content, str):
        return content.strip()

    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict):
                text = block.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return " ".join(parts).strip()

    raise AIProviderError("OpenRouter response content format is unsupported.")


def call_openrouter(
    messages: list[dict[str, str]], response_format: dict | None = None
) -> str:
    api_key = get_openrouter_api_key()
    if not api_key:
        raise AIUnavailableError("OPENROUTER_API_KEY is not set.")

    payload = {
        "model": AIConfig.OPENROUTER_MODEL,
        "messages": messages,
        "temperature": AIConfig.TEMPERATURE,
    }
    if response_format:
        payload["response_format"] = response_format
    body = json.dumps(payload).encode("utf-8")
    request = Request(
        AIConfig.OPENROUTER_URL,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )

    try:
        with urlopen(request, timeout=AIConfig.TIMEOUT_SECONDS) as response:
            response_body = response.read().decode("utf-8")
    except HTTPError as exc:
        detail = exc.read().decode("utf-8") if exc.fp else str(exc)
        raise AIProviderError(f"OpenRouter HTTP error: {detail}") from exc
    except URLError as exc:
        raise AIProviderError(f"OpenRouter connection error: {exc}") from exc

    try:
        parsed = json.loads(response_body)
    except json.JSONDecodeError as exc:
        raise AIProviderError("OpenRouter response was not valid JSON.") from exc

    return _extract_message_content(parsed)


def run_connectivity_test() -> dict[str, str]:
    answer = call_openrouter(
        [
            {"role": "system", "content": "You are a precise assistant."},
            {"role": "user", "content": "What is 2+2? Reply with just the number."},
        ]
    )
    return {"model": AIConfig.OPENROUTER_MODEL, "answer": answer}


def run_structured_board_chat(
    board: BoardData, history: list[ChatHistoryItem], question: str
) -> AIChatStructuredResponse:
    system_prompt = (
        "You are a Kanban assistant. Always return structured JSON only. "
        "Use board_update only when you intend to change the board. "
        "If no change is required, set board_update to null."
    )

    trimmed_history = history[-AIConfig.MAX_HISTORY_ITEMS:]
    context_prompt = (
        "Current board JSON:\n"
        f"{board.model_dump_json()}\n\n"
        "Conversation history JSON:\n"
        f"{json.dumps([item.model_dump() for item in trimmed_history])}\n\n"
        "User question:\n"
        f"{question}"
    )

    attempt_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": context_prompt},
    ]
    # Single structured attempt, then plain-text fallback to reduce latency.
    for _ in range(1):
        raw = call_openrouter(
            attempt_messages,
            response_format={"type": "json_object"},
        )
        try:
            parsed = _extract_json_object(raw)
            try:
                return AIChatStructuredResponse.model_validate(parsed)
            except Exception:
                # Safe fallback: preserve assistant reply, ignore invalid board updates.
                if isinstance(parsed, dict) and isinstance(parsed.get("reply"), str):
                    return AIChatStructuredResponse(reply=parsed["reply"], board_update=None)
                raise
        except json.JSONDecodeError:
            attempt_messages.append(
                {
                    "role": "system",
                    "content": (
                        "Your previous response was invalid. Reply with ONLY a JSON object "
                        "matching keys: reply (string), board_update (null or board object)."
                    ),
                }
            )
            continue
        except Exception:
            attempt_messages.append(
                {
                    "role": "system",
                    "content": (
                        "Your previous response had invalid schema. "
                        "Reply with ONLY JSON containing reply (string) and "
                        "board_update (null or complete board object)."
                    ),
                }
            )
            continue

    # Final safe fallback: return plain reply with no board mutation.
    fallback_reply = call_openrouter(
        [
            {"role": "system", "content": "You are a concise project management assistant."},
            {"role": "user", "content": question},
        ]
    )
    return AIChatStructuredResponse(reply=fallback_reply, board_update=None)
