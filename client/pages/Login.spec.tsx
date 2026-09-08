/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import Login from "./Login";

const { loginMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    login: loginMock,
  }),
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Login />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  loginMock.mockReset();
  vi.unstubAllGlobals();
});

describe("Login page", () => {
  it("renders the login form", () => {
    renderLogin();

    expect(
      screen.getByText("Sign in to continue"),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Username or email"),
    ).toBeRequired();

    expect(
      screen.getByLabelText("Password"),
    ).toBeRequired();
  });

  it("switches to registration mode and shows required fields", async () => {
    const user = userEvent.setup();

    renderLogin();

    await user.click(
      screen.getByRole("button", {
        name: "Create account",
      }),
    );

    expect(
      screen.getByText("Create your reader account"),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Username")).toBeRequired();
    expect(screen.getByLabelText("Email")).toBeRequired();
    expect(screen.getByLabelText("Phone")).toBeRequired();

    const password = screen.getByLabelText("Password");

    expect(password).toHaveAttribute("minlength", "8");
  });

  it("submits login credentials and calls the auth login handler", async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          token: "test-token",
          user: {
            _id: "507f1f77bcf86cd799439011",
            username: "nadav",
            role: "user",
          },
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    renderLogin();

    await user.type(
      screen.getByLabelText("Username or email"),
      "nadav",
    );

    await user.type(
      screen.getByLabelText("Password"),
      "Password123!",
    );

    const signInButtons = screen.getAllByRole("button", {
      name: "Sign in",
    });

    await user.click(signInButtons[signInButtons.length - 1]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: "nadav",
            password: "Password123!",
          }),
        }),
      );
    });

    expect(loginMock).toHaveBeenCalledWith({
      token: "test-token",
      user: {
        _id: "507f1f77bcf86cd799439011",
        username: "nadav",
        role: "user",
      },
    });
  });

  it("submits registration details and calls the auth login handler", async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          token: "register-token",
          user: {
            _id: "507f1f77bcf86cd799439012",
            username: "newreader",
            role: "user",
          },
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    renderLogin();

    await user.click(
      screen.getByRole("button", {
        name: "Create account",
      }),
    );

    await user.type(
      screen.getByLabelText("Username"),
      "newreader",
    );

    await user.type(
      screen.getByLabelText("Email"),
      "reader@example.com",
    );

    await user.type(
      screen.getByLabelText("Phone"),
      "0501234567",
    );

    await user.type(
      screen.getByLabelText("Password"),
      "Password123!",
    );

    const createButtons = screen.getAllByRole("button", {
      name: "Create account",
    });

    await user.click(createButtons[createButtons.length - 1]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/register",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: "newreader",
            email: "reader@example.com",
            phone: "0501234567",
            password: "Password123!",
          }),
        }),
      );
    });

    expect(loginMock).toHaveBeenCalledWith({
      token: "register-token",
      user: {
        _id: "507f1f77bcf86cd799439012",
        username: "newreader",
        role: "user",
      },
    });
  });

  it("displays an API login error", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: "Invalid credentials",
        }),
      }),
    );

    renderLogin();

    await user.type(
      screen.getByLabelText("Username or email"),
      "nadav",
    );

    await user.type(
      screen.getByLabelText("Password"),
      "wrong-password",
    );

    const signInButtons = screen.getAllByRole("button", {
      name: "Sign in",
    });

    await user.click(signInButtons[signInButtons.length - 1]);

    expect(
      await screen.findByText("Invalid credentials"),
    ).toBeInTheDocument();

    expect(loginMock).not.toHaveBeenCalled();
  });
});