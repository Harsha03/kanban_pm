import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const boardFixture = {
  columns: [
    { id: "col-backlog", title: "Backlog", color: "#3B82F6", icon: "inbox", cardIds: ["card-1"] },
    { id: "col-discovery", title: "Discovery", color: "#8B5CF6", icon: "search", cardIds: [] },
    { id: "col-progress", title: "In Progress", color: "#EC4899", icon: "play", cardIds: [] },
    { id: "col-review", title: "Review", color: "#EF4444", icon: "eye", cardIds: [] },
    { id: "col-done", title: "Done", color: "#F97316", icon: "check-circle", cardIds: [] },
  ],
  cards: {
    "card-1": {
      id: "card-1",
      title: "Seed card",
      details: "Fixture card",
      priority: "medium",
    },
  },
};

const login = async (page: Page) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: "Your Boards" })).toBeVisible();
};

const loginAndOpenBoard = async (page: Page) => {
  await login(page);
  await page.locator('[data-testid^="board-card-"]').first().click();
  await expect(page.locator('[data-testid^="column-"]').first()).toBeVisible();
};

const mockBoardApis = async (page: Page) => {
  // Mock the board detail endpoint (used when opening a board by ID)
  await page.route("**/api/boards/*", async (route) => {
    const url = route.request().url();
    // Skip list endpoint and sub-routes like /export, /duplicate
    if (url.endsWith("/boards") || url.includes("/export") || url.includes("/duplicate") || url.includes("/import")) {
      await route.continue();
      return;
    }
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        json: { id: 1, name: "Test Board", description: "", board: boardFixture },
      });
      return;
    }
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      await route.fulfill({ status: 200, json: body });
      return;
    }
    await route.continue();
  });
};

test("blocks kanban access before login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your Boards" })).not.toBeVisible();
});

test("shows an error for invalid credentials", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.locator("p[role='alert']")).toContainText("Invalid credentials");
});

test("logs in, shows board, and logs out", async ({ page }) => {
  await loginAndOpenBoard(page);
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});

test("adds a card to a column", async ({ page }) => {
  await loginAndOpenBoard(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  const addModal = page.getByTestId("add-card-modal");
  await addModal.getByPlaceholder("Card title").fill("Playwright card");
  await addModal.getByPlaceholder("Details").fill("Added via e2e.");
  await addModal.getByTestId("confirm-add-card").click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("persists board updates across reload", async ({ page }) => {
  await loginAndOpenBoard(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  const addModal = page.getByTestId("add-card-modal");
  await addModal.getByPlaceholder("Card title").fill("Persistent card");
  await addModal.getByPlaceholder("Details").fill("Should survive reload.");
  await addModal.getByTestId("confirm-add-card").click();
  await expect(firstColumn.getByText("Persistent card")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Persistent card")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await loginAndOpenBoard(page);
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});

test("shows ai chat reply", async ({ page }) => {
  await mockBoardApis(page);
  // Mock AI chat for board-specific endpoint (matches /api/ai/chat/<boardId>)
  await page.route("**/api/ai/chat/*", async (route) => {
    await route.fulfill({
      status: 200,
      json: { reply: "AI says hello", board_update: null },
    });
  });

  await loginAndOpenBoard(page);
  await page.getByTestId("open-ai-chat").click();
  await page.getByTestId("ai-chat-input").fill("Say hello");
  await page.getByTestId("ai-chat-send").click();
  await expect(page.getByText("AI says hello")).toBeVisible();
});

test("applies ai board updates to the UI", async ({ page }) => {
  await mockBoardApis(page);
  // Mock AI chat for board-specific endpoint
  await page.route("**/api/ai/chat/*", async (route) => {
    const updatedBoard = {
      ...boardFixture,
      columns: [{ ...boardFixture.columns[0], title: "Backlog AI Updated" }, ...boardFixture.columns.slice(1)],
    };
    await route.fulfill({
      status: 200,
      json: { reply: "Updated board.", board_update: updatedBoard },
    });
  });

  await loginAndOpenBoard(page);
  await page.getByTestId("open-ai-chat").click();
  await page.getByTestId("ai-chat-input").fill("Rename backlog");
  await page.getByTestId("ai-chat-send").click();
  await expect(page.getByText("Backlog AI Updated").first()).toBeVisible();
});
