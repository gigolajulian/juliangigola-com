import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsDesk, StatTile } from "@/components/leads/numbers";
import type { Call } from "@/lib/leads/lead-desk";

describe("StatsDesk", () => {
  it("shows the booked rate from /stats", async () => {
    const stats = { bookedRate: 0.4, replyHours: 2, pipeline: 1800, won: 3600, weeks: [{ start: "2026-11-02", inquiries: 3, booked: 1 }], sources: [{ source: "Instagram DM", leads: 3, booked: 1 }], lost: [], stages: { Inquiry: 2 }, total: 3, repeat: 1, lifetime: 1200, top: [{ name: "Ana", sessions: 2, paid: 1200 }] };
    const call = vi.fn(async () => ({ stats })) as unknown as Call;
    render(<StatsDesk call={call} />);
    expect(await screen.findByText("40%")).toBeTruthy();
    expect(screen.getByText("Instagram DM")).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
  });
});

describe("StatTile", () => {
  it("shows the label in capitals, the value and the hint", () => {
    render(<StatTile k="On the way" v="$12" hint="Not settled yet" />);
    expect(screen.getByText("ON THE WAY")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "$12" })).toBeTruthy();
    expect(screen.getByText("Not settled yet")).toBeTruthy();
  });
});
