import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoicesDesk, status } from "@/components/leads/invoices";
import type { Call } from "@/lib/leads/lead-desk";
import { inv, iso, lead } from "./leads-fixtures";

describe("InvoicesDesk", () => {
  it("reads paid, sent and unpaid, and totals what is owed", async () => {
    expect(status(inv("1", { paidAt: iso }))).toBe("Paid");
    expect(status(inv("1", { at: "2026-10-01T00:00:00Z" }))).toBe("Paid"); // before the log, counts paid
    expect(status(inv("1", { sentAt: iso }))).toBe("Sent");
    expect(status(inv("1"))).toBe("Unpaid");

    const call = vi.fn(async () => ({ invoices: [inv("1126"), inv("1126-2", { paidAt: iso }), inv("1026", { lead: "gone" })] })) as unknown as Call;
    render(<InvoicesDesk leads={[lead("a", { name: "Ana Ruiz" })]} call={call} open={() => {}} changed={() => {}} />);
    expect(await screen.findByText("3 ON THE DESK · $1,600.00 UNPAID")).toBeTruthy();
    expect(screen.getByText("1126-2")).toBeTruthy();
    // The invoice whose lead is gone cannot open.
    const opens = screen.getAllByRole("button", { name: "Open" }) as HTMLButtonElement[];
    expect(opens.filter((b) => b.disabled || b.getAttribute("aria-disabled") === "true")).toHaveLength(1);
  });

  it("says so when there are none", async () => {
    const call = vi.fn(async () => ({ invoices: [] })) as unknown as Call;
    render(<InvoicesDesk leads={[]} call={call} open={() => {}} changed={() => {}} />);
    expect(await screen.findByText(/No invoices yet/)).toBeTruthy();
  });
});
