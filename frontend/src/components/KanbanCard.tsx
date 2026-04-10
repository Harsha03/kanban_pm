import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { Calendar, MessageSquare } from "lucide-react";
import type { Card, Label, PriorityLevel } from "@/lib/kanban";

const PRIORITY_STYLES: Record<PriorityLevel, { label: string; colorClass: string; dotColor: string }> = {
  critical: { label: "Critical", colorClass: "border-l-red-600", dotColor: "bg-red-500" },
  high: { label: "High", colorClass: "border-l-orange-500", dotColor: "bg-orange-400" },
  medium: { label: "Medium", colorClass: "border-l-amber-500", dotColor: "bg-amber-400" },
  low: { label: "Low", colorClass: "border-l-emerald-500", dotColor: "bg-emerald-400" },
};

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onPriorityChange: (cardId: string, priority: PriorityLevel) => void;
  onOpenEdit: (cardId: string) => void;
  disabled?: boolean;
  labels?: Label[];
};

export const KanbanCard = ({
  card,
  onDelete,
  onPriorityChange,
  onOpenEdit,
  disabled = false,
  labels = [],
}: KanbanCardProps) => {
  const cardLabels = labels.filter((l) => card.labelIds.includes(l.id));
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
        "cursor-pointer rounded-xl border border-[var(--stroke)] border-l-[3px] bg-white px-4 py-3.5 shadow-[0_2px_8px_rgba(44,24,16,0.06)]",
        PRIORITY_STYLES[card.priority].colorClass,
        "transition-all duration-200 hover:shadow-[0_8px_24px_rgba(44,24,16,0.1)]",
        isDragging && "opacity-50 shadow-[0_18px_32px_rgba(44,24,16,0.16)] rotate-[1.5deg]"
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
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-[15px] text-[var(--navy-dark)]">
            {card.title}
          </h4>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={clsx("h-1.5 w-1.5 rounded-full", PRIORITY_STYLES[card.priority].dotColor)} />
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--gray-text)]">
              {PRIORITY_STYLES[card.priority].label}
            </p>
          </div>
          {card.details && card.details !== "No details yet." ? (
            <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[var(--gray-text)]">
              {card.details}
            </p>
          ) : null}
          {cardLabels.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {cardLabels.map((label) => (
                <span
                  key={label.id}
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white"
                  style={{ backgroundColor: label.color }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          ) : null}
          {(card.dueDate || card.comments.length > 0) ? (
            <div className="mt-2 flex items-center gap-3">
              {card.dueDate ? (
                <span className={clsx(
                  "flex items-center gap-1 text-[11px] font-medium",
                  new Date(card.dueDate) < new Date(new Date().toDateString())
                    ? "text-red-600"
                    : "text-[var(--gray-text)]"
                )}>
                  <Calendar className="h-3 w-3" />
                  {new Date(card.dueDate + "T00:00:00").toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              ) : null}
              {card.comments.length > 0 ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--gray-text)]">
                  <MessageSquare className="h-3 w-3" />
                  {card.comments.length}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <select
            value={card.priority}
            onChange={(event) =>
              onPriorityChange(card.id, event.target.value as PriorityLevel)
            }
            onClick={(event) => event.stopPropagation()}
            className="rounded-lg border border-[var(--stroke)] bg-white px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--navy-dark)]"
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
            className="shrink-0 whitespace-nowrap rounded-lg px-2 py-0.5 text-[11px] font-medium text-[var(--gray-text)] transition hover:bg-red-50 hover:text-red-600"
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
