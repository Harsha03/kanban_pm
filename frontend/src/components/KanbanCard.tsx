import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card, PriorityLevel } from "@/lib/kanban";

const PRIORITY_STYLES: Record<PriorityLevel, { label: string; colorClass: string }> = {
  critical: { label: "Critical", colorClass: "border-l-red-600" },
  high: { label: "High", colorClass: "border-l-orange-500" },
  medium: { label: "Medium", colorClass: "border-l-yellow-500" },
  low: { label: "Low", colorClass: "border-l-green-500" },
};

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onPriorityChange: (cardId: string, priority: PriorityLevel) => void;
  onOpenEdit: (cardId: string) => void;
  disabled?: boolean;
};

export const KanbanCard = ({
  card,
  onDelete,
  onPriorityChange,
  onOpenEdit,
  disabled = false,
}: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "cursor-pointer rounded-2xl border border-transparent border-l-4 bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        PRIORITY_STYLES[card.priority].colorClass,
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button, select, option, input, textarea, label")) {
          return;
        }
        if (!disabled) {
          onOpenEdit(card.id);
        }
      }}
      {...attributes}
      {...(disabled ? {} : listeners)}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-display text-base font-semibold text-[var(--navy-dark)]">
            {card.title}
          </h4>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
            Priority: {PRIORITY_STYLES[card.priority].label}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">
            {card.details}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <select
            value={card.priority}
            onChange={(event) =>
              onPriorityChange(card.id, event.target.value as PriorityLevel)
            }
            onClick={(event) => event.stopPropagation()}
            className="rounded-full border border-[var(--stroke)] bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--navy-dark)]"
            disabled={disabled}
            aria-label={`Priority for ${card.title}`}
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(card.id);
            }}
            className="shrink-0 whitespace-nowrap rounded-full border border-transparent px-2 py-1 text-xs font-semibold leading-none text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
            aria-label={`Delete ${card.title}`}
            disabled={disabled}
          >
            Remove
          </button>
        </div>
      </div>
    </article>
  );
};
