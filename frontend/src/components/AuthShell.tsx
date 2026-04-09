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
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-6">
        <section className="w-full rounded-3xl border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
            Project Management
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
            {isRegistering ? "Create an account" : "Sign in to continue"}
          </h1>
          <p className="mt-2 text-sm text-[var(--gray-text)]">
            {isRegistering
              ? "Choose a username and password to get started."
              : "Enter your credentials to access your boards."}
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                autoComplete="username"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                autoComplete={isRegistering ? "new-password" : "current-password"}
                disabled={isSubmitting}
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm font-medium text-red-600">
                {error}
              </p>
            ) : null}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-full bg-[var(--secondary-purple)] px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
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
                className="text-xs font-semibold text-[var(--primary-blue)] transition hover:underline"
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
