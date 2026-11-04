import { describe, expect, it } from "vitest";
import { fold, isLate, leadKey, leadSummary, recordLead, type Lead } from "./leads";

const at = (h: number) => new Date(Date.UTC(2026, 10, 2, h)).toISOString();
const email = "Maya@Example.com";

describe("fold", () => {
  it("starts a lead at Inquiry from a form, keyed by the lowercased address", () => {
    const l = fold(null, email, { event: { at: at(1), kind: "inquiry", ref: "msg:1" }, name: "Maya", kind: "portrait" });
    expect(leadKey(email)).toBe("lead:maya@example.com");
    expect(l).toMatchObject({ email: "maya@example.com", name: "Maya", stage: "Inquiry", unread: true, kind: "portrait" });
  });

  it("merges form, call and paid booking into one person, moving forward only", () => {
    let l = fold(null, email, { event: { at: at(1), kind: "inquiry", ref: "msg:1" }, name: "Maya" });
    l = fold(l, email, { event: { at: at(2), kind: "call", ref: "cal-a" }, when: at(30) });
    expect(l.stage).toBe("Call booked");
    l = fold(l, email, { event: { at: at(3), kind: "booking", ref: "cal-b" }, deposit: "https://stripe/x" });
    expect(l).toMatchObject({ stage: "Confirmed", stageAt: at(3), deposit: "https://stripe/x" });
    // A second inquiry from a confirmed client keeps her Confirmed.
    l = fold(l, email, { event: { at: at(4), kind: "inquiry", ref: "msg:2" } });
    expect(l.stage).toBe("Confirmed");
    expect(l.events).toHaveLength(4);
  });

  it("folds a webhook retry in once", () => {
    const l = fold(null, email, { event: { at: at(1), kind: "call", ref: "cal-a" } });
    expect(fold(l, email, { event: { at: at(2), kind: "call", ref: "cal-a" } })).toBe(l);
  });

  it("reopens a delivered or lost client on a new inquiry", () => {
    let l = fold(null, email, { event: { at: at(1), kind: "inquiry" } });
    l = fold(l, email, { event: { at: at(2), kind: "stage" }, stage: "Lost" });
    expect(l.stage).toBe("Lost");
    l = fold(l, email, { event: { at: at(3), kind: "inquiry" } });
    expect(l).toMatchObject({ stage: "Inquiry", stageAt: at(3) });
  });

  it("lets Julian move a stage back, and snoozing wakes on news", () => {
    let l = fold(null, email, { event: { at: at(1), kind: "booking" } });
    l = fold(l, email, { event: { at: at(2), kind: "stage" }, stage: "Quoted" });
    expect(l.stage).toBe("Quoted");
    l = fold(l, email, { event: { at: at(3), kind: "snooze" }, snoozeUntil: at(50) });
    expect(l.snoozeUntil).toBe(at(50));
    l = fold(l, email, { event: { at: at(4), kind: "call" } });
    expect(l.snoozeUntil).toBeUndefined();
  });

  it("keeps a flag once", () => {
    let l = fold(null, email, { event: { at: at(1), kind: "deposit-stuck", ref: "pi_1" }, flag: "stuck" });
    l = fold(l, email, { event: { at: at(2), kind: "deposit-stuck", ref: "pi_2" }, flag: "stuck" });
    expect(l.flags).toEqual(["stuck"]);
  });
});

describe("isLate", () => {
  const now = Date.parse(at(0)) + 26 * 3600e3;
  it("flags an inquiry past the reply time, not before, not while snoozed", () => {
    expect(isLate({ stage: "Inquiry", stageAt: at(0) }, now)).toBe(true);
    expect(isLate({ stage: "Inquiry", stageAt: at(4) }, now)).toBe(false);
    expect(isLate({ stage: "Inquiry", stageAt: at(0), snoozeUntil: at(40) }, now)).toBe(false);
    expect(isLate({ stage: "Confirmed", stageAt: at(0) }, now)).toBe(false);
  });
  it("flags a quote unanswered for five days", () => {
    expect(isLate({ stage: "Quoted", stageAt: at(0) }, Date.parse(at(0)) + 6 * 864e5)).toBe(true);
  });
});

describe("recordLead", () => {
  const kv = () => {
    const data = new Map<string, { v: string; m: unknown }>();
    return {
      data,
      get: async (k: string) => data.get(k)?.v ?? null,
      put: async (k: string, v: string, o?: { metadata?: unknown }) => void data.set(k, { v, m: o?.metadata }),
    };
  };

  it("stores the record with its summary as metadata, small enough for KV", async () => {
    const store = kv();
    await recordLead(store as never, email, { event: { at: at(1), kind: "inquiry", ref: "msg:1" }, name: "Maya" });
    const row = store.data.get("lead:maya@example.com")!;
    expect((JSON.parse(row.v) as Lead).events).toHaveLength(1);
    expect(row.m).toEqual(leadSummary(JSON.parse(row.v)));
    expect(JSON.stringify(row.m).length).toBeLessThan(1024);
  });

  it("never throws, and skips a booking with no address", async () => {
    const broken = { get: async () => { throw new Error("down"); }, put: async () => {} };
    expect(await recordLead(broken as never, email, { event: { at: at(1), kind: "inquiry" } })).toBeNull();
    expect(await recordLead(kv() as never, "", { event: { at: at(1), kind: "call" } })).toBeNull();
  });
});
