import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { summary, enquiry, enquiryKey } from "@/lib/leads/enquiry";
import { recordLead } from "@/lib/leads/lead-store";
import { FakeKV, LEADS_KEY, INBOX_KEY as KEY } from "./fakes";
import { sealer } from "@/lib/leads/lead-crypto";
import { desk } from "./desk-routes";

/* The lead desk's routes under /api/leads: the leads, their invoices, push, and the imports. The gate is
   /api/inbox's (`lib/leads/desk-route.ts`), tested there. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("./fakes")).cloudflareMock(ctx));

let kv: FakeKV;
const seed = async (at: number, id: string, extra: Partial<Parameters<typeof enquiry>[0]> = {}) => {
  const e = enquiry({ type: "portrait", name: `Person ${id}`, email: `${id}@example.com`, detail: "", message: "Hello", ...extra }, at, id);
  const k = enquiryKey(at, id);
  await kv.put(k, JSON.stringify(e), { metadata: summary(e) });
  return k;
};

beforeEach(() => {
  kv = new FakeKV();
  ctx.env = { INBOX: kv, INBOX_KEY: KEY, LEADS_KEY };
});
afterEach(() => vi.unstubAllGlobals());

describe("leads", () => {
  const idOf = async (email: string) => (await sealer(LEADS_KEY)!).id(email);
  const lead = async (email: string, at: string) =>
    recordLead({ INBOX: kv as never, LEADS_KEY }, email, { event: { at, kind: "inquiry", ref: `msg:${email}` }, name: email.split("@")[0] });

  it("lists people newest first, opened from sealed metadata, behind the same gate", async () => {
    await lead("a@example.com", "2026-11-01T10:00:00Z");
    await lead("b@example.com", "2026-11-02T10:00:00Z");
    expect((await desk("GET", "", { key: null })).status).toBe(401);
    const { leads } = await (await desk("GET")).json();
    expect(leads.map((l: { email: string }) => l.email)).toEqual(["b@example.com", "a@example.com"]);
    expect(leads[0].id).toBe(await idOf("b@example.com"));
    expect(leads[0].events).toBeUndefined();
  });

  it("stores nothing readable: no address in the key, value or metadata", async () => {
    await lead("a@example.com", "2026-11-01T10:00:00Z");
    const [[key, entry]] = [...kv.data.entries()].filter(([k]) => k.startsWith("lead:"));
    expect(key).toBe(`lead:${await idOf("a@example.com")}`);
    expect(JSON.stringify(entry)).not.toContain("example.com");
  });

  it("opens one with its timeline, and moves its stage, snooze and seen by hand", async () => {
    await lead("a@example.com", "2026-11-01T10:00:00Z");
    const key = `lead:${await idOf("a@example.com")}`;
    const one = await (await desk("GET", `?id=${key.slice(5)}`)).json();
    expect(one.lead.events).toHaveLength(1);
    const res = await desk("PATCH", "", { body: JSON.stringify({ key, stage: "Quoted", snoozeUntil: "2026-12-01T00:00:00Z", seen: true }) });
    expect((await res.json()).lead).toMatchObject({ stage: "Quoted", snoozeUntil: "2026-12-01T00:00:00Z", unread: false });
    const { leads } = await (await desk("GET")).json();
    expect(leads[0]).toMatchObject({ stage: "Quoted", unread: false });
    // Marked unread again by hand.
    const again = await desk("PATCH", "", { body: JSON.stringify({ key, seen: false }) });
    expect((await again.json()).lead).toMatchObject({ unread: true });
  });

  it("archives, trashes and recovers by hand, and empties only the trash, keeping Inbox rows", async () => {
    await seed(Date.UTC(2026, 9, 1), "row");
    await lead("a@example.com", "2026-11-01T10:00:00Z");
    await lead("b@example.com", "2026-11-02T10:00:00Z");
    const [a, b] = [`lead:${await idOf("a@example.com")}`, `lead:${await idOf("b@example.com")}`];
    const patch = async (key: string, body: object) => (await (await desk("PATCH", "", { body: JSON.stringify({ key, ...body }) })).json()).lead;
    expect(await patch(a, { archive: true })).toHaveProperty("archivedAt");
    expect(await patch(a, { archive: false })).not.toHaveProperty("archivedAt");
    expect(await patch(a, { trash: true })).toHaveProperty("trashedAt");
    const back = await patch(a, { trash: false });
    expect(back).not.toHaveProperty("trashedAt");
    expect(back.events.map((e: { kind: string; note: string }) => `${e.kind} ${e.note}`).slice(-4)).toEqual(["archive in", "archive out", "trash in", "trash out"]);
    await patch(b, { trash: true });
    expect((await desk("DELETE", "", { key: null })).status).toBe(401);
    expect(await (await desk("DELETE")).json()).toEqual({ ok: true, deleted: 1 });
    expect(kv.data.has(a)).toBe(true);
    expect(kv.data.has(b)).toBe(false);
    expect([...kv.data.keys()].some((k) => k.startsWith("msg:"))).toBe(true);
  });

  it("does not bring an emptied lead back on Import from Inbox", async () => {
    await seed(Date.UTC(2026, 9, 1), "spam");
    await seed(Date.UTC(2026, 9, 2), "keep");
    const post = async () => (await desk("POST", "/import/inbox", { body: { dry: false } })).json();
    expect(await post()).toMatchObject({ added: 2 });
    const spam = `lead:${await idOf("spam@example.com")}`;
    await desk("PATCH", "", { body: JSON.stringify({ key: spam, trash: true }) });
    await desk("DELETE");
    expect(kv.data.has(spam)).toBe(false);
    expect(await post()).toMatchObject({ added: 0, updated: 0 });
    expect(kv.data.has(spam)).toBe(false);
    expect([...kv.data.keys()].some((k) => k.startsWith("gone:") && k.includes("@"))).toBe(false);
  });

  it("does not bring back a Gmail lead emptied before ids ignored dots", async () => {
    await seed(Date.UTC(2026, 9, 1), "dot", { email: "Ma.Ya+site@gmail.com" });
    const ids = await (await sealer(LEADS_KEY)!).ids("ma.ya+site@gmail.com");
    expect(ids).toHaveLength(2);
    // The tombstone a purge wrote under the old id.
    await kv.put(`gone:${ids[1]}`, "");
    const post = async () => (await desk("POST", "/import/inbox", { body: { dry: false } })).json();
    expect(await post()).toMatchObject({ added: 0, updated: 0 });
    expect(kv.data.has(`lead:${ids[0]}`)).toBe(false);
  });

  it("does not bring a lead the 30-day sweep removed back on Import from Inbox", async () => {
    await seed(Date.UTC(2026, 9, 1), "old");
    const post = async () => (await desk("POST", "/import/inbox", { body: { dry: false } })).json();
    expect(await post()).toMatchObject({ added: 1 });
    const key = `lead:${await idOf("old@example.com")}`;
    await desk("PATCH", "", { body: JSON.stringify({ key, trash: true }) });
    vi.useFakeTimers({ now: Date.now() + 31 * 864e5, toFake: ["Date"] });
    expect((await (await desk("GET")).json()).leads).toHaveLength(0);
    vi.useRealTimers();
    expect(kv.data.has(key)).toBe(false);
    expect(await post()).toMatchObject({ added: 0, updated: 0 });
    expect(kv.data.has(key)).toBe(false);
  });

  it("deletes a lead 30 days after it went in the trash, when the list is read, keeping Inbox rows", async () => {
    await seed(Date.UTC(2026, 9, 1), "row");
    await lead("a@example.com", "2026-11-01T10:00:00Z");
    await lead("b@example.com", "2026-11-02T10:00:00Z");
    const [a, b] = [`lead:${await idOf("a@example.com")}`, `lead:${await idOf("b@example.com")}`];
    for (const k of [a, b]) await desk("PATCH", "", { body: JSON.stringify({ key: k, trash: true }) });
    vi.useFakeTimers({ now: Date.now() + 29 * 864e5, toFake: ["Date"] });
    expect((await (await desk("GET")).json()).leads).toHaveLength(2);
    await desk("PATCH", "", { body: JSON.stringify({ key: b, trash: false }) });
    vi.setSystemTime(Date.now() + 2 * 864e5);
    const { leads } = await (await desk("GET")).json();
    vi.useRealTimers();
    expect(leads.map((l: { email: string }) => l.email)).toEqual(["b@example.com"]);
    expect(kv.data.has(a)).toBe(false);
    expect([...kv.data.keys()].some((k) => k.startsWith("msg:"))).toBe(true);
  });

  it("backfills the Inbox: counts dry, then writes once, keeps every row, calls nothing outside", async () => {
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    await seed(Date.UTC(2026, 9, 1), "old");
    await seed(Date.UTC(2026, 9, 2), "old", { message: "Again" });
    await seed(Date.UTC(2026, 9, 3), "two");
    await lead("old@example.com", "2026-11-01T10:00:00Z");
    const msgs = [...kv.data.keys()].filter((k) => k.startsWith("msg:")).length;
    const post = async (b: object, key: string | null = KEY) => (await desk("POST", "/import/inbox", { key, body: b })).json();

    expect((await desk("POST", "/import/inbox", { key: null, body: {} })).status).toBe(401);
    expect(await post({ backfill: true, dry: true })).toEqual({ dry: true, people: 2, added: 1, updated: 1, stages: { Inquiry: 1 } });
    expect([...kv.data.keys()].filter((k) => k.startsWith("lead:"))).toHaveLength(1);
    expect(await post({ backfill: true })).toEqual({ dry: true, people: 2, added: 1, updated: 1, stages: { Inquiry: 1 } });
    expect([...kv.data.keys()].filter((k) => k.startsWith("lead:"))).toHaveLength(1);
    expect(await post({ backfill: true, dry: false })).toMatchObject({ added: 1, updated: 1 });
    expect(await post({ backfill: true, dry: false })).toMatchObject({ added: 0, updated: 0 });
    const old = (await (await desk("GET", `?id=${await idOf("old@example.com")}`)).json()).lead;
    expect(old.firstAt).toBe(new Date(Date.UTC(2026, 9, 1)).toISOString());
    expect(old.events).toHaveLength(3);
    expect([...kv.data.keys()].filter((k) => k.startsWith("msg:"))).toHaveLength(msgs);
    expect(fetched).not.toHaveBeenCalled();
  });

  it("imports Stripe only on an explicit dry: false", async () => {
    vi.stubGlobal("fetch", async (input: string) => {
      const list = new URL(input).pathname.endsWith("/payment_intents")
        ? [{ id: "pi_dep000001", status: "succeeded", created: 1_780_000_000, amount: 10000, amount_received: 10000, currency: "usd", receipt_email: "ana@example.com", metadata: { kind: "deposit", email: "ana@example.com", name: "Ana Test" }, latest_charge: null }]
        : [];
      return Response.json({ data: list, has_more: false });
    });
    ctx.env = { ...ctx.env, STRIPE_SECRET_KEY: "sk_test_fake" };
    const before = kv.data.size;
    expect(await (await desk("POST", "/import/stripe", { body: {} })).json()).toMatchObject({ dry: true, payments: 1 });
    expect(kv.data.size).toBe(before);
  });

  it("mirrors a stage to the person's Notion row, then reuses that row", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url.split("/v1")[1]} ${init.body}`);
      return url.endsWith("/query") ? Response.json({ results: [{ id: "row-1" }] }) : Response.json({ id: "row-1" });
    });
    ctx.env = { ...ctx.env, NOTION_TOKEN: "test" };
    await lead("a@example.com", "2026-11-01T10:00:00Z");
    const key = `lead:${await idOf("a@example.com")}`;
    await desk("PATCH", "", { body: JSON.stringify({ key, stage: "Quoted" }) });
    await desk("PATCH", "", { body: JSON.stringify({ key, stage: "Shot" }) });
    expect(calls).toEqual([
      expect.stringMatching(/^POST \/databases\/.+\/query .*a@example\.com/),
      'PATCH /pages/row-1 {"properties":{"Status":{"select":{"name":"Quoted"}}}}',
      'PATCH /pages/row-1 {"properties":{"Status":{"select":{"name":"Editing"}}}}',
    ]);
  });

  it("subscribes a device, pings it when a lead arrives, and forgets it when the push service says it is gone", async () => {
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"])) as CryptoKeyPair;
    const VAPID_KEY = JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey));
    expect((await desk("GET", "/push")).status).toBe(503);
    ctx.env = { ...ctx.env, VAPID_KEY };
    expect((await (await desk("GET", "/push")).json()).key).toMatch(/^[A-Za-z0-9_-]{87}$/);
    expect((await desk("GET", "/push", { key: null })).status).toBe(401);

    const ua = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
    const b64 = (u: ArrayBuffer | Uint8Array) => Buffer.from(u as ArrayBuffer).toString("base64url");
    const sub = { endpoint: "https://web.push.apple.com/dev-1", keys: { p256dh: b64(await crypto.subtle.exportKey("raw", ua.publicKey)), auth: b64(crypto.getRandomValues(new Uint8Array(16))) } };
    const put = (body: object) => desk("PUT", "/push", { body });
    const test = () => desk("POST", "/push");
    expect((await put({ endpoint: "http://nope" })).status).toBe(400);
    expect((await put(sub)).status).toBe(200);
    expect([...kv.data.keys()].filter((k) => k.startsWith("push:"))).toHaveLength(1);

    const sent: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => (sent.push({ url, init }), new Response(null, { status: 201 })));
    await recordLead({ INBOX: kv as never, LEADS_KEY, VAPID_KEY }, "maya@example.com", { event: { at: "2026-11-04T10:00:00Z", kind: "inquiry", ref: "msg:p1" }, name: "Maya" });
    await recordLead({ INBOX: kv as never, LEADS_KEY, VAPID_KEY }, "maya@example.com", { event: { at: "2026-11-04T10:01:00Z", kind: "mail", note: "x" } });
    expect(sent.map((x) => x.url)).toEqual(["https://web.push.apple.com/dev-1"]);
    expect(sent[0].init.headers).toMatchObject({ "content-encoding": "aes128gcm" });
    expect(await (await test()).json()).toEqual({ devices: 1 });
    expect(sent).toHaveLength(2);

    vi.stubGlobal("fetch", async () => new Response(null, { status: 410 }));
    await recordLead({ INBOX: kv as never, LEADS_KEY, VAPID_KEY }, "noor@example.com", { event: { at: "2026-11-04T11:00:00Z", kind: "booking", ref: "cal-9" }, name: "Noor" });
    expect([...kv.data.keys()].filter((k) => k.startsWith("push:"))).toHaveLength(0);

    await put(sub);
    expect((await desk("DELETE", "/push", { body: { endpoint: sub.endpoint } })).status).toBe(200);
    expect([...kv.data.keys()].filter((k) => k.startsWith("push:"))).toHaveLength(0);
    expect(await (await test()).json()).toEqual({ devices: 0 });
    expect((await desk("POST", "/push", { key: "wrong" })).status).toBe(401);
  });

  it("refuses an unknown stage, a bad time and a missing lead, and says when LEADS_KEY is unset", async () => {
    await lead("a@example.com", "2026-11-01T10:00:00Z");
    const key = `lead:${await idOf("a@example.com")}`;
    const patch = (b: object) => desk("PATCH", "", { body: JSON.stringify({ key, ...b }) });
    expect((await patch({ stage: "Won" })).status).toBe(400);
    expect((await patch({ snoozeUntil: "soon" })).status).toBe(400);
    expect((await desk("PATCH", "", { body: JSON.stringify({ key: "lead:0000", seen: true }) })).status).toBe(404);
    ctx.env = { INBOX: kv, INBOX_KEY: KEY };
    expect((await desk("GET")).status).toBe(503);
  });
});

describe("invoices", () => {
  const make = async (email: string) => {
    await recordLead({ INBOX: kv as never, LEADS_KEY }, email, { event: { at: "2026-11-01T10:00:00Z", kind: "inquiry", ref: `msg:${email}` }, name: "Maya Ortiz" });
    return `lead:${await (await sealer(LEADS_KEY)!).id(email)}`;
  };
  const bill = (key: string, date = "2026-11-06") =>
    desk("PATCH", "", { body: JSON.stringify({ key, invoice: { date, lines: [{ desc: "Portraits, Nov 19", qty: 1, rate: 450 }], paid: 100 } }) });

  it("numbers MMYY, then 1126-2 for a second one that month on any lead, and logs it", async () => {
    const a = await make("a@example.com"), b = await make("b@example.com");
    expect((await (await desk("GET", "/invoice-from?no=2026-11-06")).json()).no).toBe("1126");
    const one = (await (await bill(a)).json()).lead;
    expect(one.invoices[0]).toMatchObject({ no: "1126", paid: 100, date: "2026-11-06" });
    expect(one.events.at(-1)).toMatchObject({ kind: "invoice", note: "1126, $350.00 due" });
    expect((await (await bill(b)).json()).lead.invoices[0].no).toBe("1126-2");
    expect((await (await bill(b, "2026-12-01")).json()).lead.invoices[1].no).toBe("1226");
    // The list's sealed summary stays small: no invoices in it.
    const { leads } = await (await desk("GET")).json();
    expect(leads[0].invoices).toBeUndefined();
  });

  it("/invoices lists every invoice with its lead's id and name, newest first, behind the gate", async () => {
    const a = await make("a@example.com"), b = await make("b@example.com");
    await bill(a);
    await bill(b, "2026-12-01");
    const { invoices } = await (await desk("GET", "/invoices")).json();
    expect(invoices.map((i: { no: string; lead: string; name: string; paid: number }) => [i.no, `lead:${i.lead}`, i.name, i.paid])).toEqual([["1226", b, "Maya Ortiz", 100], ["1126", a, "Maya Ortiz", 100]]);
    // A trashed lead's invoices leave the list.
    await desk("PATCH", "", { body: JSON.stringify({ key: b, trash: true }) });
    expect((await (await desk("GET", "/invoices")).json()).invoices).toHaveLength(1);
    expect((await desk("GET", "/invoices", { key: null })).status).toBe(401);
  });

  it("a patch that 404s writes nothing first: no Notion mirror, no invoice number used", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => (calls.push(url), Response.json({ results: [], id: "row-1" })));
    ctx.env = { ...ctx.env, NOTION_TOKEN: "test" };
    const a = await make("a@example.com");
    const gone = await desk("PATCH", "", { body: JSON.stringify({ key: a, stage: "Quoted", mergeFrom: "lead:nobody" }) });
    expect(gone.status).toBe(404);
    const unknown = { date: "2026-11-06", lines: [{ desc: "Portraits", qty: 1, rate: 450 }] };
    const none = await desk("PATCH", "", { body: JSON.stringify({ key: a, stage: "Quoted", invoice: unknown, invoicePaid: { no: "0999", paid: true } }) });
    expect(none.status).toBe(404);
    expect(calls).toEqual([]);
    expect((await (await desk("GET", "/invoice-from?no=2026-11-06")).json()).no).toBe("1126");
  });

  it("refuses a bad invoice and stays behind the gate", async () => {
    const a = await make("a@example.com");
    const bad = await desk("PATCH", "", { body: JSON.stringify({ key: a, invoice: { date: "2026-11-06", lines: [] } }) });
    expect(bad.status).toBe(400);
    expect((await desk("PATCH", "", { key: null, body: JSON.stringify({ key: a, invoice: {} }) })).status).toBe(401);
    expect([...kv.data.keys()].some((k) => k.startsWith("invoices:"))).toBe(false);
  });

  it("keeps his details sealed: nothing readable in KV", async () => {
    const from = { name: "JULIAN GIGOLA", ein: "EIN 00-0000000", a3: "San Jose, CA" };
    expect((await desk("PUT", "/invoice-from", { body: { from } })).status).toBe(200);
    expect(JSON.stringify([...kv.data.values()])).not.toContain("00-0000000");
    const got = await (await desk("GET", "/invoice-from")).json();
    expect(got.from).toMatchObject(from);
  });
});
