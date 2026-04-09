export const AUTH_TOKEN_KEY = "pm-auth-token";
export const AUTH_USER_KEY = "pm-auth-user";

export type AuthUser = {
  id: number;
  username: string;
};

export type AuthState = {
  token: string;
  user: AuthUser;
} | null;

export const readAuthState = (): AuthState => {
  if (typeof window === "undefined") {
    return null;
  }
  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  const userJson = window.localStorage.getItem(AUTH_USER_KEY);
  if (!token || !userJson) {
    return null;
  }
  try {
    const user = JSON.parse(userJson) as AuthUser;
    return { token, user };
  } catch {
    return null;
  }
};

export const writeAuthState = (state: AuthState) => {
  if (typeof window === "undefined") {
    return;
  }
  if (state) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, state.token);
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(state.user));
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_USER_KEY);
  }
};

export const getAuthHeaders = (): Record<string, string> => {
  const state = readAuthState();
  if (!state) {
    return {};
  }
  return { Authorization: `Bearer ${state.token}` };
};

export const login = async (
  username: string,
  password: string
): Promise<AuthState> => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || "Login failed");
  }
  const data = await response.json();
  const state: AuthState = { token: data.token, user: data.user };
  writeAuthState(state);
  return state;
};

export const register = async (
  username: string,
  password: string
): Promise<AuthState> => {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || "Registration failed");
  }
  const data = await response.json();
  const state: AuthState = { token: data.token, user: data.user };
  writeAuthState(state);
  return state;
};

export const logout = () => {
  writeAuthState(null);
};
