export type Label = {
  id: string;
  name: string;
  color: string;
};

export type CardComment = {
  id: string;
  text: string;
  createdAt: string;
};

export type Card = {
  id: string;
  title: string;
  details: string;
  priority: PriorityLevel;
  dueDate: string | null;
  labelIds: string[];
  comments: CardComment[];
};

export type Column = {
  id: string;
  title: string;
  color: string;
  icon: StageIconName;
  cardIds: string[];
};

export type PriorityLevel = "critical" | "high" | "medium" | "low";
export type StageIconName =
  | "inbox"
  | "search"
  | "play"
  | "eye"
  | "check-circle"
  | "circle-dot"
  | "clock"
  | "pause"
  | "skip-forward"
  | "archive"
  | "rocket"
  | "lightbulb"
  | "flame"
  | "bookmark"
  | "bell"
  | "shield"
  | "settings"
  | "flag"
  | "target"
  | "zap"
  | "star";

export type BoardData = {
  columns: Column[];
  cards: Record<string, Card>;
  labels: Label[];
};

export const STAGE_COLOR_PALETTE = [
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#EF4444", // Red
  "#F97316", // Orange
  "#EAB308", // Yellow
  "#22C55E", // Green
  "#14B8A6", // Teal
  "#6366F1", // Indigo
  "#64748B", // Slate
] as const;

export const STAGE_ICON_OPTIONS: StageIconName[] = [
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
  "zap",
  "target",
  "flag",
  "star",
  "rocket",
  "lightbulb",
  "flame",
  "bookmark",
  "bell",
  "shield",
  "settings",
];

export const initialData: BoardData = {
  columns: [
    {
      id: "col-backlog",
      title: "Backlog",
      color: "#3B82F6",
      icon: "inbox",
      cardIds: ["card-1", "card-2"],
    },
    {
      id: "col-discovery",
      title: "Discovery",
      color: "#8B5CF6",
      icon: "search",
      cardIds: ["card-3"],
    },
    {
      id: "col-progress",
      title: "In Progress",
      color: "#EC4899",
      icon: "play",
      cardIds: ["card-4", "card-5"],
    },
    {
      id: "col-review",
      title: "Review",
      color: "#EF4444",
      icon: "eye",
      cardIds: ["card-6"],
    },
    {
      id: "col-done",
      title: "Done",
      color: "#F97316",
      icon: "check-circle",
      cardIds: ["card-7", "card-8"],
    },
  ],
  cards: {
    "card-1": {
      id: "card-1",
      title: "Align roadmap themes",
      details: "Draft quarterly themes with impact statements and metrics.",
      priority: "high",
      dueDate: null,
      labelIds: [],
      comments: [],
    },
    "card-2": {
      id: "card-2",
      title: "Gather customer signals",
      details: "Review support tags, sales notes, and churn feedback.",
      priority: "medium",
      dueDate: null,
      labelIds: [],
      comments: [],
    },
    "card-3": {
      id: "card-3",
      title: "Prototype analytics view",
      details: "Sketch initial dashboard layout and key drill-downs.",
      priority: "critical",
      dueDate: null,
      labelIds: [],
      comments: [],
    },
    "card-4": {
      id: "card-4",
      title: "Refine status language",
      details: "Standardize column labels and tone across the board.",
      priority: "medium",
      dueDate: null,
      labelIds: [],
      comments: [],
    },
    "card-5": {
      id: "card-5",
      title: "Design card layout",
      details: "Add hierarchy and spacing for scanning dense lists.",
      priority: "high",
      dueDate: null,
      labelIds: [],
      comments: [],
    },
    "card-6": {
      id: "card-6",
      title: "QA micro-interactions",
      details: "Verify hover, focus, and loading states.",
      priority: "critical",
      dueDate: null,
      labelIds: [],
      comments: [],
    },
    "card-7": {
      id: "card-7",
      title: "Ship marketing page",
      details: "Final copy approved and asset pack delivered.",
      priority: "low",
      dueDate: null,
      labelIds: [],
      comments: [],
    },
    "card-8": {
      id: "card-8",
      title: "Close onboarding sprint",
      details: "Document release notes and share internally.",
      priority: "low",
      dueDate: null,
      labelIds: [],
      comments: [],
    },
  },
  labels: [],
};

export const LABEL_COLOR_PALETTE = [
  "#EF4444", // Red
  "#F97316", // Orange
  "#EAB308", // Yellow
  "#22C55E", // Green
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#14B8A6", // Teal
] as const;

export const getNextStageColor = (currentCount: number) =>
  STAGE_COLOR_PALETTE[currentCount % STAGE_COLOR_PALETTE.length];

export const getNextStageIcon = (currentCount: number) =>
  STAGE_ICON_OPTIONS[currentCount % STAGE_ICON_OPTIONS.length];

const isColumnId = (columns: Column[], id: string) =>
  columns.some((column) => column.id === id);

const findColumnId = (columns: Column[], id: string) => {
  if (isColumnId(columns, id)) {
    return id;
  }
  return columns.find((column) => column.cardIds.includes(id))?.id;
};

export const moveCard = (
  columns: Column[],
  activeId: string,
  overId: string
): Column[] => {
  const activeColumnId = findColumnId(columns, activeId);
  const overColumnId = findColumnId(columns, overId);

  if (!activeColumnId || !overColumnId) {
    return columns;
  }

  const activeColumn = columns.find((column) => column.id === activeColumnId);
  const overColumn = columns.find((column) => column.id === overColumnId);

  if (!activeColumn || !overColumn) {
    return columns;
  }

  const isOverColumn = isColumnId(columns, overId);

  if (activeColumnId === overColumnId) {
    if (isOverColumn) {
      const nextCardIds = activeColumn.cardIds.filter(
        (cardId) => cardId !== activeId
      );
      nextCardIds.push(activeId);
      return columns.map((column) =>
        column.id === activeColumnId
          ? { ...column, cardIds: nextCardIds }
          : column
      );
    }

    const oldIndex = activeColumn.cardIds.indexOf(activeId);
    const newIndex = activeColumn.cardIds.indexOf(overId);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
      return columns;
    }

    const nextCardIds = [...activeColumn.cardIds];
    nextCardIds.splice(oldIndex, 1);
    nextCardIds.splice(newIndex, 0, activeId);

    return columns.map((column) =>
      column.id === activeColumnId
        ? { ...column, cardIds: nextCardIds }
        : column
    );
  }

  const activeIndex = activeColumn.cardIds.indexOf(activeId);
  if (activeIndex === -1) {
    return columns;
  }

  const nextActiveCardIds = [...activeColumn.cardIds];
  nextActiveCardIds.splice(activeIndex, 1);

  const nextOverCardIds = [...overColumn.cardIds];
  if (isOverColumn) {
    nextOverCardIds.push(activeId);
  } else {
    const overIndex = overColumn.cardIds.indexOf(overId);
    const insertIndex = overIndex === -1 ? nextOverCardIds.length : overIndex;
    nextOverCardIds.splice(insertIndex, 0, activeId);
  }

  return columns.map((column) => {
    if (column.id === activeColumnId) {
      return { ...column, cardIds: nextActiveCardIds };
    }
    if (column.id === overColumnId) {
      return { ...column, cardIds: nextOverCardIds };
    }
    return column;
  });
};

export const createId = (prefix: string) => {
  const randomPart = Math.random().toString(36).slice(2, 8);
  const timePart = Date.now().toString(36);
  return `${prefix}-${randomPart}${timePart}`;
};
