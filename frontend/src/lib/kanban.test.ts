import { moveCard, createId, getNextStageColor, getNextStageIcon, STAGE_COLOR_PALETTE, STAGE_ICON_OPTIONS, type Column } from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", color: "#3B82F6", icon: "inbox", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", color: "#8B5CF6", icon: "search", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });

  it("returns unchanged columns when active id is not found", () => {
    const result = moveCard(baseColumns, "card-999", "card-1");
    expect(result).toEqual(baseColumns);
  });

  it("returns unchanged columns when over id is not found", () => {
    const result = moveCard(baseColumns, "card-1", "card-999");
    expect(result).toEqual(baseColumns);
  });

  it("moves card to end of same column when dropped on column header", () => {
    const result = moveCard(baseColumns, "card-1", "col-a");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("does not move when same position", () => {
    const cols: Column[] = [
      { id: "col-a", title: "A", color: "#3B82F6", icon: "inbox", cardIds: ["card-1"] },
    ];
    const result = moveCard(cols, "card-1", "card-1");
    expect(result).toEqual(cols);
  });
});

describe("createId", () => {
  it("generates unique ids with given prefix", () => {
    const id1 = createId("card");
    const id2 = createId("card");
    expect(id1).toMatch(/^card-/);
    expect(id2).toMatch(/^card-/);
    expect(id1).not.toBe(id2);
  });

  it("uses the prefix correctly", () => {
    expect(createId("col")).toMatch(/^col-/);
    expect(createId("lbl")).toMatch(/^lbl-/);
  });
});

describe("getNextStageColor", () => {
  it("cycles through the color palette", () => {
    expect(getNextStageColor(0)).toBe(STAGE_COLOR_PALETTE[0]);
    expect(getNextStageColor(STAGE_COLOR_PALETTE.length)).toBe(STAGE_COLOR_PALETTE[0]);
  });
});

describe("getNextStageIcon", () => {
  it("cycles through the icon options", () => {
    expect(getNextStageIcon(0)).toBe(STAGE_ICON_OPTIONS[0]);
    expect(getNextStageIcon(STAGE_ICON_OPTIONS.length)).toBe(STAGE_ICON_OPTIONS[0]);
  });
});
