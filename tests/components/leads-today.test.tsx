import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DeskToday } from "@/components/leads/today";
import type { LeadSummary } from "@/lib/leads/leads";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const iso = new Date().toISOString();
const lead = (o: Partial<LeadSummary> = {}): LeadSummary => ({ id: "a", email: "ana@x.com", name: "Ana", stage: "Inquiry", stageAt: iso, firstAt: iso, lastAt: iso, unread: true, ...o });

describe("DeskToday", () => {
  it("greets Julian and lists what is on him", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ available: 12345, pending: 500 }), { status: 200 }))));
    const go = vi.fn();
    const pick = vi.fn();
    render(<DeskToday leads={[lead()]} go={go} pick={pick} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^(Morning|Afternoon|Evening), Julian\.$/);
    expect(await screen.findByText("$123.45")).toBeTruthy();
    expect(screen.getByText("Inbox key or GitHub token needed")).toBeTruthy();
    expect(screen.getByText("No calls or sessions coming up.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "All →" }));
    expect(pick).toHaveBeenCalledWith("needs");
    fireEvent.click(screen.getAllByRole("button", { name: /Ana/ })[0]);
    expect(go).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
  });

  it("says when nothing is waiting", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 500 }))));
    render(<DeskToday leads={[]} go={() => {}} pick={() => {}} />);
    expect(screen.getByText("Nothing waiting on you.")).toBeTruthy();
    expect(screen.getByText("Nothing on the books this week.")).toBeTruthy();
  });
});
