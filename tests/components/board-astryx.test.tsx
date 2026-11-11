import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BoardAstryx } from "@/components/leads/board-astryx";
import type { LeadSummary } from "@/lib/leads/leads";

const iso = new Date().toISOString();
const ana = { id: "a", email: "ana@x.com", name: "Ana", stage: "Inquiry", stageAt: iso, firstAt: iso, lastAt: iso, quote: 1800 } as LeadSummary;

describe("BoardAstryx", () => {
  it("puts a lead in its stage column and moves it on drop", () => {
    const onMove = vi.fn();
    render(<BoardAstryx leads={[ana]} onMove={onMove} open={() => {}} />);
    expect(screen.getByRole("region", { name: "Inquiry" }).textContent).toContain("Ana");
    expect(screen.queryByRole("region", { name: "Lost" })).toBeNull();
    const dataTransfer = { setData: () => {}, effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(screen.getByText("Ana").closest("[draggable]")!, { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "Quoted" }), { dataTransfer });
    expect(onMove).toHaveBeenCalledWith(ana, "Quoted");
  });
});
