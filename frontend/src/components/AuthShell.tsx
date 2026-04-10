"use client";

import { useState, type FormEvent } from "react";
import { BoardDashboard } from "@/components/BoardDashboard";
import {
  login,
  logout,
  readAuthState,
  register,
  type AuthState,
} from "@/lib/auth";

export const AuthShell = () => {
  const [authState, setAuthState] = useState<AuthState>(() => readAuthState());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const state = isRegistering
        ? await register(username.trim(), password)
        : await login(username.trim(), password);
      setAuthState(state);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    setAuthState(null);
    setUsername("");
    setPassword("");
    setError("");
  };

  if (!authState) {
    return (
      <main className="relative mx-auto flex min-h-screen w-full max-w-xl items-center px-6">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,_rgba(200,149,108,0.15)_0%,_transparent_70%)]" />

        <section className="relative w-full rounded-2xl border border-[var(--stroke)] bg-white p-10 shadow-[var(--shadow)]">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-deep)] text-sm font-bold text-white">
              K
            </div>
            <span className="text-[11px] font-medium uppercase tracking-[0.3em] text-[var(--gray-text)]">
              Kanban Studio
            </span>
          </div>
          <h1 className="font-display text-3xl text-[var(--navy-dark)]">
            {isRegistering ? "Create an account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--gray-text)]">
            {isRegistering
              ? "Choose a username and password to get started."
              : "Sign in to access your boards."}
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--gray-text)]"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-xl border border-[var(--stroke)] bg-white px-4 py-2.5 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)] focus:ring-1 focus:ring-[var(--primary-blue)]"
                autoComplete="username"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--gray-text)]"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-[var(--stroke)] bg-white px-4 py-2.5 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)] focus:ring-1 focus:ring-[var(--primary-blue)]"
                autoComplete={isRegistering ? "new-password" : "current-password"}
                disabled={isSubmitting}
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm font-medium text-red-600">
                {error}
              </p>
            ) : null}
            <div className="flex items-center gap-4 pt-1">
              <button
                type="submit"
                className="rounded-xl bg-[var(--accent-deep)] px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-white transition hover:bg-[var(--secondary-purple)] disabled:opacity-60"
                disabled={isSubmitting || !username.trim() || !password}
              >
                {isSubmitting
                  ? "Please wait..."
                  : isRegistering
                    ? "Create account"
                    : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError("");
                }}
                className="text-[12px] font-medium text-[var(--accent-warm)] transition hover:text-[var(--accent-deep)]"
                disabled={isSubmitting}
              >
                {isRegistering
                  ? "Already have an account? Sign in"
                  : "Need an account? Register"}
              </button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <BoardDashboard
      username={authState.user.username}
      onLogout={handleLogout}
    />
  );
};
