import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CalendarDesk } from "@/components/leads/calendar";
import type { LeadSummary } from "@/lib/leads/leads";

afterEach(() => vi.unstubAllGlobals());

const soon = new Date(Date.now() + 3600e3).toISOString();
const later = new Date(Date.now() + 2 * 3600e3).toISOString();
const ana = { id: "a", email: "ana@x.com", name: "Ana", stage: "Call booked", stageAt: soon, firstAt: soon, lastAt: soon, when: soon } as LeadSummary;

function stub() {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    new Response(JSON.stringify(init?.method === "POST" ? { ok: true } : { events: [{ id: "e1", title: "Dentist", start: later, end: later, allDay: false, block: false, booking: false, free: false }], busy: [], extras: [] }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("CalendarDesk", () => {
  it("lists the lead's call beside the rest of hello@ in Bookings", async () => {
    stub();
    const open = vi.fn();
    render(<CalendarDesk leads={[ana]} size="mid" open={open} tab="bookings" setTab={() => {}} />);
    fireEvent.click(await screen.findByText("Ana"));
    expect(open).toHaveBeenCalledWith(ana);
    expect(await screen.findByText("Dentist")).toBeTruthy();
  });

  it("blocks the picked day with the classic POST in Availability", async () => {
    const fetch = stub();
    render(<CalendarDesk leads={[]} size="mid" open={() => {}} tab="availability" setTab={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Block the day" }));
    await waitFor(() => expect(fetch.mock.calls.some(([, i]) => i?.method === "POST")).toBe(true));
    const body = JSON.parse(String(fetch.mock.calls.find(([, i]) => i?.method === "POST")![1]!.body));
    expect(body.block.from).toBe(body.block.to);
  });
});
