import { describe, expect, it } from "vitest";
import { backfillLead, fold, isLate, leadKey, leadSummary, recordLead, type InboxRow, type Lead } from "./leads";
import { sealer } from "./lead-crypto";

const at = (h: number) => new Date(Date.UTC(2026, 10, 2, h)).toISOString();
const email = "Maya@Example.com";

describe("fold", () => {
  it("starts a lead at Inquiry from a form, keyed by the lowercased address", () => {
    const l = fold(null, email, { event: { at: at(1), kind: "inquiry", ref: "msg:1" }, name: "Maya", kind: "portrait" });
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

  it("unsnoozing by hand keeps the stage and puts it back under Needs me", () => {
    let l = fold(null, email, { event: { at: at(1), kind: "inquiry" } });
    l = fold(l, email, { event: { at: at(2), kind: "stage" }, stage: "Quoted" });
    l = { ...l, unread: false };
    l = fold(l, email, { event: { at: at(3), kind: "snooze" }, snoozeUntil: at(50) });
    l = fold(l, email, { event: { at: at(4), kind: "snooze", note: "woken" }, snoozeUntil: "" });
    expect(l).toMatchObject({ stage: "Quoted", unread: true });
    expect(l.snoozeUntil).toBeUndefined();
  });

  it("logs a mail on the timeline without making it news or moving the stage", () => {
    let l = fold(null, email, { event: { at: at(1), kind: "call", ref: "c1" } });
    l = { ...l, unread: false };
    l = fold(l, email, { event: { at: at(2), kind: "mail", note: "Booked: Call", mail: { to: "client", kind: "confirm", booking: "c1" } } });
    expect(l).toMatchObject({ stage: "Call booked", unread: false, lastAt: at(1) });
    expect(l.events.at(-1)).toMatchObject({ kind: "mail", note: "Booked: Call", mail: { to: "client" } });
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
  const LEADS_KEY = btoa("k".repeat(32));
  const kv = () => {
    const data = new Map<string, { v: string; m: unknown }>();
    return {
      data,
      get: async (k: string) => data.get(k)?.v ?? null,
      put: async (k: string, v: string, o?: { metadata?: unknown }) => void data.set(k, { v, m: o?.metadata }),
    };
  };

  it("stores the record sealed, keyed by an id, with a sealed summary small enough for KV", async () => {
    const store = kv();
    await recordLead({ INBOX: store as never, LEADS_KEY }, email, { event: { at: at(1), kind: "inquiry", ref: "msg:1" }, name: "Maya" });
    const s = await sealer(LEADS_KEY)!;
    const row = store.data.get(leadKey(await s.id(email)))!;
    expect(row.v).not.toContain("Maya");
    const lead = await s.open<Lead>(row.v);
    expect(lead.events).toHaveLength(1);
    const m = row.m as { s: string };
    expect(await s.open(m.s)).toEqual(leadSummary(lead));
    expect(JSON.stringify(m).length).toBeLessThan(1024);
  });

  it("never throws, skips a booking with no address, and records nothing without LEADS_KEY", async () => {
    const broken = { get: async () => { throw new Error("down"); }, put: async () => {} };
    expect(await recordLead({ INBOX: broken as never, LEADS_KEY }, email, { event: { at: at(1), kind: "inquiry" } })).toBeNull();
    expect(await recordLead({ INBOX: kv() as never, LEADS_KEY }, "", { event: { at: at(1), kind: "call" } })).toBeNull();
    const plain = kv();
    expect(await recordLead({ INBOX: plain as never }, email, { event: { at: at(1), kind: "inquiry" } })).toBeNull();
    expect(plain.data.size).toBe(0);
  });
});

describe("sealer", () => {
  it("opens what it seals with a fresh IV each time, and ids ignore case", async () => {
    const s = await sealer(btoa("k".repeat(32)))!;
    const a = await s.seal({ x: 1 });
    expect(a).not.toBe(await s.seal({ x: 1 }));
    expect(await s.open(a)).toEqual({ x: 1 });
    expect(await s.id("A@Example.com")).toBe(await s.id("a@example.com"));
    expect(await s.id("a@example.com")).toMatch(/^[0-9a-f]{32}$/);
  });
  it("refuses a key that is not 32 bytes, and another key cannot open it", async () => {
    expect(sealer("short")).toBeNull();
    expect(sealer(undefined)).toBeNull();
    const sealed = await (await sealer(btoa("k".repeat(32)))!).seal({ x: 1 });
    await expect((await sealer(btoa("j".repeat(32)))!).open(sealed)).rejects.toThrow();
  });
});

describe("leadSummary", () => {
  it("keeps a sealed summary under KV's 1024-byte metadata cap, however long the name", async () => {
    const s = await sealer(btoa(String.fromCharCode(...new Uint8Array(32).fill(7))))!;
    const l = fold(null, `${"a".repeat(300)}@example.com`, { event: { at: "2026-11-03T00:00:00Z", kind: "call" }, name: "N".repeat(600), kind: "intro-call" });
    expect(JSON.stringify({ s: await s.seal(leadSummary(l)) }).length).toBeLessThan(1024);
  });
});

describe("backfillLead", () => {
  const row = (h: number, extra: Partial<InboxRow> = {}): InboxRow => ({ key: `msg:${h}`, at: at(h), type: "portrait", name: "Maya", email: "maya@example.com", read: true, ...extra });

  it("builds a new lead in time order at the rows' own times, unread only if a row was", () => {
    const l = backfillLead(null, "maya@example.com", [row(5, { type: "booking", detail: "Headshots · Sat" }), row(1)])!;
    expect(l).toMatchObject({ stage: "Confirmed", firstAt: at(1), lastAt: at(5), unread: false });
    expect(l.events.map((e) => e.kind)).toEqual(["inquiry", "booking"]);
    expect(backfillLead(null, "maya@example.com", [row(1, { read: false })])!.unread).toBe(true);
  });

  it("tells a call and a stuck deposit from a booking", () => {
    const l = backfillLead(null, "maya@example.com", [row(1, { type: "booking", detail: "Intro call · Mon" }), row(2, { key: "msg:x", type: "booking", detail: "Deposit paid, not booked, not refunded" })])!;
    expect(l.events.map((e) => e.kind)).toEqual(["call", "deposit-stuck"]);
  });

  it("adds old rows to an existing lead without touching its stage, snooze or unread, and changes nothing the second time", () => {
    let l = fold(null, "maya@example.com", { event: { at: at(10), kind: "inquiry", ref: "msg:10" } });
    l = { ...fold(l, "maya@example.com", { event: { at: at(11), kind: "stage" }, stage: "Quoted" }), unread: false, snoozeUntil: at(40) };
    const once = backfillLead(l, "maya@example.com", [row(1), row(10)])!;
    expect(once).toMatchObject({ stage: "Quoted", unread: false, snoozeUntil: at(40), firstAt: at(1) });
    expect(once.events.map((e) => e.at)).toEqual([at(1), at(10), at(11)]);
    expect(backfillLead(once, "maya@example.com", [row(1), row(10)])).toBeNull();
  });

  it("skips a booking already recorded live under its Cal.com uid", () => {
    const l = fold(null, "maya@example.com", { event: { at: at(3), kind: "booking", ref: "cal-uid" } });
    expect(backfillLead(l, "maya@example.com", [row(3, { type: "booking", detail: "Headshots" })])).toBeNull();
  });
});
