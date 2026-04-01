# Project execution plan

This plan turns the MVP into a sequence of small, reviewable parts. Each part has:
- explicit checklist items
- test plan
- success criteria
- a required approval gate before the next part

## Fixed decisions

- Frontend: Next.js
- Backend: FastAPI (Python), served in one Docker container
- Python package manager in container: `uv`
- AI provider: OpenRouter
- AI model: `anthropic/claude-sonnet-4.6`
- DB: SQLite, one board per user for MVP
- Board persistence format: JSON stored in a single SQLite column per board
- AI key behavior: feature flag fallback when `OPENROUTER_API_KEY` is missing
- Structured outputs for AI: required and schema-validated
- Testing expectation for UI work: near-full flow coverage
- Process: explicit approval gate between every part

## Part 1: Plan and frontend documentation

### Checklist
- [x] Expand this plan with detailed tasks, tests, and success criteria (this document).
- [x] Document current frontend architecture in `frontend/AGENTS.md`.
- [x] Include frontend coding conventions and test commands in `frontend/AGENTS.md`.
- [x] Request user approval before starting Part 2.

### Test plan
- [x] Verify `docs/PLAN.md` is actionable and checkable (all parts have checklists/tests/success criteria).
- [x] Verify `frontend/AGENTS.md` reflects current code structure and available test scripts.

### Success criteria
- Part-by-part implementation details are documented clearly enough to execute without guesswork.
- `frontend/AGENTS.md` exists and accurately describes current frontend behavior and standards.
- User approval is recorded before Part 2.

### Approval gate
- Completed: user confirmed plan and approved Part 1 outputs.

## Part 2: Scaffolding (single container + hello world)

### Checklist
- [x] Create `backend/` FastAPI app scaffold with health endpoint and example API endpoint.
- [x] Create Dockerfile for single-container runtime containing backend and built frontend artifacts path placeholders.
- [x] Add `scripts/` start/stop scripts for macOS, Linux, and Windows.
- [x] Serve a temporary static hello-world HTML page at `/`.
- [x] Ensure one sample API call works from the running app.
- [x] Add backend test scaffold (`pytest`) and basic smoke tests.

### Test plan
- [x] `docker build` succeeds.
- [x] Container starts locally and serves `/` hello-world page.
- [x] API endpoint responds with expected JSON.
- [x] Start/stop scripts work on their target OS syntax.
- [x] Backend smoke tests pass.

### Success criteria
- One container can be built and run locally.
- `/` serves temporary static content and `/api/...` returns JSON.
- Scripts and tests are present and passing.

### Approval gate
- Completed: user approved scaffolding.

## Part 3: Integrate existing frontend build

### Checklist
- [x] Configure frontend static build output for container usage.
- [x] Wire FastAPI static serving so `/` serves the built Next.js frontend.
- [x] Keep API routing functional alongside static serving.
- [x] Preserve current Kanban demo behavior.
- [x] Add/update tests for integration between serving layer and frontend delivery.

### Test plan
- [x] Frontend unit tests pass.
- [x] Frontend e2e tests pass against served app.
- [x] Container run confirms Kanban board renders at `/`.
- [x] Verify backend API endpoint still reachable.

### Success criteria
- The demo Kanban appears at `/` from the containerized app.
- Existing interactions still work (rename, add/remove, drag/drop).
- Tests validate both app shell and UI behavior.

### Approval gate
- Completed: user approved frontend integration.

## Part 4: Fake sign-in flow (user/password)

### Checklist
- [x] Add login screen shown before board access.
- [x] Implement dummy credential check (`user` / `password`).
- [x] Add logout behavior that returns user to login screen.
- [x] Prevent unauthenticated access to Kanban routes.
- [x] Keep UX simple and consistent with existing visual style.
- [x] Add near-full UI flow tests for login/logout/error paths.

### Test plan
- [x] Unit tests for credential validator and auth state transitions.
- [x] Integration tests for protected route behavior.
- [x] E2E tests for successful login, failed login, logout, and blocked unauthenticated access.

### Success criteria
- Users cannot reach Kanban UI without valid dummy login.
- Login/logout flows are deterministic and tested.
- Coverage includes primary and failure paths.

### Approval gate
- Completed: user approved auth flow.

## Part 5: Database modeling (SQLite JSON board)

### Checklist
- [x] Design SQLite schema for users and boards.
- [x] Store full board payload in a single JSON text column per board row.
- [x] Document data model, constraints, and migration/init approach in `docs/`.
- [x] Define how one-board-per-user is enforced for MVP.
- [x] Get user sign-off on schema doc before backend implementation.

