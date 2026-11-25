import { expect, it } from "vitest";
import { needsMe } from "@/lib/leads/lead-desk";
import { applyLeadEvent, type LeadSummary } from "@/lib/leads/leads";
import { DAY_MS } from "@/lib/time-zone";

/* Needs me, as a truth table over what decides it. Fake people only. */

const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
const lead = (o: {
  renew?: boolean;
  aside?: boolean;
  closed?: boolean;
  due?: boolean;
  snoozed?: boolean;
  unread?: boolean;
}): LeadSummary => ({
  email: "ana@example.com",
  name: "Ana Test",
  stage: o.closed ? "Delivered" : "Replied",
  stageAt: iso(0),
  firstAt: iso(0),
  lastAt: iso(0),
  unread: !!o.unread,
  ...(o.renew ? { licence: { use: "Web", end: iso(10 * DAY_MS).slice(0, 10) } } : {}),
  ...(o.aside ? { archivedAt: iso(-DAY_MS) } : {}),
  ...(o.due ? { due: iso(-DAY_MS) } : {}),
  ...(o.snoozed ? { snoozeUntil: iso(DAY_MS) } : {}),
});

it.each([
  // renew, aside, closed, due, snoozed, unread => needs me
  [{}, false],
  [{ unread: true }, true],
  [{ unread: true, snoozed: true }, false],
  [{ due: true, snoozed: true }, true], // a due reminder beats a snooze
  [{ due: true, aside: true }, false],
  [{ due: true, closed: true }, false],
  [{ unread: true, aside: true }, false],
  [{ unread: true, closed: true }, false],
  [{ renew: true, closed: true }, true], // a licence ending brings back even a Delivered lead
  [{ renew: true, aside: true }, true],
  [{ renew: true, snoozed: true }, false], // a snooze holds the renewal off
  [{ renew: true, snoozed: true, unread: true }, false],
] as const)("%o needs me: %s", (o, want) => {
  expect(needsMe(lead(o))).toBe(want);
});

it("fills the name of a lead first made from a mixed-case address with no name", () => {
  const at = "2026-11-02T00:00:00Z";
  const bare = applyLeadEvent(null, "Maya@Example.com", { event: { at, kind: "call", ref: "cal:1" } });
  expect(bare.name).toBe("Maya@Example.com");
  expect(applyLeadEvent(bare, "Maya@Example.com", { event: { at, kind: "inquiry", ref: "msg:1" }, name: "Maya" }).name).toBe("Maya");
});
