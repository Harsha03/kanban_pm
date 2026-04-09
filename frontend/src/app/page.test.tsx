import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";
import { AUTH_TOKEN_KEY } from "@/lib/auth";

describe("Home auth flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("blocks access until login", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: /sign in to continue/i })).toBeVisible();
  });

  it("shows error on invalid credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: "Invalid username or password" }),
      } as Response)
    );

    render(<Home />);
    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/invalid username or password/i);
    });
  });

  it("logs in successfully and stores token", async () => {
    const loginResponse = {
      token: "test-jwt-token",
      user: { id: 1, username: "user" },
    };
    const boardsResponse = [
      { id: 1, name: "My Board", description: "", created_at: "2024-01-01", updated_at: "2024-01-01" },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => loginResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => boardsResponse,
        } as Response)
    );

    render(<Home />);
    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Your Boards" })).toBeVisible();
    });
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe("test-jwt-token");
  });

  it("shows registration form when toggled", async () => {
    render(<Home />);
    await userEvent.click(screen.getByText(/need an account/i));
    expect(screen.getByRole("heading", { name: /create an account/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /create account/i })).toBeVisible();
  });
});
