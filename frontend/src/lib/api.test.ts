import { fetchBoard, persistBoard, sendAIChat } from "@/lib/api";
import { initialData } from "@/lib/kanban";

describe("api client", () => {
  it("fetches board data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => initialData,
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const board = await fetchBoard("user");
    expect(fetchMock).toHaveBeenCalledWith("/api/board/user", { method: "GET" });
    expect(board.columns).toHaveLength(5);
  });

  it("persists board data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => initialData,
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const board = await persistBoard("user", initialData);
    expect(fetchMock).toHaveBeenCalledWith("/api/board/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initialData),
    });
    expect(board.columns).toHaveLength(5);
  });

  it("throws useful errors for failed requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ detail: "User not found" }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchBoard("missing")).rejects.toThrow("User not found");
  });

  it("sends ai chat payload and parses response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: "Done.", board_update: null }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const response = await sendAIChat("user", {
      question: "Summarize",
      history: [{ role: "user", content: "Hi" }],
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/ai/chat/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Summarize",
        history: [{ role: "user", content: "Hi" }],
      }),
    });
    expect(response.reply).toBe("Done.");
    expect(response.board_update).toBeNull();
  });
});
