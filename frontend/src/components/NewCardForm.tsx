import { useState, type FormEvent } from "react";
import type { PriorityLevel } from "@/lib/kanban";

const initialFormState: {
  title: string;
  details: string;
  priority: PriorityLevel;
} = { title: "", details: "", priority: "medium" };

type NewCardFormProps = {
  onAdd: (title: string, details: string, priority: PriorityLevel) => void;
  disabled?: boolean;
};

export const NewCardForm = ({ onAdd, disabled = false }: NewCardFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.title.trim()) {
      return;
    }
    onAdd(formState.title.trim(), formState.details.trim(), formState.priority);
    setFormState(initialFormState);
    setIsOpen(false);
  };

  return (
    <div className="mt-4">
      {isOpen ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={formState.title}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, title: event.target.value }))
            }
            placeholder="Card title"
            className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--accent-warm)]"
            required
            disabled={disabled}
          />
          <textarea
            value={formState.details}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, details: event.target.value }))
            }
            placeholder="Details"
            rows={3}
            className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--gray-text)] outline-none transition focus:border-[var(--accent-warm)]"
            disabled={disabled}
          />
          <select
            value={formState.priority}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                priority: event.target.value as PriorityLevel,
              }))
            }
            className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--accent-warm)]"
            disabled={disabled}
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-xl bg-[var(--accent-deep)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
              disabled={disabled}
            >
              Add card
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setFormState(initialFormState);
              }}
              className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
              disabled={disabled}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full rounded-full border border-dashed border-[var(--stroke)] px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--accent-warm)] transition hover:border-[var(--accent-warm)]"
          disabled={disabled}
        >
          Add a card
        </button>
      )}
    </div>
  );
};
