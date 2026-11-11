import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LeadUpcoming } from "@/components/leads/lead-upcoming";
import type { LeadSummary } from "@/lib/leads";

afterEach(() => vi.unstubAllGlobals());

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(Date.now());
const iso = new Date().toISOString();

describe("LeadUpcoming", () => {
  it("lists the lead and the calendar events on today", async () => {
    const ev = { id: "e1", title: "Dentist", start: `${today}T00:00:00Z`, end: `${today}T00:00:00Z`, allDay: true, block: false };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify({ events: url.includes(`from=${today.slice(0, 7)}-01`) ? [ev] : [] }), { status: 200 }))));
    // Midday Pacific on that date, so it lands on today whatever the hour.
    const lead = { id: "a", email: "a@x.com", name: "Ana", stage: "Confirmed", stageAt: iso, firstAt: iso, lastAt: iso, unread: false, when: `${today}T20:00:00Z` } as LeadSummary;
    render(<LeadUpcoming leads={[lead]} row={(l) => <span>{l.name} row</span>} />);
    expect(screen.getByText("Ana row")).toBeTruthy();
    expect(await screen.findByText("Dentist")).toBeTruthy();
    expect(screen.getByText(/^Today, /)).toBeTruthy();
  });

  it("pages the months and says when a day is empty", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 500 }))));
    render(<LeadUpcoming leads={[]} row={() => null} />);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.queryByText(/^Today, /)).toBeNull();
    expect(screen.getByText("Nothing on this day.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByText(/^Today, /)).toBeTruthy();
  });
});
