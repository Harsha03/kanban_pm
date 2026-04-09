import {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  readAuthState,
  writeAuthState,
  getAuthHeaders,
  logout,
} from "@/lib/auth";

describe("auth utilities", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when no auth state is stored", () => {
    expect(readAuthState()).toBeNull();
  });

  it("persists and reads auth state", () => {
    const state = { token: "test-token", user: { id: 1, username: "alice" } };
    writeAuthState(state);
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe("test-token");
    expect(window.localStorage.getItem(AUTH_USER_KEY)).toBe(
      JSON.stringify({ id: 1, username: "alice" })
    );

    const read = readAuthState();
    expect(read).not.toBeNull();
    expect(read!.token).toBe("test-token");
    expect(read!.user.username).toBe("alice");
  });

  it("clears auth state on logout", () => {
    writeAuthState({ token: "t", user: { id: 1, username: "u" } });
    logout();
    expect(readAuthState()).toBeNull();
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  });

  it("returns auth headers when logged in", () => {
    writeAuthState({ token: "my-jwt", user: { id: 1, username: "bob" } });
    const headers = getAuthHeaders();
    expect(headers).toEqual({ Authorization: "Bearer my-jwt" });
  });

  it("returns empty headers when not logged in", () => {
    expect(getAuthHeaders()).toEqual({});
  });

  it("returns null for corrupted user JSON", () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, "token");
    window.localStorage.setItem(AUTH_USER_KEY, "not-json");
    expect(readAuthState()).toBeNull();
  });
});
