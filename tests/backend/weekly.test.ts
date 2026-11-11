import { describe, expect, it, vi } from "vitest";
import { stats } from "@/lib/leads/lead-crm";
import { weeklyMail } from "@/lib/leads/weekly";
import { appendLog, type MasterEntry } from "@/lib/leads/activity-log";
import { sealer } from "@/lib/leads/lead-crypto";
import type { Lead, LeadEvent } from "@/lib/leads/leads";
import { weekly } from "@/worker/index";
import { FakeKV, LEADS_KEY } from "./fakes";

/* Repeat clients and lifetime value in Stats, and the Monday mail to hello@. Fake people only. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const NOW = Date.parse("2026-11-09T17:00:00Z"); // Monday 9 AM Pacific
const mk = (id: string, o: Partial<Lead> = {}): Lead & { id: string } => ({ id, email: `${id}@example.com`, name: id, stage: "Confirmed", stageAt: "2026-10-01T00:00:00Z", firstAt: "2026-10-01T00:00:00Z", lastAt: "2026-10-01T00:00:00Z", unread: false, events: [], ...o });
const ev = (lead: string, at: string, kind: LeadEvent["kind"], o: Partial<LeadEvent> = {}): MasterEntry => ({ lead, email: `${lead}@example.com`, name: lead, event: { at, kind, ...o } });

const leads = [
  mk("Ana Test"),
  mk("Ben Sample", { firstAt: "2026-11-05T00:00:00Z", kind: "intro-call", source: "Booking page" }),
  mk("Cy Example", { flags: ["stuck"] }),
  mk("Dee Fake", { invoices: [{ no: "1026", date: "2026-10-20", lines: [{ desc: "Shoot", qty: 1, rate: 800 }], paid: 100, at: "2026-11-15T00:00:00Z", b: { due: "2026-11-01" } as never }] }),
  mk("Gone Trash", { trashedAt: "2026-11-01T00:00:00Z" }),
];
const master = [
  ev("Ana Test", "2026-09-01T00:00:00Z", "booking"),
  ev("Ana Test", "2026-09-02T00:00:00Z", "payment", { amount: 500 }),
  ev("Ana Test", "2026-11-04T00:00:00Z", "call", { note: "Intro call" }),
  ev("Ana Test", "2026-11-06T00:00:00Z", "payment", { amount: 300 }),
  ev("Ben Sample", "2026-11-05T00:00:00Z", "booking", { note: "Portraits" }),
  ev("Ben Sample", "2026-11-05T01:00:00Z", "payment", { amount: 100 }),
  ev("Ben Sample", "2026-11-07T00:00:00Z", "refund", { amount: 100 }),
  ev("Cy Example", "2026-11-08T00:00:00Z", "reschedule", { note: "Headshots" }),
  ev("Dee Fake", "2026-10-30T00:00:00Z", "cancel"),
  ev("Gone Trash", "2026-11-08T00:00:00Z", "payment", { amount: 999 }),
];

describe("stats: repeat clients and lifetime value", () => {
  it("counts two or more sessions as repeat, averages paid less refunds, ranks the top clients", () => {
    const s = stats(leads, NOW, master);
    expect(s.repeat).toBe(1);
    expect(s.lifetime).toBe(800);
    expect(s.top).toEqual([{ name: "Ana Test", sessions: 2, paid: 800 }]);
    expect(stats(leads, NOW)).toMatchObject({ repeat: 0, lifetime: null, top: [] });
  });
});

describe("weeklyMail", () => {
  it("builds the week from the master log", () => {
    const { subject, lines } = weeklyMail(leads, master, NOW);
    const text = lines.join("\n");
    expect(subject).toBe("My week: 1 new, $300 in, 2 booked");
    expect(text).toContain("My week on the desk, Nov 2 to Nov 9.");
    expect(text).toContain("New leads: 1\n  Ben Sample, intro call (Booking page)");
    expect(text).toContain("Paid in: $400, refunded $100");
    expect(text).toContain("Sessions booked: 2, moved: 1, cancelled: 0");
    expect(text).toContain("  Cy Example, Headshots");
    expect(text).toContain("  Cy Example, deposit stuck, refund or rebook");
    expect(text).toContain("  Dee Fake, invoice 1026 due 2026-11-01, $700 open");
    expect(text).not.toContain("Gone Trash");
    expect(text).not.toContain(String.fromCharCode(8212));
    expect(weeklyMail([], [], NOW).lines).toContain("Nothing stuck.");
  });
});

describe("POST /api/leads/weekly", () => {
  it("refuses a wrong bearer, renders on ?dry without sending, mails hello@ otherwise", async () => {
    const { POST } = await import("@/app/api/leads/weekly/route");
    const kv = new FakeKV();
    const seal = (await sealer(LEADS_KEY))!;
    const at = new Date(Date.now() - 864e5).toISOString();
    await kv.put("lead:ben", await seal.seal(mk("Ben Sample", { firstAt: at })));
    await appendLog(kv, seal, "ben", { email: "ben@example.com", name: "Ben Sample" }, [{ at, kind: "payment", amount: 100 }]);
    const sent: { subject: string; text: string }[] = [];
    ctx.env = { INBOX: kv, LEADS_KEY, BOOKING_SECRET: "s", EMAIL: { send: async (m: { subject: string; text: string }) => void sent.push(m) } };
    const call = (q = "", auth = "Bearer s") => POST(new Request(`https://juliangigola.com/api/leads/weekly${q}`, { method: "POST", headers: { authorization: auth } }));
    expect((await call("", "Bearer no")).status).toBe(401);
    const dry = await (await call("?dry")).json();
    expect(dry.text).toContain("Paid in: $100\n  Ben Sample, $100");
    expect(sent).toEqual([]);
    expect(await (await call()).json()).toEqual({ sent: true });
    expect(sent[0].subject).toBe("My week: 1 new, $100 in, 0 booked");
  });
});

describe("worker weekly", () => {
  it("asks the site only at 9 AM Pacific", async () => {
    const hits: string[] = [];
    const env = { BOOKING_SECRET: "s", SITE: { fetch: async (u: string) => (hits.push(u), Response.json({})) } } as never;
    await weekly(env, new Date("2026-11-09T16:00:00Z")); // 8 AM PST
    await weekly(env, new Date("2026-11-09T17:00:00Z")); // 9 AM PST
    await weekly(env, new Date("2026-06-01T16:00:00Z")); // 9 AM PDT
    expect(hits).toEqual(["https://juliangigola.com/api/leads/weekly", "https://juliangigola.com/api/leads/weekly"]);
  });
});
