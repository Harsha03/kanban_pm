import type { Card } from "@/lib/kanban";

type KanbanCardPreviewProps = {
  card: Card;
};

export const KanbanCardPreview = ({ card }: KanbanCardPreviewProps) => (
  <article className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-3.5 shadow-[0_18px_32px_rgba(44,24,16,0.14)] rotate-[2deg]">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h4 className="font-display text-[15px] text-[var(--navy-dark)]">
          {card.title}
        </h4>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--gray-text)]">
          {card.details}
        </p>
      </div>
    </div>
  </article>
);
