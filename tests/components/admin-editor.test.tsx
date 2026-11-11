import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdminEditor } from "@/components/admin-editor";
import { CONTENT } from "@/lib/content";

const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 }));

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockClear();
  window.localStorage.clear();
});

const props = {
  initial: CONTENT,
  slugs: [],
  categories: [{ slug: "editorial", name: "Editorial", group: "Work" }],
  projects: [],
  initialHidden: [],
  initialUnlisted: [],
  categoryLinks: [],
  initialTrash: [],
  initialOverrides: { categories: {}, frames: {}, credits: {}, copy: {}, slugs: {} },
  initialOrder: [],
  initialCovers: {},
  initialAvatars: {},
  initialBts: {},
  releases: [],
  releaseLimit: 10,
  heroChoices: [],
  clients: [],
};

describe("AdminEditor", () => {
  it("renders the sitemap, the tabs and the token box", () => {
    render(<AdminEditor {...props} />);
    expect(screen.getByRole("complementary", { name: "Site map" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Editor sections" })).toBeTruthy();
    expect(screen.getByLabelText("GitHub token")).toBeTruthy();
  });

  it("switches tabs", () => {
    render(<AdminEditor {...props} />);
    const tab = screen.getByRole("button", { name: "Motion" });
    fireEvent.click(tab);
    expect(tab.getAttribute("aria-current")).toBe("true");
  });

  it("reports a rejected token", async () => {
    render(<AdminEditor {...props} />);
    fireEvent.change(screen.getByLabelText("GitHub token"), { target: { value: "github_pat_test" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByText(/GitHub rejected that token/)).toBeTruthy();
  });
});
