import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData } from "@/lib/kanban";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  it("renders five columns", () => {
    render(<KanbanBoard useApi={false} />);
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    render(<KanbanBoard useApi={false} />);
    await userEvent.dblClick(screen.getByTestId("stage-header-col-backlog"));
    await userEvent.click(screen.getByTestId("open-stage-settings"));
    const input = within(screen.getByTestId("stage-settings-modal")).getByLabelText("Stage name");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard useApi={false} />);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);
    expect(screen.getByTestId("add-card-modal")).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = screen.getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(screen.getByTestId("confirm-add-card"));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("edits an existing card from the card modal", async () => {
    render(<KanbanBoard useApi={false} />);
    const column = getFirstColumn();
    await userEvent.click(within(column).getByTestId("card-card-1"));
    expect(screen.getByTestId("edit-card-modal")).toBeInTheDocument();

    const titleInput = screen.getByDisplayValue("Align roadmap themes");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Roadmap themes updated");
    await userEvent.click(screen.getByTestId("save-card-edits"));

    expect(await within(column).findByText("Roadmap themes updated")).toBeInTheDocument();
  });

  it("adds and removes stages", async () => {
    render(<KanbanBoard useApi={false} />);

    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
    await userEvent.click(screen.getByTestId("inline-add-stage-button"));
    await userEvent.type(screen.getByPlaceholderText(/new stage name/i), "Ideas");
    await userEvent.click(screen.getByTestId("inline-confirm-add-stage"));
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(6);

    await userEvent.dblClick(
      screen.getByRole("button", { name: /open ideas stage details/i })
    );
    await userEvent.click(screen.getByTestId("open-stage-settings"));
    await userEvent.click(screen.getByTestId("remove-stage-from-settings"));
    expect(screen.getByTestId("remove-stage-modal")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("confirm-remove-stage"));
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("closes remove-stage modal on Escape", async () => {
    render(<KanbanBoard useApi={false} />);
    await userEvent.dblClick(screen.getByTestId("stage-header-col-backlog"));
    await userEvent.click(screen.getByTestId("open-stage-settings"));
    await userEvent.click(screen.getByTestId("remove-stage-from-settings"));
    expect(screen.getByTestId("remove-stage-modal")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByTestId("remove-stage-modal")).not.toBeInTheDocument();
  });

  it("closes remove-stage modal on outside click", async () => {
    render(<KanbanBoard useApi={false} />);
    await userEvent.dblClick(screen.getByTestId("stage-header-col-backlog"));
    await userEvent.click(screen.getByTestId("open-stage-settings"));
    await userEvent.click(screen.getByTestId("remove-stage-from-settings"));
    const modalOverlay = screen.getByTestId("remove-stage-modal");
    expect(modalOverlay).toBeInTheDocument();
    await userEvent.click(modalOverlay);
    expect(screen.queryByTestId("remove-stage-modal")).not.toBeInTheDocument();
  });

  it("opens stage popup from a column header and removes a card from it", async () => {
    render(<KanbanBoard useApi={false} />);
    await userEvent.dblClick(screen.getByTestId("stage-header-col-backlog"));

    const stageModal = screen.getByTestId("stage-popup-modal");
    expect(stageModal).toBeInTheDocument();
    expect(stageModal).toHaveTextContent(/Total cards:\s*2/i);

    const removeButtons = within(stageModal).getAllByRole("button", { name: /remove/i });
    await userEvent.click(removeButtons[0]);

    expect(within(getFirstColumn()).queryByText("Align roadmap themes")).not.toBeInTheDocument();
  });

  it("opens add card modal from expanded stage view", async () => {
    render(<KanbanBoard useApi={false} />);
    await userEvent.dblClick(screen.getByTestId("stage-header-col-backlog"));
    await userEvent.click(
      within(screen.getByTestId("stage-popup-modal")).getByRole("button", { name: /\+ add a card/i })
    );
    expect(screen.getByTestId("add-card-modal")).toBeInTheDocument();
    expect(screen.getByText(/add new card to backlog/i)).toBeInTheDocument();
  });

  it("opens stage settings from stage popup gear and allows renaming", async () => {
    render(<KanbanBoard useApi={false} />);
    await userEvent.dblClick(
      screen.getByRole("button", { name: /open backlog stage details/i })
    );

    await userEvent.click(screen.getByTestId("open-stage-settings"));
    expect(screen.getByTestId("stage-settings-modal")).toBeInTheDocument();

    const stageNameInput = screen.getByDisplayValue("Backlog");
    await userEvent.clear(stageNameInput);
    await userEvent.type(stageNameInput, "Intake");

    const matches = await screen.findAllByText("Intake");
    expect(matches.length).toBeGreaterThan(0);
  });

  it("adds discoverability hints for double-click expand actions", () => {
    render(<KanbanBoard useApi={false} />);
    expect(screen.getByTestId("stage-header-col-backlog")).toHaveAttribute(
      "title",
      "Double-click to expand"
    );
    expect(
      screen.getByRole("button", { name: /open backlog stage details/i })
    ).toHaveAttribute("title", "Double-click to expand");
  });

  it("shows ai reply in sidebar chat", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => initialData,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reply: "AI summary", board_update: null }),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<KanbanBoard />);
    await screen.findByRole("heading", { name: "Kanban Studio" });
    await userEvent.click(screen.getByTestId("open-ai-chat"));

    await userEvent.type(
      screen.getByPlaceholderText(/ask ai to explain or update this board/i),
      "Summarize"
    );
    await userEvent.click(screen.getByTestId("ai-chat-send"));

    expect(await screen.findByText("AI summary")).toBeInTheDocument();
  });

  it("applies ai board updates automatically", async () => {
    const updated = {
      ...initialData,
      columns: [{ ...initialData.columns[0], title: "Backlog via AI" }, ...initialData.columns.slice(1)],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => initialData,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reply: "Updated", board_update: updated }),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<KanbanBoard />);
    await screen.findByRole("heading", { name: "Kanban Studio" });
    await userEvent.click(screen.getByTestId("open-ai-chat"));

    await userEvent.type(
      screen.getByPlaceholderText(/ask ai to explain or update this board/i),
      "Rename backlog"
    );
    await userEvent.click(screen.getByTestId("ai-chat-send"));

    const matches = await screen.findAllByText("Backlog via AI");
    expect(matches.length).toBeGreaterThan(0);
  });
});
