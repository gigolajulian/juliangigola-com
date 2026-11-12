import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* /api/money: his Stripe balance and transactions, read-only, behind the inbox gate. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));
const { GET } = await import("@/app/api/money/route");

const KEY = "inbox-key-for-tests";
const req = (query = "", key: string | null = KEY) => new Request(`https://juliangigola.com/api/money${query}`, { headers: key ? { "x-inbox-key": key } : {} });
const calls: string[] = [];

beforeEach(() => {
  ctx.env = { INBOX: {}, INBOX_KEY: KEY, STRIPE_SECRET_KEY: "sk_test_abc" };
  calls.length = 0;
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method} ${url}`);
    if (url.endsWith("/balance")) return Response.json({ available: [{ amount: 35000, currency: "usd" }], pending: [{ amount: 10000, currency: "usd" }] });
    return Response.json({
      has_more: true,
      data: [{ id: "txn_1234567890", created: 1793900000, type: "charge", amount: 10000, fee: 320, net: 9680, currency: "usd", status: "available", source: { billing_details: { name: "Maya Ortiz" } } }],
    });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("GET /api/money", () => {
  it("returns the balance and a page of transactions, with who paid, and only GETs Stripe", async () => {
    const o = await (await GET(req())).json();
    expect(o).toMatchObject({ available: 35000, pending: 10000, test: true, more: true });
    expect(o.txns[0]).toMatchObject({ id: "txn_1234567890", net: 9680, what: "Maya Ortiz", type: "charge" });
    expect(calls.every((c) => c.startsWith("GET "))).toBe(true);
  });
  it("pages on with a checked cursor and skips the balance", async () => {
    const o = await (await GET(req("?after=txn_1234567890"))).json();
    expect(o.available).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("starting_after=txn_1234567890");
    expect((await GET(req("?after=../x"))).status).toBe(400);
  });
  it("is behind the gate, says when Stripe is off, and hides Stripe's errors", async () => {
    expect((await GET(req("", null))).status).toBe(401);
    ctx.env = { ...ctx.env, STRIPE_SECRET_KEY: undefined };
    expect((await GET(req())).status).toBe(503);
    ctx.env = { ...ctx.env, STRIPE_SECRET_KEY: "sk_test_abc" };
    vi.stubGlobal("fetch", async () => Response.json({ error: { message: "key sk_test_abc bad" } }, { status: 401 }));
    const res = await GET(req());
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("sk_test");
  });
});

describe("/api/money: the gate and the cursor", () => {
  const KEY = "inbox-key-for-tests";
  const get = (query = "", key: string | null = KEY) => GET(new Request(`https://juliangigola.com/api/money${query}`, { headers: key ? { "x-inbox-key": key } : {} }));

  let calls: string[];
  beforeEach(() => {
    calls = [];
    ctx.env = { INBOX: {}, INBOX_KEY: KEY, STRIPE_SECRET_KEY: "sk_test_abc" };
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url);
      if (url.endsWith("/balance")) return Response.json({ available: [{ amount: 500, currency: "usd" }], pending: [] });
      return Response.json({ has_more: false, data: [] });
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  describe("GET /api/money", () => {
    it("refuses no key and a wrong one, and asks Stripe nothing", async () => {
      expect((await get("", null)).status).toBe(401);
      expect((await get("", "wrong")).status).toBe(401);
      expect(calls).toEqual([]);
    });

    it("refuses a cursor that is not a transaction id", async () => {
      expect((await get("?after=txn_../../x")).status).toBe(400);
      expect(calls).toEqual([]);
    });

    it("answers the balance and the first page", async () => {
      const res = await get();
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ available: 500, pending: 0, txns: [], more: false });
    });
  });
});
