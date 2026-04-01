import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";
import { AUTH_STORAGE_KEY } from "@/lib/auth";

describe("Home auth flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("blocks access until login", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: /sign in to continue/i })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Kanban Studio" })).not.toBeInTheDocument();
  });

  it("shows error on invalid credentials", async () => {
    render(<Home />);
    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/invalid credentials/i);
  });

  it("logs in and logs out", async () => {
    render(<Home />);
    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBe("true");

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(screen.getByRole("heading", { name: /sign in to continue/i })).toBeVisible();
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});
