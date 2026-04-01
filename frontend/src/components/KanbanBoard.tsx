"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Inbox, PlusCircle, Settings } from "lucide-react";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import {
  createId,
  getNextStageColor,
  getNextStageIcon,
  initialData,
  moveCard,
  STAGE_ICON_OPTIONS,
  type BoardData,
  type Card,
  type PriorityLevel,
  type StageIconName,
} from "@/lib/kanban";
import { fetchBoard, persistBoard, sendAIChat, type AIChatHistoryItem } from "@/lib/api";
import { STAGE_ICON_MAP } from "@/lib/stage-icons";

const LOCAL_BOARD_STORAGE_KEY = "pm-local-board";

type KanbanBoardProps = {
  username?: string;
  useApi?: boolean;
};

type EditingCardState = {
  columnId: string;
  cardId: string;
  title: string;
  details: string;
  priority: PriorityLevel;
};

type AddCardState = {
  columnId: string;
  title: string;
  details: string;
  priority: PriorityLevel;
};

export const KanbanBoard = ({ username = "user", useApi = true }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData | null>(useApi ? null : initialData);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(useApi);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);
  const [chatMessages, setChatMessages] = useState<AIChatHistoryItem[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState("");
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [pendingStageRemoval, setPendingStageRemoval] = useState<{
    id: string;
    title: string;
    hasCards: boolean;
  } | null>(null);
  const [editingCard, setEditingCard] = useState<EditingCardState | null>(null);
  const [addCardState, setAddCardState] = useState<AddCardState | null>(null);
  const [openStagePopupColumnId, setOpenStagePopupColumnId] = useState<string | null>(null);
  const [isStageSettingsOpen, setIsStageSettingsOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const saveBoard = useCallback(
    async (nextBoard: BoardData) => {
      if (isOfflineFallback) {
        window.localStorage.setItem(LOCAL_BOARD_STORAGE_KEY, JSON.stringify(nextBoard));
        return nextBoard;
      }
      if (!useApi) {
        return nextBoard;
      }
      return persistBoard(username, nextBoard);
    },
    [isOfflineFallback, useApi, username]
  );

  useEffect(() => {
    if (!useApi) {
      return;
    }

    let cancelled = false;
    const loadBoard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const loaded = await fetchBoard(username);
        if (!cancelled) {
          setBoard(loaded);
          setIsOfflineFallback(false);
        }
      } catch {
        if (cancelled) {
          return;
        }
        const offlineRaw = window.localStorage.getItem(LOCAL_BOARD_STORAGE_KEY);
        if (offlineRaw) {
          try {
            setBoard(JSON.parse(offlineRaw) as BoardData);
          } catch {
            setBoard(initialData);
          }
        } else {
          setBoard(initialData);
        }
        setIsOfflineFallback(true);
        setError("Backend unavailable. Running in local-only mode.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadBoard();
    return () => {
      cancelled = true;
    };
  }, [useApi, username]);

  const cardsById = useMemo(() => board?.cards ?? {}, [board?.cards]);
  const isBusy = isLoading || isSaving;

  const applyBoardUpdate = useCallback(
    async (transform: (current: BoardData) => BoardData) => {
      if (!board || isBusy) {
        return;
      }
      const previous = board;
      const next = transform(board);
      setBoard(next);
      setIsSaving(true);
      setError(null);
      try {
        const persisted = await saveBoard(next);
        setBoard(persisted);
      } catch {
        setBoard(previous);
        setError("Unable to persist board changes.");
      } finally {
        setIsSaving(false);
      }
    },
    [board, isBusy, saveBoard]
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (isBusy) {
      return;
    }
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id || isBusy) {
      return;
    }

    void applyBoardUpdate((current) => ({
      ...current,
      columns: moveCard(current.columns, active.id as string, over.id as string),
    }));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    void applyBoardUpdate((current) => ({
      ...current,
      columns: current.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    }));
  };

  const handleSetColumnIcon = (columnId: string, icon: StageIconName) => {
    void applyBoardUpdate((current) => ({
      ...current,
      columns: current.columns.map((column) =>
        column.id === columnId ? { ...column, icon } : column
      ),
    }));
  };

  const handleAddCard = (
    columnId: string,
    title: string,
    details: string,
    priority: PriorityLevel
  ) => {
    const id = createId("card");
    void applyBoardUpdate((current) => ({
      ...current,
      cards: {
        ...current.cards,
        [id]: {
          id,
          title,
          details: details || "No details yet.",
          priority,
        },
      },
      columns: current.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    }));
  };

  const handleUpdateCardPriority = (
    _columnId: string,
    cardId: string,
    priority: PriorityLevel
  ) => {
    void applyBoardUpdate((current) => ({
      ...current,
      cards: {
        ...current.cards,
        [cardId]: {
          ...current.cards[cardId],
          priority,
        },
      },
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    void applyBoardUpdate((current) => ({
      ...current,
      cards: Object.fromEntries(
        Object.entries(current.cards).filter(([id]) => id !== cardId)
      ),
      columns: current.columns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              cardIds: column.cardIds.filter((id) => id !== cardId),
            }
          : column
      ),
    }));
  };

  const handleOpenCardEdit = (columnId: string, cardId: string) => {
    const card = board?.cards[cardId];
    if (!card) {
      return;
    }
    setEditingCard({
      columnId,
      cardId,
      title: card.title,
      details: card.details,
      priority: card.priority,
    });
  };

  const handleSaveCardEdit = () => {
    if (!editingCard) {
      return;
    }
    const nextTitle = editingCard.title.trim();
    if (!nextTitle) {
      return;
    }
    const nextDetails = editingCard.details.trim() || "No details yet.";
    const { cardId, priority } = editingCard;
    setEditingCard(null);
    void applyBoardUpdate((current) => ({
      ...current,
      cards: {
        ...current.cards,
        [cardId]: {
          ...current.cards[cardId],
          title: nextTitle,
          details: nextDetails,
          priority,
        },
      },
    }));
  };

  const handleReorderCardInStage = (
    columnId: string,
    cardId: string,
    direction: "up" | "down"
  ) => {
    void applyBoardUpdate((current) => ({
      ...current,
      columns: current.columns.map((column) => {
        if (column.id !== columnId) {
          return column;
        }
        const index = column.cardIds.indexOf(cardId);
        if (index === -1) {
          return column;
        }
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= column.cardIds.length) {
          return column;
        }
        const nextIds = [...column.cardIds];
        nextIds.splice(index, 1);
        nextIds.splice(targetIndex, 0, cardId);
        return { ...column, cardIds: nextIds };
      }),
    }));
  };

  const handleAddStage = () => {
    const title = newStageTitle.trim();
    if (!title) {
      return;
    }
    const id = createId("col");
    void applyBoardUpdate((current) => ({
      ...current,
      columns: [
        ...current.columns,
        {
          id,
          title,
          color: getNextStageColor(current.columns.length),
          icon: getNextStageIcon(current.columns.length),
          cardIds: [],
        },
      ],
    }));
    setNewStageTitle("");
    setIsAddingStage(false);
  };

  const handleRemoveStage = (columnId: string) => {
    if (!board) {
      return;
    }
    const removing = board.columns.find((column) => column.id === columnId);
    if (!removing) {
      return;
    }
    if (board.columns.length <= 1) {
      setError("At least one stage is required.");
      return;
    }

    setPendingStageRemoval({
      id: removing.id,
      title: removing.title,
      hasCards: removing.cardIds.length > 0,
    });
  };

  const confirmRemoveStage = () => {
    if (!pendingStageRemoval) {
      return;
    }
    const columnId = pendingStageRemoval.id;
    setPendingStageRemoval(null);

    void applyBoardUpdate((current) => {
      if (current.columns.length <= 1) {
        return current;
      }

      const removing = current.columns.find((column) => column.id === columnId);
      if (!removing) {
        return current;
      }

      const remaining = current.columns.filter((column) => column.id !== columnId);
      if (remaining.length > 0 && removing.cardIds.length > 0) {
        remaining[0] = {
          ...remaining[0],
          cardIds: [...remaining[0].cardIds, ...removing.cardIds],
        };
      }

      return {
        ...current,
        columns: remaining,
      };
    });
  };

  const cancelRemoveStage = () => {
    setPendingStageRemoval(null);
  };

  const openStagePopup = (columnId: string) => {
    setOpenStagePopupColumnId(columnId);
    setIsStageSettingsOpen(false);
  };

  const closeStagePopup = () => {
    setOpenStagePopupColumnId(null);
    setIsStageSettingsOpen(false);
  };

  const openAddCardModal = (columnId: string) => {
    setAddCardState({
      columnId,
      title: "",
      details: "",
      priority: "medium",
    });
  };

  const closeAddCardModal = () => {
    setAddCardState(null);
  };

  const submitAddCardModal = () => {
    if (!addCardState) {
      return;
    }
    const nextTitle = addCardState.title.trim();
    if (!nextTitle) {
      return;
    }
    handleAddCard(
      addCardState.columnId,
      nextTitle,
      addCardState.details.trim(),
      addCardState.priority
    );
    setAddCardState(null);
  };

  useEffect(() => {
    if (!pendingStageRemoval) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPendingStageRemoval(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [pendingStageRemoval]);

  const activeCard = activeCardId ? cardsById[activeCardId] : null;
  const stagePopupColumn = openStagePopupColumnId
    ? board?.columns.find((column) => column.id === openStagePopupColumnId) ?? null
    : null;
  const stagePopupCards = board && stagePopupColumn
    ? stagePopupColumn.cardIds
        .map((cardId) => board.cards[cardId])
        .filter((card): card is Card => Boolean(card))
    : [];
  const stagePriorityCounts = stagePopupCards.reduce<Record<PriorityLevel, number>>(
    (acc, card) => {
      acc[card.priority] += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );
  const addCardColumn = addCardState
    ? board?.columns.find((column) => column.id === addCardState.columnId) ?? null
    : null;

  const renderMessageContent = (content: string) => {
    const lines = content.split("\n");
    return lines.map((line, lineIndex) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={`line-${lineIndex}`}>
          {parts.map((part, partIndex) => {
            if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
              return <strong key={`part-${lineIndex}-${partIndex}`}>{part.slice(2, -2)}</strong>;
            }
            return <span key={`part-${lineIndex}-${partIndex}`}>{part}</span>;
          })}
          {lineIndex < lines.length - 1 ? <br /> : null}
        </span>
      );
    });
  };

  const handleChatSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = chatInput.trim();
    if (!question || !board || isChatting) {
      return;
    }
    if (isOfflineFallback || !useApi) {
      setChatError("AI chat requires backend connectivity.");
      return;
    }

    const history = chatMessages;
    const nextMessages = [...history, { role: "user", content: question } as const];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatError(null);
    setIsChatting(true);

    try {
      const response = await sendAIChat(username, { question, history });
      setChatMessages((prev) => [...prev, { role: "assistant", content: response.reply }]);
      if (response.board_update) {
        setBoard(response.board_update);
      }
    } catch (err) {
      if (err instanceof Error) {
        setChatError(err.message);
      } else {
        setChatError("Unable to get AI response.");
      }
    } finally {
      setIsChatting(false);
    }
  };

  if (!board) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          Loading board...
        </p>
      </main>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                Focus
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                Your flow. Your board. Nothing extra.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => {
              const Icon = STAGE_ICON_MAP[column.icon] ?? Inbox;
              return (
                <button
                  type="button"
                  key={column.id}
                  className="group flex cursor-pointer items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
                  onDoubleClick={() => openStagePopup(column.id)}
                  aria-label={`Open ${column.title} stage details`}
                  title="Double-click to expand"
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="border-b border-dashed border-[var(--stroke)] transition-colors duration-150 group-hover:border-[var(--gray-text)]">
                    {column.title}
                  </span>
                </button>
              );
            })}
          </div>
          {isSaving ? (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary-blue)]">
              Saving changes...
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}
        </header>

        <section className="grid gap-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <section className="grid gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {board.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId])}
                  onDeleteCard={handleDeleteCard}
                  onUpdatePriority={handleUpdateCardPriority}
                  onOpenCardEdit={handleOpenCardEdit}
                  onOpenAddCard={openAddCardModal}
                  onOpenStagePopup={openStagePopup}
                  disabled={isBusy}
                />
              ))}
              <section className="flex h-[430px] flex-col justify-center rounded-3xl border border-dashed border-[var(--stroke)] bg-white/60 p-4">
                {!isAddingStage ? (
                  <button
                    type="button"
                    onClick={() => setIsAddingStage(true)}
                    className="mx-auto flex items-center gap-2 rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)]"
                    disabled={isBusy}
                    data-testid="inline-add-stage-button"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Add stage
                  </button>
                ) : (
                  <form
                    className="mx-auto w-full max-w-[220px] space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleAddStage();
                    }}
                  >
                    <input
                      value={newStageTitle}
                      onChange={(event) => setNewStageTitle(event.target.value)}
                      placeholder="New stage name"
                      className="w-full rounded-full border border-[var(--stroke)] bg-white px-3 py-2 text-xs font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                      disabled={isBusy}
                    />
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="submit"
                        className="rounded-full bg-[var(--secondary-purple)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
                        disabled={isBusy || !newStageTitle.trim()}
                        data-testid="inline-confirm-add-stage"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingStage(false);
                          setNewStageTitle("");
                        }}
                        className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
                        disabled={isBusy}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </section>
            </section>
            <DragOverlay>
              {activeCard ? (
                <div className="w-[260px]">
                  <KanbanCardPreview card={activeCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

        </section>
      </main>

      <button
        type="button"
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--secondary-purple)] text-xl font-semibold text-white shadow-[var(--shadow)] transition hover:brightness-110"
        data-testid="open-ai-chat"
      >
        AI
      </button>

      {isChatOpen ? (
        <div
          className="fixed inset-0 z-30 flex items-end justify-end bg-[rgba(3,33,71,0.2)] p-4 backdrop-blur-[1px] sm:items-center"
          onClick={() => setIsChatOpen(false)}
          data-testid="ai-chat-modal"
        >
          <aside
            className="modal-dialog-enter flex h-[420px] w-full max-w-sm flex-col rounded-3xl border border-[var(--stroke)] bg-white p-4 shadow-[var(--shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[var(--stroke)] pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  AI Assistant
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold text-[var(--navy-dark)]">
                  Board Copilot
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                className="rounded-full border border-[var(--stroke)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
              >
                Close
              </button>
            </div>

            <div className="mt-3 flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
              {chatMessages.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--stroke)] px-4 py-3 text-sm text-[var(--gray-text)]">
                  Start a conversation. The AI can reply and optionally update the board.
                </p>
              ) : null}
              {chatMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={
                    message.role === "user"
                      ? "self-end rounded-2xl bg-[var(--primary-blue)] px-4 py-2 text-sm text-white"
                      : "self-start rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--navy-dark)]"
                  }
                >
                  {renderMessageContent(message.content)}
                </div>
              ))}
            </div>

            <form className="mt-3 space-y-2 border-t border-[var(--stroke)] pt-3" onSubmit={handleChatSubmit}>
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ask AI to explain or update this board..."
                rows={3}
                className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                data-testid="ai-chat-input"
                disabled={isChatting}
              />
              {chatError ? (
                <p role="alert" className="text-sm font-medium text-red-600">
                  {chatError}
                </p>
              ) : null}
              <button
                type="submit"
                className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
                data-testid="ai-chat-send"
                disabled={isChatting || !chatInput.trim()}
              >
                {isChatting ? "Thinking..." : "Send"}
              </button>
            </form>
          </aside>
        </div>
      ) : null}

      {editingCard ? (
        <div
          className="modal-overlay-enter fixed inset-0 z-40 flex items-center justify-center bg-[rgba(3,33,71,0.35)] px-4 backdrop-blur-[2px]"
          onClick={() => setEditingCard(null)}
          data-testid="edit-card-modal"
        >
          <div
            className="modal-dialog-enter w-full max-w-lg rounded-3xl border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              Edit card
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold text-[var(--navy-dark)]">
              Update card details
            </h3>
            <div className="mt-5 space-y-3">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-text)]">
                Card title
              </label>
              <input
                value={editingCard.title}
                onChange={(event) =>
                  setEditingCard((current) =>
                    current ? { ...current, title: event.target.value } : current
                  )
                }
                className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                disabled={isBusy}
              />
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-text)]">
                Card description
              </label>
              <textarea
                value={editingCard.details}
                onChange={(event) =>
                  setEditingCard((current) =>
                    current ? { ...current, details: event.target.value } : current
                  )
                }
                rows={4}
                className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)]"
                disabled={isBusy}
              />
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-text)]">
                Priority
              </label>
              <select
                value={editingCard.priority}
                onChange={(event) =>
                  setEditingCard((current) =>
                    current
                      ? {
                          ...current,
                          priority: event.target.value as PriorityLevel,
                        }
                      : current
                  )
                }
                className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                disabled={isBusy}
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="mt-6 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingCard(null)}
                className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
                disabled={isBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCardEdit}
                className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
                disabled={isBusy || !editingCard.title.trim()}
                data-testid="save-card-edits"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {addCardState && addCardColumn ? (
        <div
          className="modal-overlay-enter fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,33,71,0.35)] px-4 backdrop-blur-[2px]"
          onClick={closeAddCardModal}
          data-testid="add-card-modal"
        >
          <div
            className="modal-dialog-enter w-full max-w-xl rounded-3xl border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              Add new card
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold text-[var(--navy-dark)]">
              Add New Card to {addCardColumn.title}
            </h3>

            <label className="mt-5 block text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-text)]">
              Card title
            </label>
            <input
              value={addCardState.title}
              onChange={(event) =>
                setAddCardState((current) =>
                  current ? { ...current, title: event.target.value } : current
                )
              }
              placeholder="Card title"
              className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              disabled={isBusy}
            />

            <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-text)]">
              Details
            </label>
            <textarea
              value={addCardState.details}
              onChange={(event) =>
                setAddCardState((current) =>
                  current ? { ...current, details: event.target.value } : current
                )
              }
              placeholder="Details"
              rows={5}
              className="mt-1 min-h-[120px] w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)]"
              disabled={isBusy}
            />

            <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-text)]">
              Priority
            </label>
            <select
              value={addCardState.priority}
              onChange={(event) =>
                setAddCardState((current) =>
                  current
                    ? { ...current, priority: event.target.value as PriorityLevel }
                    : current
                )
              }
              className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              disabled={isBusy}
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <div className="mt-6 flex items-center gap-2">
              <button
                type="button"
                onClick={closeAddCardModal}
                className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
                disabled={isBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAddCardModal}
                className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
                disabled={isBusy || !addCardState.title.trim()}
                data-testid="confirm-add-card"
              >
                Add Card
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {stagePopupColumn ? (
        <div
          className="modal-overlay-enter fixed inset-0 z-40 flex items-center justify-center bg-[rgba(3,33,71,0.35)] px-4 backdrop-blur-[2px]"
          onClick={closeStagePopup}
          data-testid="stage-popup-modal"
        >
          <div
            className="modal-dialog-enter flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--stroke)] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Expanded stage view
                </p>
                <div className="mt-2 flex items-center gap-2 text-[var(--navy-dark)]">
                  {(() => {
                    const Icon = STAGE_ICON_MAP[stagePopupColumn.icon] ?? Inbox;
                    return <Icon className="h-5 w-5" aria-hidden="true" />;
                  })()}
                  <h3 className="font-display text-2xl font-semibold">{stagePopupColumn.title}</h3>
                  <button
                    type="button"
                    onClick={() => setIsStageSettingsOpen(true)}
                    className="rounded-full border border-[var(--stroke)] p-1.5 text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
                    aria-label={`Open settings for ${stagePopupColumn.title}`}
                    data-testid="open-stage-settings"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={closeStagePopup}
                className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-3 text-sm text-[var(--navy-dark)] md:grid-cols-2">
              <p>
                <strong>Total cards:</strong> {stagePopupCards.length}
              </p>
              <p>
                <strong>Priorities:</strong> {stagePriorityCounts.critical} Critical,{" "}
                {stagePriorityCounts.high} High, {stagePriorityCounts.medium} Medium,{" "}
                {stagePriorityCounts.low} Low
              </p>
            </div>

            <div className="mt-4 flex-1 overflow-hidden rounded-2xl border border-[var(--stroke)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                Cards in this stage
              </p>
              <div className="mt-3 flex max-h-[280px] flex-col gap-3 overflow-y-auto pr-1">
                {stagePopupCards.map((card, index) => (
                  <article
                    key={card.id}
                    className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--navy-dark)]">{card.title}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
                          Priority: {card.priority}
                        </p>
                        <p className="mt-2 text-sm text-[var(--gray-text)]">{card.details}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenCardEdit(stagePopupColumn.id, card.id)}
                          className="rounded-full border border-[var(--stroke)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--navy-dark)]"
                          disabled={isBusy}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReorderCardInStage(stagePopupColumn.id, card.id, "up")}
                          className="rounded-full border border-[var(--stroke)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-text)] disabled:opacity-50"
                          disabled={isBusy || index === 0}
                        >
                          Move up
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleReorderCardInStage(stagePopupColumn.id, card.id, "down")
                          }
                          className="rounded-full border border-[var(--stroke)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-text)] disabled:opacity-50"
                          disabled={isBusy || index === stagePopupCards.length - 1}
                        >
                          Move down
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCard(stagePopupColumn.id, card.id)}
                          className="rounded-full border border-transparent px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
                          disabled={isBusy}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
                {stagePopupCards.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[var(--stroke)] px-4 py-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                    No cards in this stage
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--stroke)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                Add a card
              </p>
              <button
                type="button"
                onClick={() => openAddCardModal(stagePopupColumn.id)}
                className="mt-2 w-full rounded-full border border-dashed border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)] disabled:opacity-60"
                disabled={isBusy}
              >
                + Add a card
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {stagePopupColumn && isStageSettingsOpen ? (
        <div
          className="modal-overlay-enter fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,33,71,0.35)] px-4 backdrop-blur-[2px]"
          onClick={() => setIsStageSettingsOpen(false)}
          data-testid="stage-settings-modal"
        >
          <div
            className="modal-dialog-enter w-full max-w-lg rounded-3xl border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              Stage settings
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold text-[var(--navy-dark)]">
              Customize {stagePopupColumn.title}
            </h3>

            <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-text)]">
              Stage name
            </label>
            <input
              value={stagePopupColumn.title}
              onChange={(event) => handleRenameColumn(stagePopupColumn.id, event.target.value)}
              aria-label="Stage name"
              className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              disabled={isBusy}
            />
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-text)]">
              Stage icon
            </p>
            <div className="mt-1 rounded-2xl border border-[var(--stroke)] p-4">
              <div className="grid grid-cols-4 gap-4">
              {STAGE_ICON_OPTIONS.map((iconName) => {
                const Icon = STAGE_ICON_MAP[iconName];
                const isActive = stagePopupColumn.icon === iconName;
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => handleSetColumnIcon(stagePopupColumn.id, iconName)}
                    className={
                      isActive
                        ? "flex h-11 w-11 items-center justify-center rounded-full border border-[var(--navy-dark)] bg-[var(--surface)] transition"
                        : "flex h-11 w-11 items-center justify-center rounded-full border border-[var(--stroke)] bg-[var(--surface)] transition"
                    }
                    disabled={isBusy}
                    aria-label={`Set ${stagePopupColumn.title} icon`}
                  >
                    <Icon className="h-5 w-5 text-[var(--navy-dark)]" />
                  </button>
                );
              })}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsStageSettingsOpen(false)}
                className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsStageSettingsOpen(false);
                  closeStagePopup();
                  handleRemoveStage(stagePopupColumn.id);
                }}
                className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100"
                data-testid="remove-stage-from-settings"
                disabled={isBusy}
              >
                Remove stage
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingStageRemoval ? (
        <div
          className="modal-overlay-enter fixed inset-0 z-40 flex items-center justify-center bg-[rgba(3,33,71,0.35)] px-4 backdrop-blur-[2px]"
          data-testid="remove-stage-modal"
          onClick={cancelRemoveStage}
        >
          <div
            className="modal-dialog-enter w-full max-w-md rounded-3xl border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              Confirm removal
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold text-[var(--navy-dark)]">
              Remove stage &quot;{pendingStageRemoval.title}&quot;?
            </h3>
            <p className="mt-3 text-sm text-[var(--gray-text)]">
              {pendingStageRemoval.hasCards
                ? "Cards in this stage will move to the first remaining stage."
                : "This action removes the stage from your board."}
            </p>
            <div className="mt-6 flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRemoveStage}
                className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoveStage}
                className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
                data-testid="confirm-remove-stage"
              >
                Remove stage
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
