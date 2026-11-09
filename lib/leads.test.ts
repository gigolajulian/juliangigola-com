import { describe, expect, it } from "vitest";
import { backfillLead, fold, isLate, paperDue, quoteNudge, leadKey, myMove, leadSummary, recordLead, renewDue, trashDaysLeft, writeLead, type InboxRow, type Lead, type LeadSummary } from "./leads";
import { sealer } from "./lead-crypto";

const at = (h: number) => new Date(Date.UTC(2026, 10, 2, h)).toISOString();
const email = "Maya@Example.com";

describe("fold", () => {
  it("keeps the start of their message and the picture count for the list, capped in the summary", () => {
    const long = "Hi Julian,\n\n  I saw the Portraits set " + "x".repeat(300);
    const l = fold(null, email, { event: { at: at(1), kind: "inquiry", ref: "msg:1" }, name: "Maya", snippet: long, refs: 2 });
    expect(l.snippet).toBe(("Hi Julian, I saw the Portraits set " + "x".repeat(300)).slice(0, 140));
    expect(l.refs).toBe(2);
    expect(leadSummary(l).snippet).toHaveLength(90);
    // A later event without a message keeps them; a message with no pictures drops the count.
    const call = fold(l, email, { event: { at: at(2), kind: "call", ref: "cal:1" } });
    expect(call).toMatchObject({ refs: 2 });
    expect(fold(call, email, { event: { at: at(3), kind: "inquiry", ref: "msg:2" }, snippet: "Again", refs: 0 })).not.toHaveProperty("refs");
  });

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
});

describe("quoteNudge", () => {
  const t0 = Date.parse(at(0));
  const d = (n: number) => t0 + n * 864e5;
  const iso = (n: number) => new Date(d(n)).toISOString();
  const quoted = (...sent: number[]) => ({
    stage: "Quoted" as const,
    stageAt: at(0),
    events: [{ at: iso(0.01), kind: "replied" as const }, ...sent.map((n) => ({ at: iso(n), kind: "replied" as const }))],
  });
  it("nudges at 3, 7 and 14 days, counting his mails after the quote", () => {
    expect(quoteNudge(quoted(), d(2.9))).toBe(null);
    expect(quoteNudge(quoted(), d(3.1))).toBe("Nudge 1");
    expect(quoteNudge(quoted(3.1), d(6.9))).toBe(null);
    expect(quoteNudge(quoted(3.1), d(7.1))).toBe("Nudge 2");
    expect(quoteNudge(quoted(3.1, 7.1), d(13.9))).toBe(null);
    expect(quoteNudge(quoted(3.1, 7.1), d(14.1))).toBe("Last nudge");
  });
  it("asks about lost a week after the last nudge, never sooner", () => {
    expect(quoteNudge(quoted(3.1, 7.1, 14.1), d(21))).toBe(null);
    expect(quoteNudge(quoted(3.1, 7.1, 14.1), d(21.2))).toBe("Mark as lost?");
  });
  it("starts over when they write, waits after a late nudge, and rests while snoozed", () => {
    const wrote = { ...quoted(3.1), events: [...quoted(3.1).events, { at: iso(5), kind: "wrote" as const }] };
    expect(quoteNudge(wrote, d(7.5))).toBe(null);
    expect(quoteNudge(wrote, d(8.1))).toBe("Nudge 1");
    expect(quoteNudge(quoted(6), d(7.5))).toBe(null);
    expect(quoteNudge(quoted(6), d(9.1))).toBe("Nudge 2");
    expect(quoteNudge({ ...quoted(), snoozeUntil: iso(10) }, d(5))).toBe(null);
    expect(isLate(quoted(), d(3.1))).toBe(true);
  });
  it("reads the same off a list summary", () => {
    expect(quoteNudge({ stage: "Quoted", stageAt: at(0), quiet: { from: at(0), n: 1, last: iso(3.1) } }, d(7.1))).toBe("Nudge 2");
    expect(quoteNudge({ stage: "Quoted", stageAt: at(0) }, d(3.1))).toBe("Nudge 1");
  });
});

describe("myMove", () => {
  const now = Date.parse(at(10));
  it("puts a shot lead and a call that has happened on Julian, nothing else", () => {
    expect(myMove({ stage: "Shot" }, now)).toBe("Deliver photos + invoice");
    expect(myMove({ stage: "Call booked", when: at(5) }, now)).toBe("Send the quote");
    expect(myMove({ stage: "Call booked" }, now)).toBe("Send the quote");
    expect(myMove({ stage: "Call booked", when: at(20) }, now)).toBeNull();
    expect(myMove({ stage: "Replied" }, now)).toBeNull();
    expect(myMove({ stage: "Confirmed" }, now)).toBeNull();
  });
});

