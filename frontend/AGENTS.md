# Frontend agent guide

This document describes the current frontend codebase and the expectations for making changes safely.

## Purpose

- Next.js app that renders a login-gated single-page Kanban experience.
- Current implementation persists board state via backend API when available.
- Main user interactions today: sign in/out, rename columns, add cards, remove cards, and drag/drop cards.
- Main user interactions today: sign in/out, rename columns, add cards, remove cards, drag/drop cards, and AI chat from sidebar.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript (strict mode)
- Tailwind CSS v4 for styling
- `@dnd-kit/*` for drag and drop behavior
- Testing: Vitest + Testing Library (unit/component), Playwright (e2e)
- Linting: ESLint with `eslint-config-next` core-web-vitals + TypeScript config

## Current file map

- `src/app/layout.tsx`: global layout, fonts, metadata, and CSS import
- `src/app/page.tsx`: mounts auth shell for protected access
- `src/app/globals.css`: design tokens and global styles
- `src/lib/auth.ts`: dummy credential validation + local auth storage helpers
- `src/lib/api.ts`: backend board fetch/update client
- `src/lib/kanban.ts`: board/card/column types, seed data, drag move logic, id creation
- `src/components/AuthShell.tsx`: login/logout gate and protected Kanban render
- `src/components/KanbanBoard.tsx`: top-level board state and behavior orchestration
- `src/components/KanbanColumn.tsx`: droppable column UI + column title editing + card list
- `src/components/KanbanCard.tsx`: sortable card UI and delete action
- `src/components/NewCardForm.tsx`: inline add-card form state/validation
- `src/components/*.test.tsx`: component tests
- `src/lib/*.test.ts`: utility logic tests
- `tests/kanban.spec.ts`: end-to-end smoke and interaction flows

## Architecture notes

- The home route renders `AuthShell`, which gates `KanbanBoard`.
- Login uses dummy credentials (`user` / `password`) and stores auth in `localStorage`.
- `KanbanBoard` owns board state and passes callbacks down to child components.
- `KanbanBoard` loads board from `/api/board/user` and persists changes with `PUT /api/board/user`.
- `KanbanBoard` includes an AI sidebar that calls `POST /api/ai/chat/user` and applies `board_update` responses immediately.
- If backend API is unavailable (frontend-only dev), board falls back to local storage mode.
- Data model uses:
  - `columns`: ordered list with `cardIds`
  - `cards`: object map by card id
- Reordering/moving cards is centralized in `moveCard()` in `src/lib/kanban.ts`.
- DnD behavior:
  - draggable cards via `useSortable`
  - droppable columns via `useDroppable`
  - drag overlay preview shown while dragging

## Coding conventions

- Keep implementation simple and direct. Do not add abstraction layers without need.
- Prefer pure helper functions for board transforms and keep React components focused on UI wiring.
- Keep state updates immutable and colocated with the state owner.
- Reuse `@/*` imports for local modules (see `tsconfig.json` path alias).
- Preserve existing naming style:
  - `handleX` for event handlers
  - `onX` for callback props
  - explicit prop types for components
- Maintain accessibility basics:
  - use semantic elements where possible
  - keep labels/placeholders/test ids stable when changing UI behavior
- Keep visual tokens aligned with `src/app/globals.css` CSS variables.

## Test commands

Run from `frontend/`:

```bash
npm install
npm run lint
npm run test:unit
npm run test:e2e
npm run test:all
```

Additional commands:

```bash
npm run dev
npm run build
npm run start
npm run test:unit:watch
```

## Change checklist for agents

- Update or add unit tests for behavior changes in `src/lib` and components.
- Update e2e tests in `tests/` for user-visible flow changes.
- Run lint and affected tests before handing off.
- Keep this file updated if frontend architecture or commands change.
