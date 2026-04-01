# AI connectivity baseline (Part 8)

This document defines the MVP AI connectivity path using OpenRouter.

## Configuration

- Provider: OpenRouter
- Model: `anthropic/claude-sonnet-4.6`
- Required env var: `OPENROUTER_API_KEY`

## Feature flag behavior

- If `OPENROUTER_API_KEY` is missing:
  - application still starts and all non-AI features continue to work
  - `GET /api/ai/status` returns `{"enabled": false}`
  - `GET /api/ai/test` returns `503` with a clear disabled message

- If `OPENROUTER_API_KEY` is set:
  - `GET /api/ai/status` returns `{"enabled": true}`
  - `GET /api/ai/test` performs a real connectivity call with prompt: `What is 2+2?`

## API endpoints

- `GET /api/ai/status`
  - returns whether AI is enabled based on config

- `GET /api/ai/test`
  - sends a deterministic low-temperature test request to OpenRouter
  - returns:
    - `model`: `anthropic/claude-sonnet-4.6`
    - `answer`: model response text

- `POST /api/ai/chat/{username}`
  - always includes three inputs in the prompt:
    - current board JSON
    - conversation history
    - current user question
  - uses strict JSON schema structured outputs
  - response shape:
    - `reply` (string)
    - `board_update` (`null` or full board object)
  - when `board_update` is present, backend persists it before returning
  - returns:
    - `503` if AI is disabled
    - `502` if provider output fails structured validation

## Local verification steps

Run app, then:

```bash
curl -sS http://127.0.0.1:8000/api/ai/status
curl -sS http://127.0.0.1:8000/api/ai/test
```

Expected outcomes:

- without key: status false and `/api/ai/test` returns 503
- with key: status true and `/api/ai/test` returns a response with `answer` (expected `4`)
