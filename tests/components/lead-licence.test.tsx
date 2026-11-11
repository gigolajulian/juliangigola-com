import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { endDay, LicenceField, LicenceList } from "@/components/admin/leads/lead-licence";
import type { Lead, LeadSummary } from "@/lib/leads";

const iso = new Date().toISOString();
const full = { email: "a@x.com", name: "Ana", stage: "Confirmed", stageAt: iso, firstAt: iso, lastAt: iso, unread: false, events: [] } as Lead;
const cls = { btn: "b", field: "f", label: "l" };

describe("lead-licence", () => {
  it("endDay prints the end date in words", () => {
    expect(endDay("2026-12-01")).toBe("Dec 1, 2026");
  });

  it("LicenceField opens from + Licence and saves", () => {
    const patch = vi.fn(() => Promise.resolve());
    const run = vi.fn();
    render(<LicenceField full={full} patch={patch} run={run} cls={cls} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Licence" }));
    fireEvent.change(screen.getByPlaceholderText("Web + social, US"), { target: { value: "Web" } });
    fireEvent.change(screen.getByLabelText("Ends"), { target: { value: "2027-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(patch).toHaveBeenCalledWith({ licence: { use: "Web", end: "2027-01-01" } });
    expect(run).toHaveBeenCalledWith(expect.any(Promise), "Licence saved.");
  });

  it("LicenceField renders nothing without a lead", () => {
    const { container } = render(<LicenceField full={null} patch={vi.fn()} run={vi.fn()} cls={cls} />);
    expect(container.innerHTML).toBe("");
  });

  it("LicenceList sorts by end date, or says there are none", () => {
    const row = (l: LeadSummary) => <span>{l.name}</span>;
    const { rerender } = render(<LicenceList leads={[]} row={row} />);
    expect(screen.getByText(/No licences yet/)).toBeTruthy();
    const a = { ...full, id: "a", name: "Late", licence: { use: "Web", end: "2028-01-01" } } as LeadSummary;
    const b = { ...full, id: "b", name: "Soon", licence: { use: "", end: "2027-01-01" } } as LeadSummary;
    rerender(<LicenceList leads={[a, b]} row={row} />);
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("Soon");
    expect(items[0]).toContain("Licence");
    expect(items[1]).toContain("Ends Jan 1, 2028");
  });
});
