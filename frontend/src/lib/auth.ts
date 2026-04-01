export const AUTH_STORAGE_KEY = "pm-authenticated";
export const DUMMY_USERNAME = "user";
export const DUMMY_PASSWORD = "password";

export const validateCredentials = (username: string, password: string) =>
  username === DUMMY_USERNAME && password === DUMMY_PASSWORD;

export const readAuthState = () => {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(AUTH_STORAGE_KEY) === "true";
};

export const writeAuthState = (isAuthenticated: boolean) => {
  if (typeof window === "undefined") {
    return;
  }
  if (isAuthenticated) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    return;
  }
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
};
