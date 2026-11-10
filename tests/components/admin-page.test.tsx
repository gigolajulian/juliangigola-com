import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdminPage } from "@/components/admin-page";
import type { AdminProject } from "@/components/admin-projects";

const frame = { src: "/work/x/01.jpg", width: 100, height: 150, color: "#111" };
const project: AdminProject = {
  slug: "x",
  origin: "x",
  name: "Project X",
  category: "Editorial",
  categorySlug: "editorial",
  images: [frame.src],
  frames: [frame],
  cover: frame,
  intent: "A night shoot.",
  title: "Project X",
  added: false,
  credits: [],
};

const props = () => ({
  project,
  disciplines: [{ slug: "editorial", name: "Editorial", group: "Work" }],
  filedAs: "editorial",
  onRecategorise: vi.fn(),
  frames: null,
  uploads: {},
  onReframe: vi.fn(),
  onUpload: vi.fn(),
  credits: [{ role: "Client", name: "Acme", instagram: null }],
  onCredits: vi.fn(),
  copy: null,
  onCopy: vi.fn(),
  onClose: vi.fn(),
});

describe("AdminPage", () => {
  it("renders the page header from the project", () => {
    render(<AdminPage {...props()} />);
    expect(screen.getByText("/work/x")).toBeTruthy();
    expect((screen.getByLabelText("Title") as HTMLTextAreaElement).value).toBe("Project X");
    expect(screen.getByText("Acme")).toBeTruthy();
    expect(screen.getByText(/1 frame/)).toBeTruthy();
  });

  it("closes and edits the title", () => {
    const p = props();
    render(<AdminPage {...p} />);
    fireEvent.click(screen.getByRole("button", { name: /Projects/ }));
    expect(p.onClose).toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New title" } });
    expect(p.onCopy).toHaveBeenCalledWith({ title: "New title", intent: "A night shoot." });
  });
});