### Test plan
- [x] Validate schema can create fresh DB from empty state.
- [x] Validate read/write cycle for board JSON payload.
- [x] Validate one-board-per-user constraints.

### Success criteria
- Schema is documented and approved.
- DB initialization path is clear and repeatable.
- JSON storage format is stable and matches frontend board shape.

### Approval gate
- Completed: user approved schema/docs.

## Part 6: Backend board API

### Checklist
- [x] Implement DB bootstrap/create-if-missing logic.
- [x] Add API routes to fetch and update a user board.
- [x] Add request/response validation models.
- [x] Add error handling for bad payloads and missing users/boards.
- [x] Add backend unit tests for DB and API behavior.

### Test plan
- [x] Backend unit tests for create/read/update paths.
- [x] Validation tests for malformed payloads.
- [x] DB bootstrap test verifies first-run DB creation.

### Success criteria
- Backend can persist and return board JSON reliably.
- DB is auto-created on first run.
- Test suite covers core logic and edge cases.

### Approval gate
- Completed: user approved backend API.

## Part 7: Frontend + backend persistence

### Checklist
- [x] Replace in-memory board initialization with backend fetch.
- [x] Persist board changes via backend API (rename/add/delete/move).
- [x] Add loading/error UX states that keep interactions understandable.
- [x] Ensure behavior remains smooth and deterministic.
- [x] Add near-full UI flow tests for persistence and reload behavior.

### Test plan
- [x] Unit tests for frontend API client/state orchestration.
- [x] Integration tests for optimistic/non-optimistic update behavior.
- [x] E2E tests verifying persisted changes survive page refresh.

### Success criteria
- Board state is persisted and reloaded from backend.
- Core Kanban interactions still behave as expected.
- Failures are surfaced with clear user feedback.

### Approval gate
- Completed: user approved persistent board behavior.

## Part 8: AI connectivity baseline

### Checklist
- [x] Add backend AI client integration with OpenRouter.
- [x] Use configured model `anthropic/claude-sonnet-4.6`.
- [x] Add feature flag behavior when `OPENROUTER_API_KEY` is not set.
- [x] Add simple connectivity endpoint/test prompt (`2+2`).
- [x] Document local setup expectations in `docs/`.

### Test plan
- [x] Unit tests for AI client config and key-missing fallback behavior.
- [x] Integration test/mocked test for successful provider call shape.
- [x] Local connectivity check using `2+2` when key is present.

### Success criteria
- AI path works when key is provided.
- App remains functional with AI disabled when key is absent.
- Behavior is explicitly documented and tested.

### Approval gate
- Completed: user approved AI baseline.

## Part 9: Structured AI board operations

### Checklist
- [x] Define strict structured output schema for AI response.
- [x] Include board JSON, user message, and conversation history in prompt payload.
- [x] Parse and validate AI response against schema.
- [x] Support optional board update operation from AI response.
- [x] Handle schema failures with safe fallback and clear error response.
- [x] Add backend tests for valid/invalid structured responses.

### Test plan
- [x] Unit tests for schema validation and mapping to domain updates.
- [x] Integration tests for "reply only" and "reply + board update" flows.
- [x] Negative tests for invalid AI output and fallback handling.

### Success criteria
- Structured outputs are mandatory and validated.
- Backend returns deterministic response object to frontend.
- Invalid AI outputs do not corrupt persisted board state.

### Approval gate
- Completed: user approved structured output behavior.

## Part 10: AI sidebar UX and live board updates

### Checklist
- [x] Add sidebar chat UI aligned with existing design system.
- [x] Implement conversation display, input handling, and loading/error states.
- [x] Connect frontend chat to backend AI endpoint.
- [x] Apply AI-proposed board updates and refresh UI state automatically.
- [x] Add near-full flow tests for chat-only and chat+board-update paths.

### Test plan
- [x] Component tests for sidebar states (idle/loading/error/success).
- [x] Integration tests for chat request lifecycle.
- [x] E2E tests validating that AI updates appear on board without manual refresh.

### Success criteria
- Sidebar chat is usable and visually coherent.
- AI responses are shown reliably.
- Board updates from AI are reflected immediately and persisted.

### Approval gate
- Completed: user approved final MVP completion.

## Delivery workflow for all parts

- Work one part at a time.
- Run tests scoped to touched areas, then broader regression checks as needed.
- Report what changed, what passed, and any residual risk.
- Stop at each approval gate and wait for explicit user sign-off before continuing.