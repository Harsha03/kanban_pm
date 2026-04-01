import {
  AUTH_STORAGE_KEY,
  validateCredentials,
  readAuthState,
  writeAuthState,
} from "@/lib/auth";

describe("auth utilities", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("validates only the dummy credentials", () => {
    expect(validateCredentials("user", "password")).toBe(true);
    expect(validateCredentials("user", "wrong")).toBe(false);
    expect(validateCredentials("wrong", "password")).toBe(false);
  });

  it("persists and clears auth state", () => {
    expect(readAuthState()).toBe(false);
    writeAuthState(true);
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBe("true");
    expect(readAuthState()).toBe(true);
    writeAuthState(false);
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(readAuthState()).toBe(false);
  });
});
