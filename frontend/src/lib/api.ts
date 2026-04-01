import type { BoardData } from "@/lib/kanban";

export type ChatRole = "user" | "assistant";

export type AIChatHistoryItem = {
  role: ChatRole;
  content: string;
};

export type AIChatResponse = {
  reply: string;
  board_update: BoardData | null;
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
  const response = await fetch(`/api/ai/chat/${username}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AIChatResponse;
};
