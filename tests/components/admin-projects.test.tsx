import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/admin/admin-github", () => ({
  commitFiles: vi.fn(async () => {}),
  readFile: vi.fn(async () => null),
}));

import { AdminProjects, type AdminProject } from "@/components/admin/admin-projects";

const frame = { src: "/work/x/01.jpg", width: 100, height: 150, color: "#111" };
const project = (slug: string, name: string): AdminProject => ({
  slug,
  origin: slug,
  name,
  category: "Editorial",
  categorySlug: "editorial",
  images: [frame.src],
  frames: [frame],
  cover: frame,
  intent: null,
  title: name,
  added: false,
  credits: [],
});

const props = (query = "") => ({
  token: "t",
  projects: [project("valgur", "VALGUR"), project("cyber", "CYBER1A")],
  hidden: new Set<string>(),
  onHiddenChange: vi.fn(),
  unlisted: new Set<string>(),
  onUnlistedChange: vi.fn(),
  slugs: {},
  onSlug: vi.fn(),
  changed: new Set<string>(),
  disciplines: [{ slug: "editorial", name: "Editorial", group: "Work" }],
  recategorised: {},
  onRecategorise: vi.fn(),
  reframed: {},
  onReframe: vi.fn(),
  bts: {},
  publishedBts: {},
  onBts: vi.fn(),
  uploads: {},
  onUpload: vi.fn(),
  credits: {},
  onCredits: vi.fn(),
  opened: null,
  onOpened: vi.fn(),
  onOpenPage: vi.fn(),
  query,
  onQuery: vi.fn(),
});

describe("AdminProjects", () => {
  it("lists projects with the show filters", () => {
    render(<AdminProjects {...props()} />);
    expect(screen.getByText("VALGUR")).toBeTruthy();
    expect(screen.getByText("CYBER1A")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Show" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^All/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("narrows by the controlled query and reports typing", () => {
    const p = props("valgur");
    render(<AdminProjects {...p} />);
    expect(screen.queryByText("CYBER1A")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Filter by name, slug or discipline"), {
      target: { value: "x" },
    });
    expect(p.onQuery).toHaveBeenCalledWith("x");
  });
});
