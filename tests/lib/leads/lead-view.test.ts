import { describe, expect, it } from "vitest";
import { isFilter } from "@/lib/leads/lead-desk";
import { leadView } from "@/lib/leads/lead-view";
import type { Lead, LeadSummary } from "@/lib/leads/leads";
import { DAY_MS } from "@/lib/time-zone";

/* What the lead page reads off one lead. Fake people only. */

const now = Date.now();
const iso = (ms: number) => new Date(now + ms).toISOString();
const summary: LeadSummary = {
  email: "ana@example.com",
  name: "Ana Test",
  stage: "Replied",
  stageAt: iso(0),
  firstAt: iso(0),
  lastAt: iso(0),
  unread: false,
};
const full = (o: Partial<Lead> = {}): Lead => ({ ...summary, events: [], ...o });

describe("leadView", () => {
  it("reads handles off a hand-added lead with no email", () => {
    const v = leadView(null, { ...summary, email: "ig:@ana.test" }, [], now);
    expect(v).toMatchObject({ first: "Ana", mailOk: false, ig: "@ana.test", phone: undefined, primary: null });
    expect(leadView(null, { ...summary, email: "tel:+15550100" }, [], now).phone).toBe("+15550100");
  });

  it("offers the nudge on a late quote", () => {
    const quoted = { ...summary, stage: "Quoted" as const, stageAt: iso(-4 * DAY_MS) };
    const v = leadView(null, quoted, [{ id: "nudge1", name: "Nudge 1", subject: "Following up", body: "Hi {first}" }], now);
    expect(v.late).toBe(true);
    expect(v.nudgeStep).toBe("Nudge 1");
    expect(v.primary).toMatchObject({
      label: "Send Nudge 1",
      win: "Land the booking",
      mail: ["ana@example.com", "Following up", "Hi Ana"],
    });
  });

  it("finds the booking still to come", () => {
    const when = iso(2 * DAY_MS);
    const v = leadView(
      full({ when, events: [{ at: iso(-DAY_MS), kind: "booking", ref: "bk1", note: "Portrait session" }] }),
      summary,
      [],
      now,
    );
    expect(v.booked).toBe("bk1");
    expect(v.ahead).toBe(true);
    expect(v.which).toMatch(/^Portrait session on /);
    expect(leadView(full({ events: [{ at: iso(0), kind: "booking", ref: "bk1" }] }), summary, [], now).booked).toBeUndefined();
  });

  it("owes the quote until there is an invoice", () => {
    expect(leadView(full({ quote: 800 }), summary, [], now).owed).toBe(800);
    expect(leadView(null, summary, [], now).owed).toBeUndefined();
  });
});

describe("isFilter", () => {
  it("takes a stage or one of the desk's lists, nothing else", () => {
    expect(["snoozed", "trash", "needs", "Delivered", "Lost"].every(isFilter)).toBe(true);
    expect(isFilter("leads")).toBe(false);
  });
});
