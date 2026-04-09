import type { BoardData } from "@/lib/kanban";
import { getAuthHeaders } from "@/lib/auth";

export type ChatRole = "user" | "assistant";

export type AIChatHistoryItem = {
  role: ChatRole;
  content: string;
};

export type AIChatResponse = {
  reply: string;
  board_update: BoardData | null;
};

export type BoardSummary = {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type BoardDetail = {
  id: number;
  user_id: number;
  name: string;
  description: string;
  board: BoardData;
  created_at: string;
  updated_at: string;
};

const parseErrorMessage = async (response: Response) => {
  try {
    const body = await response.json();
    if (body && typeof body.detail === "string") {
      return body.detail;
    }
  } catch {
    // Ignore parse failures and fall through to status message.
  }
  return `Request failed (${response.status})`;
};

const authFetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const headers = {
    ...getAuthHeaders(),
    ...(init.headers || {}),
  };
  return fetch(url, { ...init, headers });
};

// --- Multi-board API ---

export const listBoards = async (): Promise<BoardSummary[]> => {
  const response = await authFetch("/api/boards");
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as BoardSummary[];
};

export const createBoard = async (
  name: string,
  description: string = "",
  template: string = "kanban"
): Promise<{ id: number; name: string; description: string }> => {
  const response = await authFetch("/api/boards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, template }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return await response.json();
};

export const fetchBoardById = async (boardId: number): Promise<BoardDetail> => {
  const response = await authFetch(`/api/boards/${boardId}`);
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as BoardDetail;
};

export const persistBoardById = async (
  boardId: number,
  board: BoardData
): Promise<BoardData> => {
  const response = await authFetch(`/api/boards/${boardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(board),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as BoardData;
};

export const updateBoardMeta = async (
  boardId: number,
  name: string,
  description: string
): Promise<{ id: number; name: string; description: string }> => {
  const response = await authFetch(`/api/boards/${boardId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return await response.json();
};

export const deleteBoard = async (boardId: number): Promise<void> => {
  const response = await authFetch(`/api/boards/${boardId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
};

export const sendAIChatForBoard = async (
  boardId: number,
  payload: { question: string; history: AIChatHistoryItem[] }
): Promise<AIChatResponse> => {
  const response = await authFetch(`/api/ai/chat/${boardId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AIChatResponse;
};

// --- Board export/import ---

export const exportBoard = async (boardId: number): Promise<{ name: string; description: string; board: BoardData }> => {
  const response = await authFetch(`/api/boards/${boardId}/export`);
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return await response.json();
};

export const importBoard = async (
  name: string,
  description: string,
  board: BoardData
): Promise<{ id: number; name: string; description: string }> => {
  const response = await authFetch("/api/boards/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, board }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return await response.json();
};

// --- Legacy API (kept for backward compatibility) ---

export const fetchBoard = async (username: string): Promise<BoardData> => {
  const response = await fetch(`/api/board/${username}`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as BoardData;
};

export const persistBoard = async (
  username: string,
  board: BoardData
): Promise<BoardData> => {
  const response = await fetch(`/api/board/${username}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(board),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as BoardData;
};

export const sendAIChat = async (
  username: string,
  payload: { question: string; history: AIChatHistoryItem[] }
): Promise<AIChatResponse> => {
  const response = await fetch(`/api/ai/chat/legacy/${username}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AIChatResponse;
};