describe("renewDue", () => {
  const licence = { use: "Web + social, US", end: "2027-03-01" };
  const end = Date.parse("2027-03-01T12:00:00Z");
  it("comes due 60 days before the end, not a day sooner", () => {
    expect(renewDue({ licence }, end - 61 * 864e5)).toBe(false);
    expect(renewDue({ licence }, end - 60 * 864e5)).toBe(true);
    expect(renewDue({ licence }, end - 10 * 864e5)).toBe(true);
  });
  it("stays due once ended, and never without a licence", () => {
    expect(renewDue({ licence }, end + 30 * 864e5)).toBe(true);
    expect(renewDue({}, end)).toBe(false);
  });
  it("rides in the list summary", () => {
    const l = fold(null, "a@b.co", { event: { at: at(0), kind: "inquiry" } });
    expect(leadSummary({ ...l, licence }).licence).toEqual(licence);
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

  it("shrinks the summary to fit KV's 1024 bytes for a long CJK name and message, and keeps a short one whole", async () => {
    const s = await sealer(LEADS_KEY)!;
    const meta = async (name: string, snippet: string) => {
      const store = kv();
      const who = `${name.length}@example.com`;
      await recordLead({ INBOX: store as never, LEADS_KEY }, who, { event: { at: at(1), kind: "inquiry", ref: "msg:1" }, name, snippet, refs: 3, when: at(40), flag: "stuck" });
      const id = leadKey(await s.id(who));
      // Snoozed and trashed too: every optional field set.
      const lead = await s.open<Lead>(store.data.get(id)!.v);
      await writeLead(store as never, s, id.slice(5), { ...lead, snoozeUntil: at(50), trashedAt: at(2) });
      const m = store.data.get(id)!.m as { s: string };
      return { size: JSON.stringify(m).length, summary: await s.open<LeadSummary>(m.s) };
    };
    const big = await meta("山田花子".repeat(20), "写真の撮影についてお問い合わせします。".repeat(10));
    expect(big.size).toBeLessThanOrEqual(1024);
    expect(big.summary.snippet).toBeUndefined();
    const small = await meta("Maya Okafor", "Hi Julian, I saw the Portraits set.");
    expect(small.summary).toMatchObject({ name: "Maya Okafor", snippet: "Hi Julian, I saw the Portraits set." });
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

describe("archive and trash", () => {
  it("sets aside without touching the stage, a new message unarchives, the trash keeps it", () => {
    let l = fold(null, email, { event: { at: at(1), kind: "inquiry" } });
    l = fold(l, email, { event: { at: at(2), kind: "stage" }, stage: "Quoted" });
    l = fold(l, email, { event: { at: at(3), kind: "archive", note: "in" }, on: true });
    expect(l).toMatchObject({ stage: "Quoted", archivedAt: at(3) });
    l = fold(l, email, { event: { at: at(4), kind: "inquiry" } });
    expect(l.archivedAt).toBeUndefined();
    l = fold(l, email, { event: { at: at(5), kind: "trash", note: "in" }, on: true });
    l = fold(l, email, { event: { at: at(6), kind: "inquiry" } });
    expect(l.trashedAt).toBe(at(5));
    l = fold(l, email, { event: { at: at(7), kind: "trash", note: "out" }, on: false });
    expect(l.trashedAt).toBeUndefined();
    expect(l.stage).toBe("Quoted");
  });
});

describe("trashDaysLeft", () => {
  it("counts down from 30 and is due after", () => {
    const t = Date.parse(at(0));
    expect(trashDaysLeft(at(0), t)).toBe(30);
    expect(trashDaysLeft(at(0), t + 29.5 * 864e5)).toBe(1);
    expect(trashDaysLeft(at(0), t + 30 * 864e5)).toBe(0);
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

  it("imports an all-read inquiry as Replied, and leaves an unread one at Inquiry", () => {
    expect(backfillLead(null, "maya@example.com", [row(1), row(2)])).toMatchObject({ stage: "Replied", unread: false });
    expect(backfillLead(null, "maya@example.com", [row(1), row(2, { read: false })])).toMatchObject({ stage: "Inquiry", unread: true });
    expect(backfillLead(null, "maya@example.com", [row(1, { type: "booking", detail: "Headshots" })])!.stage).toBe("Confirmed");
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

describe("paperDue", () => {
  const now = Date.parse("2026-11-08T12:00:00Z");
  const soon = new Date(now + 3 * 864e5).toISOString();
  const base = { stage: "Confirmed" as const, when: soon };

  it("asks for the contract first, then the release, when the shoot is within a week", () => {
    expect(paperDue(base, now)).toBe("contract");
    expect(paperDue({ ...base, contract: "Sent" }, now)).toBe("contract");
    expect(paperDue({ ...base, contract: "Signed" }, now)).toBe("release");
    expect(paperDue({ ...base, contract: "Not needed", release: "Sent" }, now)).toBe("release");
    expect(paperDue({ ...base, contract: "Signed", release: "Not needed" }, now)).toBeNull();
  });

  it("stays quiet before Confirmed, after the shoot, more than 7 days out, or with no date", () => {
    expect(paperDue({ ...base, stage: "Quoted" }, now)).toBeNull();
    expect(paperDue({ ...base, stage: "Shot" }, now)).toBeNull();
    expect(paperDue({ ...base, when: new Date(now + 8 * 864e5).toISOString() }, now)).toBeNull();
    expect(paperDue({ ...base, when: new Date(now - 3600e3).toISOString() }, now)).toBeNull();
    expect(paperDue({ stage: "Confirmed" }, now)).toBeNull();
    expect(paperDue({ ...base, when: new Date(now + 7 * 864e5).toISOString() }, now)).toBe("contract");
  });
});
