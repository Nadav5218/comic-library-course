/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";

import { ProtectedRoute } from "./ProtectedRoute";

const authState = vi.hoisted(() => ({
  user: null as any,
  isAdmin: false,
  authReady: true,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

function renderRoute(adminOnly = false) {
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly={adminOnly}>
              <div>Protected content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<div>Home page</div>} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  authState.user = null;
  authState.isAdmin = false;
  authState.authReady = true;
});

describe("ProtectedRoute", () => {
  it("redirects unauthenticated users to login", () => {
    renderRoute();

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("allows an authenticated regular user on a protected route", () => {
    authState.user = {
      _id: "507f1f77bcf86cd799439011",
      username: "reader",
      role: "user",
    };

    renderRoute();

    expect(
      screen.getByText("Protected content"),
    ).toBeInTheDocument();
  });

  it("redirects a regular user away from an admin-only route", () => {
    authState.user = {
      _id: "507f1f77bcf86cd799439011",
      username: "reader",
      role: "user",
    };
    authState.isAdmin = false;

    renderRoute(true);

    expect(screen.getByText("Home page")).toBeInTheDocument();
  });

  it("allows an administrator on an admin-only route", () => {
    authState.user = {
      _id: "507f1f77bcf86cd799439011",
      username: "admin",
      role: "admin",
    };
    authState.isAdmin = true;

    renderRoute(true);

    expect(
      screen.getByText("Protected content"),
    ).toBeInTheDocument();
  });
});
