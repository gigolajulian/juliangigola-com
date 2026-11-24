import { describe, expect, it, vi, type Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoicesDesk, status } from "@/components/leads/invoices";
import { deskCall } from "@/lib/leads/lead-desk";
import { inv, iso, lead } from "./leads-fixtures";

vi.mock("@/lib/leads/lead-desk", async (actual) => ({ ...(await actual<typeof import("@/lib/leads/lead-desk")>()), deskCall: vi.fn() }));
// The desk fetch, faked per test.
const call = deskCall as unknown as Mock;

describe("InvoicesDesk", () => {
  it("reads paid, sent and unpaid, and totals what is owed", async () => {
    expect(status(inv("1", { paidAt: iso }))).toBe("Paid");
    expect(status(inv("1", { at: "2026-10-01T00:00:00Z" }))).toBe("Paid"); // before the log, counts paid
    expect(status(inv("1", { sentAt: iso }))).toBe("Sent");
    expect(status(inv("1"))).toBe("Unpaid");

    call.mockImplementation(async () => ({ invoices: [inv("1126"), inv("1126-2", { paidAt: iso }), inv("1026", { lead: "gone" })] }));
    render(<InvoicesDesk leads={[lead("a", { name: "Ana Ruiz" })]} open={() => {}} changed={() => {}} />);
    expect(await screen.findByText("3 ON THE DESK · $1,600.00 UNPAID")).toBeTruthy();
    expect(screen.getByText("1126-2")).toBeTruthy();
    // The invoice whose lead is gone cannot open.
    const opens = screen.getAllByRole("button", { name: "Open" }) as HTMLButtonElement[];
    expect(opens.filter((b) => b.disabled || b.getAttribute("aria-disabled") === "true")).toHaveLength(1);
  });

  it("says so when there are none", async () => {
    call.mockImplementation(async () => ({ invoices: [] }));
    render(<InvoicesDesk leads={[]} open={() => {}} changed={() => {}} />);
    expect(await screen.findByText(/No invoices yet/)).toBeTruthy();
  });
});
