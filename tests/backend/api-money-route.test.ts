import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/money/route";

/* /api/money: Stripe balance and transactions behind the inbox gate. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

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
