import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LeadBoard } from "@/components/admin/leads/lead-board";
import type { LeadSummary } from "@/lib/leads";

const iso = new Date().toISOString();
const lead = (o: Partial<LeadSummary>): LeadSummary => ({ id: "a", email: "a@x.com", name: "Ana", stage: "Inquiry", stageAt: iso, firstAt: iso, lastAt: iso, unread: false, ...o });

describe("LeadBoard", () => {
  const leads = [lead({ id: "a", name: "Ana", quote: 1500 }), lead({ id: "b", name: "Bo", stage: "Quoted" }), lead({ id: "c", name: "Cy", stage: "Lost" })];

  it("draws a column per open stage, Lost left out", () => {
    render(<LeadBoard leads={leads} card={(l) => <span>{l.name}</span>} onMove={() => {}} />);
    expect(screen.getByRole("region", { name: "Inquiry" }).textContent).toContain("$1,500");
    expect(screen.queryByRole("region", { name: "Lost" })).toBeNull();
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.queryByText("Cy")).toBeNull();
  });

  it("moves a card dropped on another column", () => {
    const onMove = vi.fn();
    render(<LeadBoard leads={leads} card={(l) => <span>{l.name}</span>} onMove={onMove} />);
    const dataTransfer = { setData() {}, effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(screen.getByText("Ana").closest("li")!, { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "Shot" }), { dataTransfer });
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), "Shot");
  });
});
