/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Library from "./Library";

const refreshUserMock = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      _id: "507f1f77bcf86cd799439011",
      username: "reader",
      role: "user",
      readingProgress: [
        {
          comicId: "507f191e810c19729de860ea",
          page: 5,
          totalPages: 10,
        },
      ],
    },
    token: "test-token",
    refreshUser: refreshUserMock,
  }),
}));

vi.mock("@/components/app/AppHeader", () => ({
  AppHeader: () => <div>App Header</div>,
}));

vi.mock("@/components/app/ComicCover", () => ({
  ComicCover: ({ comic }: any) => (
    <div data-testid="comic-cover">{comic.title}</div>
  ),
}));

afterEach(() => {
  cleanup();
  refreshUserMock.mockReset();
  vi.unstubAllGlobals();
});

describe("Library page", () => {
  it("loads and displays the authenticated user's saved comics", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            comics: [
              {
                _id: "507f191e810c19729de860ea",
                title: "Saved Comic",
                author: "Test Author",
                year: 2025,
                category: "Testing",
                partNumber: 1,
                partName: "Main Story",
              },
            ],
          },
        }),
      }),
    );

    render(
      <MemoryRouter>
        <Library />
      </MemoryRouter>,
    );

    expect(
      (await screen.findAllByText("Saved Comic")).length,
    ).toBeGreaterThan(0);

    expect(
      screen.getByText("Page 5 · 50%"),
    ).toBeInTheDocument();

    expect(fetch).toHaveBeenCalledWith("/api/library", {
      headers: {
        Authorization: "Bearer test-token",
      },
    });
  });

  it("shows loading skeletons while the library request is pending", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () => new Promise(() => {}),
      ),
    );

    const { container } = render(
      <MemoryRouter>
        <Library />
      </MemoryRouter>,
    );

    expect(
      container.querySelectorAll(".animate-pulse"),
    ).toHaveLength(10);
  });

  it("shows the empty library state when no comics are saved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            comics: [],
          },
        }),
      }),
    );

    render(
      <MemoryRouter>
        <Library />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Your shelf is waiting"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Browse collection"),
    ).toBeInTheDocument();
  });

  it("displays an API error when the library cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: "Unable to load library",
        }),
      }),
    );

    render(
      <MemoryRouter>
        <Library />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Unable to load library"),
    ).toBeInTheDocument();
  });
});