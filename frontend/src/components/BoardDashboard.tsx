"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PlusCircle, Trash2, Pencil, LayoutDashboard, Download, Upload, Copy, KeyRound, Moon, Sun } from "lucide-react";
import { KanbanBoard } from "@/components/KanbanBoard";
import {
  listBoards,
  createBoard,
  deleteBoard,
  updateBoardMeta,
  exportBoard,
  importBoard,
  duplicateBoard,
  changePassword,
  type BoardSummary,
} from "@/lib/api";
import { useDarkMode } from "@/lib/use-dark-mode";

type BoardDashboardProps = {
  username: string;
  onLogout: () => void;
};

export const BoardDashboard = ({ username, onLogout }: BoardDashboardProps) => {
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardDescription, setNewBoardDescription] = useState("");
  const [editingBoard, setEditingBoard] = useState<{
    id: number;
    name: string;
    description: string;
  } | null>(null);
  const [newBoardTemplate, setNewBoardTemplate] = useState<string>("kanban");
  const [pendingDelete, setPendingDelete] = useState<BoardSummary | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const loadBoards = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listBoards();
      setBoards(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load boards");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  const handleCreateBoard = async (event: FormEvent) => {
    event.preventDefault();
    const name = newBoardName.trim();
    if (!name) return;

    try {
      await createBoard(name, newBoardDescription.trim(), newBoardTemplate);
      setNewBoardName("");
      setNewBoardDescription("");
      setNewBoardTemplate("kanban");
      setIsCreating(false);
      await loadBoards();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create board");
    }
  };

  const handleDeleteBoard = async () => {
    if (!pendingDelete) return;
    try {
      await deleteBoard(pendingDelete.id);
      setPendingDelete(null);
      if (activeBoardId === pendingDelete.id) {
        setActiveBoardId(null);
      }
      await loadBoards();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete board");
    }
  };

  const handleUpdateMeta = async () => {
    if (!editingBoard) return;
    const name = editingBoard.name.trim();
    if (!name) return;

    try {
      await updateBoardMeta(
        editingBoard.id,
        name,
        editingBoard.description.trim()
      );
      setEditingBoard(null);
      await loadBoards();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update board");
    }
  };

  const handleExportBoard = async (boardId: number, boardName: string) => {
    try {
      const data = await exportBoard(boardId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${boardName.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export board");
    }
  };

  const handleDuplicateBoard = async (boardId: number) => {
    try {
      await duplicateBoard(boardId);
      await loadBoards();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate board");
    }
  };

  const handleImportBoard = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.board || !data.board.columns || !data.board.cards) {
        throw new Error("Invalid board file format");
      }
      const name = data.name || file.name.replace(/\.json$/, "");
      const description = data.description || "";
      await importBoard(name, description, data.board);
      await loadBoards();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import board");
    }
  };

  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    }
  };

  if (activeBoardId !== null) {
    return (
      <div>
        <div className="absolute left-6 top-6 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveBoardId(null);
              void loadBoards();
            }}
            className="flex items-center gap-2 rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--navy-dark)] transition hover:border-[var(--accent-warm)] hover:text-[var(--accent-warm)]"
          >
            <LayoutDashboard className="h-4 w-4" />
            All boards
          </button>
        </div>
        <div className="absolute right-6 top-6 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex items-center gap-2 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-[11px] font-medium text-[var(--navy-dark)] transition hover:border-[var(--accent-warm)] hover:text-[var(--accent-warm)]"
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--navy-dark)] transition hover:border-[var(--accent-warm)] hover:text-[var(--accent-warm)]"
          >
            Log out
          </button>
        </div>
        <KanbanBoard key={activeBoardId} boardId={activeBoardId} />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[500px] w-[500px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(200,149,108,0.2)_0%,_rgba(200,149,108,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[500px] w-[500px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(107,58,36,0.12)_0%,_rgba(107,58,36,0.03)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1200px] flex-col gap-8 px-6 pb-16 pt-12">
        <header className="flex flex-wrap items-start justify-between gap-6 rounded-2xl border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-deep)] text-xs font-bold text-white">
                K
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-[var(--gray-text)]">
                {username}
              </span>
            </div>
            <h1 className="font-display text-4xl text-[var(--navy-dark)]">
              Your Boards
            </h1>
            <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-[var(--gray-text)]">
              Manage your projects. Each board is an independent kanban workspace
              with its own columns and cards.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--navy-dark)] transition hover:border-[var(--accent-warm)] hover:text-[var(--accent-warm)]"
            >
              <Upload className="h-4 w-4" />
              Import
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleImportBoard(file);
                    e.target.value = "";
                  }
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setIsChangingPassword(true);
                setPasswordError(null);
                setPasswordSuccess(false);
                setCurrentPassword("");
                setNewPassword("");
              }}
              className="flex items-center gap-2 rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--navy-dark)] transition hover:border-[var(--accent-warm)] hover:text-[var(--accent-warm)]"
            >
              <KeyRound className="h-4 w-4" />
              Password
            </button>
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex items-center gap-2 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-[11px] font-medium text-[var(--navy-dark)] transition hover:border-[var(--accent-warm)] hover:text-[var(--accent-warm)]"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--navy-dark)] transition hover:border-[var(--accent-warm)] hover:text-[var(--accent-warm)]"
            >
              Log out
            </button>
          </div>
        </header>

        {error ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Loading boards...
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <article
                key={board.id}
                className="group cursor-pointer rounded-2xl border border-[var(--stroke)] bg-white p-6 shadow-[0_2px_8px_rgba(44,24,16,0.05)] transition hover:border-[var(--accent-warm)] hover:shadow-[0_8px_24px_rgba(44,24,16,0.1)]"
                onClick={() => setActiveBoardId(board.id)}
                data-testid={`board-card-${board.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-display text-lg text-[var(--navy-dark)]">
                      {board.name}
                    </h2>
                    {board.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--gray-text)]">
                        {board.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDuplicateBoard(board.id);
                      }}
                      className="rounded-full p-2 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
                      aria-label={`Duplicate ${board.name}`}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleExportBoard(board.id, board.name);
                      }}
                      className="rounded-full p-2 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
                      aria-label={`Export ${board.name}`}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingBoard({
                          id: board.id,
                          name: board.name,
                          description: board.description,
                        });
                      }}
                      className="rounded-full p-2 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
                      aria-label={`Edit ${board.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(board);
                      }}
                      className="rounded-full p-2 text-[var(--gray-text)] transition hover:bg-red-50 hover:text-red-600"
                      aria-label={`Delete ${board.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="mt-4 text-xs text-[var(--gray-text)]">
                  Updated{" "}
                  {new Date(board.updated_at + "Z").toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </article>
            ))}

            <article
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--stroke)] bg-white/60 p-6 transition hover:border-[var(--accent-warm)] hover:shadow-[0_8px_24px_rgba(44,24,16,0.1)]"
              onClick={() => setIsCreating(true)}
              data-testid="create-board-button"
            >
              <PlusCircle className="h-10 w-10 text-[var(--gray-text)]" />
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--gray-text)]">
                New board
              </p>
            </article>
          </div>
        )}
      </main>

      {/* Create Board Modal */}
      {isCreating ? (
        <div
          className="modal-overlay-enter fixed inset-0 z-40 flex items-center justify-center bg-[rgba(44,24,16,0.3)] px-4 backdrop-blur-[2px]"
          onClick={() => setIsCreating(false)}
        >
          <div
            className="modal-dialog-enter w-full max-w-lg rounded-2xl border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--gray-text)]">
              New board
            </p>
            <h3 className="mt-2 font-display text-xl text-[var(--navy-dark)]">
              Create a new board
            </h3>
            <form className="mt-5 space-y-4" onSubmit={handleCreateBoard}>
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--gray-text)]">
                  Board name
                </label>
                <input
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder="e.g. Sprint Board"
                  className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-white px-4 py-2.5 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--accent-warm)] focus:ring-1 focus:ring-[var(--accent-warm)]"
                  data-testid="new-board-name"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--gray-text)]">
                  Description (optional)
                </label>
                <textarea
                  value={newBoardDescription}
                  onChange={(e) => setNewBoardDescription(e.target.value)}
                  placeholder="What is this board for?"
                  rows={3}
                  className="mt-1 w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--gray-text)]">
                  Template
                </label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {[
                    { id: "blank", label: "Blank", desc: "Empty board with one column" },
                    { id: "kanban", label: "Kanban", desc: "Classic 5-column workflow" },
                    { id: "scrum", label: "Scrum", desc: "Sprint-based agile board" },
                    { id: "bug-tracking", label: "Bug Tracking", desc: "Issue lifecycle board" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setNewBoardTemplate(t.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        newBoardTemplate === t.id
                          ? "border-[var(--accent-warm)] bg-[var(--accent-warm)]/10"
                          : "border-[var(--stroke)] hover:border-[var(--accent-warm)]"
                      }`}
                    >
                      <p className="text-xs font-semibold text-[var(--navy-dark)]">{t.label}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--gray-text)]">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setNewBoardName("");
                    setNewBoardDescription("");
                    setNewBoardTemplate("kanban");
                  }}
                  className="rounded-xl border border-[var(--stroke)] px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[var(--accent-deep)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white transition hover:brightness-110 disabled:opacity-60"
                  disabled={!newBoardName.trim()}
                  data-testid="confirm-create-board"
                >
                  Create board
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Edit Board Modal */}
      {editingBoard ? (
        <div
          className="modal-overlay-enter fixed inset-0 z-40 flex items-center justify-center bg-[rgba(44,24,16,0.3)] px-4 backdrop-blur-[2px]"
          onClick={() => setEditingBoard(null)}
        >
          <div
            className="modal-dialog-enter w-full max-w-lg rounded-2xl border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Edit board
            </p>
            <h3 className="mt-2 font-display text-xl text-[var(--navy-dark)]">
              Update board details
            </h3>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--gray-text)]">
                  Board name
                </label>
                <input
                  value={editingBoard.name}
                  onChange={(e) =>
                    setEditingBoard((prev) =>
                      prev ? { ...prev, name: e.target.value } : prev
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-white px-4 py-2.5 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--accent-warm)] focus:ring-1 focus:ring-[var(--accent-warm)]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--gray-text)]">
                  Description
                </label>
                <textarea
                  value={editingBoard.description}
                  onChange={(e) =>
                    setEditingBoard((prev) =>
                      prev ? { ...prev, description: e.target.value } : prev
                    )
                  }
                  rows={3}
                  className="mt-1 w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)]"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBoard(null)}
                  className="rounded-xl border border-[var(--stroke)] px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateMeta}
                  className="rounded-xl bg-[var(--accent-deep)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white transition hover:brightness-110 disabled:opacity-60"
                  disabled={!editingBoard.name.trim()}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete Board Confirmation */}
      {pendingDelete ? (
        <div
          className="modal-overlay-enter fixed inset-0 z-40 flex items-center justify-center bg-[rgba(44,24,16,0.3)] px-4 backdrop-blur-[2px]"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="modal-dialog-enter w-full max-w-md rounded-2xl border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Confirm deletion
            </p>
            <h3 className="mt-2 font-display text-xl text-[var(--navy-dark)]">
              Delete &quot;{pendingDelete.name}&quot;?
            </h3>
            <p className="mt-3 text-sm text-[var(--gray-text)]">
              This will permanently delete this board and all its cards. This
              action cannot be undone.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-xl border border-[var(--stroke)] px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBoard}
                className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100"
                data-testid="confirm-delete-board"
              >
                Delete board
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Change Password Modal */}
      {isChangingPassword ? (
        <div
          className="modal-overlay-enter fixed inset-0 z-40 flex items-center justify-center bg-[rgba(44,24,16,0.3)] px-4 backdrop-blur-[2px]"
          onClick={() => setIsChangingPassword(false)}
        >
          <div
            className="modal-dialog-enter w-full max-w-md rounded-2xl border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Security
            </p>
            <h3 className="mt-2 font-display text-xl text-[var(--navy-dark)]">
              Change password
            </h3>
            <form className="mt-5 space-y-4" onSubmit={handleChangePassword}>
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--gray-text)]">
                  Current password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-white px-4 py-2.5 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--accent-warm)] focus:ring-1 focus:ring-[var(--accent-warm)]"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--gray-text)]">
                  New password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-white px-4 py-2.5 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--accent-warm)] focus:ring-1 focus:ring-[var(--accent-warm)]"
                />
              </div>
              {passwordError ? (
                <p className="text-sm font-medium text-red-600">{passwordError}</p>
              ) : null}
              {passwordSuccess ? (
                <p className="text-sm font-medium text-green-600">Password changed successfully!</p>
              ) : null}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsChangingPassword(false)}
                  className="rounded-xl border border-[var(--stroke)] px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[var(--accent-deep)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white transition hover:brightness-110 disabled:opacity-60"
                  disabled={!currentPassword || !newPassword}
                >
                  Update password
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};
