import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  type Card,
  type Column,
  type PriorityLevel,
} from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { STAGE_ICON_MAP } from "@/lib/stage-icons";

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  onDeleteCard: (columnId: string, cardId: string) => void;
  onUpdatePriority: (columnId: string, cardId: string, priority: PriorityLevel) => void;
  onOpenCardEdit: (columnId: string, cardId: string) => void;
  onOpenAddCard: (columnId: string) => void;
  onOpenStagePopup: (columnId: string) => void;
  disabled?: boolean;
};

export const KanbanColumn = ({
  column,
  cards,
  onDeleteCard,
  onUpdatePriority,
  onOpenCardEdit,
  onOpenAddCard,
  onOpenStagePopup,
  disabled = false,
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const StageIcon = STAGE_ICON_MAP[column.icon];

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex h-[430px] flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow)] transition",
        isOver && "ring-2 ring-[var(--accent-yellow)]"
      )}
      data-testid={`column-${column.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="w-full cursor-pointer"
          onDoubleClick={() => onOpenStagePopup(column.id)}
          data-testid={`stage-header-${column.id}`}
          title="Double-click to expand"
        >
          <div className="flex items-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              {cards.length} cards
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[var(--navy-dark)]">
            <StageIcon className="h-5 w-5" aria-hidden="true" />
            <p className="border-b border-dashed border-[var(--stroke)] font-display text-lg font-semibold transition-colors duration-150 hover:border-[var(--gray-text)]">
              {column.title}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onDelete={(cardId) => onDeleteCard(column.id, cardId)}
              onPriorityChange={(cardId, priority) =>
                onUpdatePriority(column.id, cardId, priority)
              }
              onOpenEdit={(cardId) => onOpenCardEdit(column.id, cardId)}
              disabled={disabled}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--stroke)] px-3 py-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Drop a card here
          </div>
        )}
      </div>
      <div className="mt-4">
        <button
          type="button"
          onClick={() => onOpenAddCard(column.id)}
          className="w-full rounded-full border border-dashed border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)] disabled:opacity-60"
          disabled={disabled}
        >
          + Add a card
        </button>
      </div>
    </section>
  );
};
