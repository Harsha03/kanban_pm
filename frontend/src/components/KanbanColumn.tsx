import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type Card,
  type Column,
  type Label,
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
  onMoveColumn?: (columnId: string, direction: "left" | "right") => void;
  isFirst?: boolean;
  isLast?: boolean;
  disabled?: boolean;
  labels?: Label[];
};

export const KanbanColumn = ({
  column,
  cards,
  onDeleteCard,
  onUpdatePriority,
  onOpenCardEdit,
  onOpenAddCard,
  onOpenStagePopup,
  onMoveColumn,
  isFirst = false,
  isLast = false,
  disabled = false,
  labels = [],
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const StageIcon = STAGE_ICON_MAP[column.icon];

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex h-[430px] flex-col rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-4 transition-all duration-200",
        isOver && "ring-2 ring-[var(--accent-warm)] shadow-[0_0_0_1px_var(--accent-warm)]"
      )}
      data-testid={`column-${column.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="min-w-0 flex-1 cursor-pointer"
          onDoubleClick={() => onOpenStagePopup(column.id)}
          data-testid={`stage-header-${column.id}`}
          title="Double-click to expand"
        >
          <div className="flex items-center">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--gray-text)]">
              {cards.length} {cards.length === 1 ? "card" : "cards"}
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[var(--navy-dark)]">
            <StageIcon className="h-4.5 w-4.5 text-[var(--accent-warm)]" aria-hidden="true" />
            <p className="truncate font-display text-lg transition-colors duration-150 hover:text-[var(--accent-deep)]">
              {column.title}
            </p>
          </div>
        </div>
        {onMoveColumn ? (
          <div className="flex shrink-0 gap-0.5">
            <button
              type="button"
              onClick={() => onMoveColumn(column.id, "left")}
              disabled={isFirst || disabled}
              className="rounded-lg p-1 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)] disabled:opacity-30"
              aria-label={`Move ${column.title} left`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onMoveColumn(column.id, "right")}
              disabled={isLast || disabled}
              className="rounded-lg p-1 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)] disabled:opacity-30"
              aria-label={`Move ${column.title} right`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
      <div className="mt-3 h-px bg-[var(--stroke)]" />
      <div className="mt-3 flex flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
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
              labels={labels}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--stroke)] px-3 py-6 text-center text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--gray-text)]">
            Drop a card here
          </div>
        )}
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={() => onOpenAddCard(column.id)}
          className="w-full rounded-xl border border-dashed border-[var(--stroke)] px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--accent-warm)] transition hover:border-[var(--accent-warm)] hover:bg-[var(--accent-warm)]/5 disabled:opacity-60"
          disabled={disabled}
        >
          + Add a card
        </button>
      </div>
    </section>
  );
};
