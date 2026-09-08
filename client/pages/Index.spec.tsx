/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import Index from "./Index";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    token: null,
    isAdmin: false,
    refreshUser: vi.fn(),
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

vi.mock("@/lib/pdfCover", () => ({
  generatePdfCover: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mockCatalog() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          comics: [
            {
              _id: "507f191e810c19729de860ea",
              title: "Test Comic",
              author: "Test Author",
              year: 2025,
              category: "Testing",
              coverImage: null,
              partNumber: 1,
              partName: "Main Story",
              createdAt: "2025-01-01T00:00:00.000Z",
            },
          ],
        },
      }),
    }),
  );
}

describe("Catalog page", () => {
  it("loads and displays comics from the public catalog API", async () => {
    mockCatalog();

    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>,
    );

    expect(
      (await screen.findAllByText("Test Comic")).length,
    ).toBeGreaterThan(0);

    expect(
      screen.getByText("Test Author"),
    ).toBeInTheDocument();

    expect(fetch).toHaveBeenCalledWith(
      "/api/comics",
      { cache: "no-store" },
    );
  });

  it("shows an empty state when search has no matches", async () => {
    const user = userEvent.setup();

    mockCatalog();

    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>,
    );

    await screen.findAllByText("Test Comic");

    await user.type(
      screen.getByPlaceholderText(
        "Search title, author or series",
      ),
      "something that does not exist",
    );

    expect(
      screen.getByText("No matches"),
    ).toBeInTheDocument();
  });

  it("sorts comics by creation date when Recently added is selected", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            comics: [
              {
                _id: "507f191e810c19729de860e1",
                title: "Older Comic",
                author: "Author",
                year: 2025,
                category: "Testing",
                coverImage: null,
                partNumber: 1,
                partName: "Main Story",
                createdAt: "2025-01-01T00:00:00.000Z",
              },
              {
                _id: "507f191e810c19729de860e2",
                title: "Newer Comic",
                author: "Author",
                year: 2025,
                category: "Testing",
                coverImage: null,
                partNumber: 2,
                partName: "Main Story",
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          },
        }),
      }),
    );

    const { container } = render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>,
    );

    await screen.findAllByText("Older Comic");

    await user.click(
      screen.getByRole("button", {
        name: /Filters/i,
      }),
    );

    const sortSelect = screen.getByDisplayValue(
      "Lecture order: 1, 2, 3…",
    );

    await user.selectOptions(
      sortSelect,
      "recent",
    );

    const titles = Array.from(
      container.querySelectorAll(
        "article a.line-clamp-2",
      ),
    ).map((element) => element.textContent);

    expect(titles).toEqual([
      "Newer Comic",
      "Older Comic",
    ]);
  });
});