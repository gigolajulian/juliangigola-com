import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callOrShoot, daysOf, isCall, source } from "@/components/leads/today";
import type { LeadSummary } from "@/lib/leads/leads";

/* Today's helpers on the lead desk (`components/leads/today.tsx`): what a
   date on a lead is (a call or the shoot), where a move comes from, and the
   week in the rail, day by day in Pacific time. */

// 2026-11-20, 10:00 Pacific.
const NOW = Date.parse("2026-11-20T18:00:00Z");
beforeEach(() => vi.useFakeTimers({ now: NOW, toFake: ["Date"] }));
afterEach(() => vi.useRealTimers());

const at = "2026-11-01T18:00:00.000Z";
const lead = (over: Partial<LeadSummary>): LeadSummary =>
  ({ id: "a", email: "ana@example.com", name: "Ana", stage: "Inquiry", stageAt: at, firstAt: at, lastAt: at, ...over }) as LeadSummary;

describe("isCall and callOrShoot", () => {
  it("is a call while booked, and once a quote is out after the call", () => {
    expect(isCall(lead({ stage: "Call booked", when: "2026-11-25T18:00:00Z" }))).toBe(true);
    expect(isCall(lead({ stage: "Quoted", when: "2026-11-18T18:00:00Z" }))).toBe(true);
    expect(isCall(lead({ stage: "Quoted", when: "2026-11-25T18:00:00Z" }))).toBe(false);
    expect(isCall(lead({ stage: "Confirmed", when: "2026-11-25T18:00:00Z" }))).toBe(false);
  });

  it("names a shoot by its kind, or Shoot", () => {
    expect(callOrShoot(lead({ stage: "Call booked" }))).toBe("Call");
    expect(callOrShoot(lead({ stage: "Confirmed" }))).toBe("Shoot");
  });
});

describe("source", () => {
  it("tags proofs stages as Proofs, paperwork due before a shoot as Paperwork, the rest as Leads", () => {
    expect(source(lead({ stage: "Selecting" }))).toBe("Proofs");
    expect(source(lead({ stage: "Invoiced" }))).toBe("Proofs");
    expect(source(lead({ stage: "Confirmed", when: "2026-11-22T18:00:00Z" }))).toBe("Paperwork");
    expect(source(lead({ stage: "Confirmed", when: "2026-11-22T18:00:00Z", contract: "Signed", release: "Not needed" }))).toBe("Leads");
    expect(source(lead({ stage: "Inquiry" }))).toBe("Leads");
  });
});

describe("daysOf", () => {
  it("gives n Pacific days from the first, marking today", () => {
    const days = daysOf([], "2026-11-19", 3);
    expect(days.map((d) => [d.d, d.today])).toEqual([["2026-11-19", false], ["2026-11-20", true], ["2026-11-21", false]]);
  });

  it("puts a booked time on its Pacific day, not its UTC one", () => {
    // 23:30 Pacific on the 21st is the 22nd in UTC.
    const days = daysOf([lead({ stage: "Confirmed", when: "2026-11-22T07:30:00Z", contract: "Signed", release: "Signed" })], "2026-11-20", 3);
    expect(days[1].evs).toEqual([expect.objectContaining({ small: "11:30 PM Shoot", text: "Ana" })]);
    expect(days[2].evs).toEqual([]);
  });

  it("leaves out archived leads and the dates of closed ones", () => {
    const days = daysOf([
      lead({ stage: "Confirmed", when: "2026-11-21T18:00:00Z", archivedAt: at }),
      lead({ stage: "Lost", when: "2026-11-21T18:00:00Z" }),
    ], "2026-11-20", 2);
    expect(days.flatMap((d) => d.evs)).toEqual([]);
  });

  it("lands a reminder still to come on its day, and one that is due today as Due", () => {
    const later = daysOf([lead({ stage: "Quoted", stageAt: "2026-11-20T17:00:00Z", lastAt: "2026-11-20T17:00:00Z", due: "2026-11-21T18:00:00Z", dueText: "Chase the quote" })], "2026-11-20", 2);
    expect(later[1].evs).toEqual([expect.objectContaining({ small: "Reminder", text: "Chase the quote", who: "Ana" })]);
    const now = daysOf([lead({ stage: "Quoted", due: "2026-11-19T18:00:00Z", dueText: "Chase the quote" })], "2026-11-20", 2);
    expect(now[0].evs).toEqual([expect.objectContaining({ small: "Due", due: true, who: "Ana" })]);
  });
});
