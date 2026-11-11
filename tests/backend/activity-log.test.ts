import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordLead } from "@/lib/leads/lead-store";
import { sealer } from "@/lib/leads/lead-crypto";
import { fold, type Lead } from "@/lib/leads/leads";
import { fresh, readLog, readMaster } from "@/lib/leads/activity-log";
import { FakeKV, LEADS_KEY } from "./fakes";

/* The activity log (`lib/leads/activity-log.ts`): every event in full, per
   client and in one master list, sealed, and cleaned up with the lead. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));
const { GET, PATCH, DELETE } = await import("@/app/api/inbox/route");

const KEY = "inbox-key-for-tests";
const req = (method: string, { body, query = "" }: { body?: string; query?: string } = {}) =>
  new Request("https://juliangigola.com/api/inbox" + query, { method, body, headers: { "x-inbox-key": KEY } });

let kv: FakeKV;
beforeEach(() => {
  kv = new FakeKV();
  ctx.env = { INBOX: kv, INBOX_KEY: KEY, LEADS_KEY };
});
const s = async () => (await sealer(LEADS_KEY))!;
const env = () => ({ INBOX: kv as never, LEADS_KEY });
const t = (m: number) => new Date(Date.UTC(2026, 10, 1, 10, m)).toISOString();

describe("fold, money", () => {
  // Made after the cut-off (PAID_BEFORE), so only a payment settles them.
  const inv = (no: string, rate: number) => ({ no, date: "2026-12-01", lines: [{ desc: "Session", qty: 1, rate }], paid: 0, at: "2026-12-01T10:00:00Z" });
  const withInvoices = (...invoices: ReturnType<typeof inv>[]): Lead => ({ ...fold(null, "a@example.com", { event: { at: t(0), kind: "inquiry" } }), invoices });

  it("settles the one invoice a non-deposit payment matches, and never on a deposit", () => {
    const l = withInvoices(inv("1126", 1700), inv("1126-2", 400));
    const deposit = fold(l, l.email, { event: { at: t(1), kind: "payment", ref: "pi_1", note: "Deposit", amount: 1700 } });
    expect(deposit.invoices!.every((v) => !v.paidAt)).toBe(true);
    const paid = fold(l, l.email, { event: { at: t(2), kind: "payment", ref: "pi_2", amount: 1700 }, settles: true });
    expect(paid.invoices!.map((v) => !!v.paidAt)).toEqual([true, false]);
  });

  it("leaves two invoices of the same balance alone unless the payment names one", () => {
    const l = withInvoices(inv("1126", 500), inv("1126-2", 500));
    expect(fold(l, l.email, { event: { at: t(2), kind: "payment", ref: "pi_3", amount: 500 }, settles: true }).invoices!.some((v) => v.paidAt)).toBe(false);
    const named = fold(l, l.email, { event: { at: t(2), kind: "payment", ref: "pi_4", amount: 500 }, settles: true, invoiceNo: "1126-2" });
    expect(named.invoices!.map((v) => !!v.paidAt)).toEqual([false, true]);
  });

  it("a cancel clears the booked time", () => {
    const l = fold(null, "a@example.com", { event: { at: t(0), kind: "booking", ref: "b1" }, when: t(600) });
    expect(fold(l, l.email, { event: { at: t(1), kind: "cancel", ref: "cancel:b1" } }).when).toBeUndefined();
  });
});

describe("the log", () => {
  it("keeps every event past the lead's 50, per client and in the master, sealed", async () => {
    for (let i = 0; i < 60; i++) await recordLead(env(), "a@example.com", { event: { at: t(i), kind: "wrote", ref: `g${i}` } });
    await recordLead(env(), "b@example.com", { event: { at: t(30), kind: "inquiry", ref: "msg:b" }, name: "Bo" });
    const seal = await s();
    const id = await seal.id("a@example.com");
    const log = await readLog(kv as never, seal, id);
    expect(log).toHaveLength(60);
    const master = await readMaster(kv as never, seal);
    expect(master).toHaveLength(61);
    expect(master.map((m) => m.event.at)).toEqual([...master.map((m) => m.event.at)].sort());
    // Linked both ways: the client entry names its master key, the master entry the lead.
    expect(kv.data.has(log[0].m)).toBe(true);
    expect(master.find((m) => m.email === "b@example.com")?.lead).toBe(await seal.id("b@example.com"));
    expect(JSON.stringify([...kv.data.entries()].filter(([k]) => k.startsWith("log")))).not.toContain("example.com");
  });

  it("logs what he does on the desk once, and a merged record's history is not logged twice", async () => {
    await recordLead(env(), "a@example.com", { event: { at: t(0), kind: "inquiry", ref: "msg:a" }, name: "Ana" });
    await recordLead(env(), "a2@example.com", { event: { at: t(1), kind: "inquiry", ref: "msg:a2" }, name: "Ana" });
    const seal = await s();
    const [a, a2] = [await seal.id("a@example.com"), await seal.id("a2@example.com")];
    await PATCH(req("PATCH", { body: JSON.stringify({ key: `lead:${a}`, stage: "Quoted", quote: 1200 }) }));
    await PATCH(req("PATCH", { body: JSON.stringify({ key: `lead:${a}`, mergeFrom: `lead:${a2}` }) }));
    const log = await readLog(kv as never, seal, a);
    expect(log.map((e) => e.kind)).toEqual(["inquiry", "inquiry", "stage", "quote", "merge"]);
    expect(kv.data.has(`log:${a2}`)).toBe(false);
    const master = await readMaster(kv as never, seal);
    expect(master).toHaveLength(5);
    expect(master.every((m) => m.lead === a)).toBe(true);
  });

  it("Mark paid settles an invoice by hand and lands on the log", async () => {
    await recordLead(env(), "a@example.com", { event: { at: t(0), kind: "inquiry", ref: "msg:a" }, name: "Ana" });
    const seal = await s();
    const key = `lead:${await seal.id("a@example.com")}`;
    const made = await (await PATCH(req("PATCH", { body: JSON.stringify({ key, invoice: { date: "2026-11-02", lines: [{ desc: "Session", qty: 1, rate: 900 }], paid: 100 } }) }))).json();
    const no = made.lead.invoices[0].no;
    const paid = await (await PATCH(req("PATCH", { body: JSON.stringify({ key, invoicePaid: { no, paid: true } }) }))).json();
    expect(paid.lead.invoices[0].paidAt).toBeTruthy();
    expect((await readLog(kv as never, seal, key.slice(5))).at(-1)).toMatchObject({ kind: "invoice-paid", amount: 800 });
    // Cash counts as money in the export; unmarking takes it off again.
    const paidCol = async () => { const [h, r] = (await (await GET(req("GET", { query: "?csv" }))).text()).trim().split("\r\n"); return r.split(",")[h.split(",").indexOf("paid total")]; };
    expect(await paidCol()).toBe("800");
    await PATCH(req("PATCH", { body: JSON.stringify({ key, invoicePaid: { no, paid: false } }) }));
    expect(await paidCol()).toBe("0");
  });

  it("emptying the trash deletes the log and its master entries too", async () => {
    await recordLead(env(), "gone@example.com", { event: { at: t(0), kind: "inquiry", ref: "msg:g" } });
    const seal = await s();
    const key = `lead:${await seal.id("gone@example.com")}`;
    await PATCH(req("PATCH", { body: JSON.stringify({ key, trash: true }) }));
    await DELETE(req("DELETE", { body: JSON.stringify({ emptyTrash: true }) }));
    expect([...kv.data.keys()].filter((k) => k.startsWith("log"))).toEqual([]);
  });

  it("exports both CSVs: clients with paid and open balance, every event", async () => {
    await recordLead(env(), "a@example.com", { event: { at: t(0), kind: "inquiry", ref: "msg:a" }, name: "Ana" });
    await recordLead(env(), "a@example.com", { event: { at: t(1), kind: "payment", ref: "pi_1", note: "Deposit", amount: 100 } });
    const clients = await (await GET(req("GET", { query: "?csv" }))).text();
    const [head, row] = clients.trim().split("\r\n");
    const cols = head.split(",");
    expect(row.split(",")[cols.indexOf("paid total")]).toBe("100");
    expect(cols).toContain("open balance");
    const events = (await (await GET(req("GET", { query: "?csv=events" }))).text()).trim().split("\r\n");
    expect(events[0]).toBe("time,client,email,kind,detail,amount,lead id");
    expect(events).toHaveLength(3);
    expect(events[2]).toContain("payment");
  });
});

describe("old invoices", () => {
  it("count as paid before the cut-off unless marked unpaid; newer ones wait for a payment", async () => {
    const { isPaid, PAID_BEFORE } = await import("@/lib/leads/invoice");
    expect(isPaid({ at: "2026-10-01T00:00:00Z" })).toBe(true);
    expect(isPaid({ at: "2026-10-01T00:00:00Z", unpaid: true })).toBe(false);
    expect(isPaid({ at: `${PAID_BEFORE}T10:00:00Z` })).toBe(false);
    expect(isPaid({ at: `${PAID_BEFORE}T10:00:00Z`, paidAt: "x" })).toBe(true);
  });
});

describe("fresh", () => {
  it("returns only the events the earlier copy did not have", () => {
    const a = { at: t(0), kind: "inquiry" as const };
    const b = { at: t(1), kind: "stage" as const, note: "Quoted" };
    expect(fresh([a], [a, b])).toEqual([b]);
    expect(fresh(undefined, [a])).toEqual([a]);
  });
});
