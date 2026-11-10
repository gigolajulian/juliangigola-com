import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DeskKeys } from "@/components/leads/desk-keys";
import type { LeadSummary } from "@/lib/leads";

const iso = new Date().toISOString();
const lead = (id: string, name: string): LeadSummary => ({ id, email: `${id}@x.com`, name, stage: "Inquiry", stageAt: iso, firstAt: iso, lastAt: iso, unread: false });
const leads = [lead("a", "Ana"), lead("b", "Bo")];

const setup = () => {
  const props = { leads, shown: leads, open: "a" as string | null, setOpen: vi.fn(), jump: vi.fn(), pick: vi.fn(), refresh: vi.fn() };
  const r = render(<DeskKeys {...props} />);
  return { ...props, ...r };
};

describe("DeskKeys", () => {
  it("renders nothing until a key opens it", () => {
    const { container } = setup();
    expect(container.innerHTML).toBe("");
  });

  it("? opens the shortcuts, Escape closes them", () => {
    setup();
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" }).textContent).toContain("Jump to a lead");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("J moves to the next lead, N and U reach the desk", () => {
    const p = setup();
    fireEvent.keyDown(window, { key: "j" });
    expect(p.setOpen).toHaveBeenCalledWith("b");
    fireEvent.keyDown(window, { key: "n" });
    expect(p.pick).toHaveBeenCalledWith("new");
    fireEvent.keyDown(window, { key: "u" });
    expect(p.refresh).toHaveBeenCalled();
  });

  it("Ctrl K jumps to a lead by name", () => {
    const p = setup();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = screen.getByRole("textbox", { name: "Jump to a lead" });
    fireEvent.change(input, { target: { value: "bo" } });
    expect(screen.queryByText("Ana")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(p.jump).toHaveBeenCalledWith(expect.objectContaining({ id: "b" }));
  });
});
