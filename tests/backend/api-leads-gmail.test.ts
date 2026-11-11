import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/leads/gmail/route";
import { forgetToken } from "@/lib/booking/gcal";
import { CURSOR } from "@/lib/gmail-sync";
import { FakeKV, LEADS_KEY } from "./fakes";

/* /api/leads/gmail: the booking Worker's cron, BOOKING_SECRET as bearer.
   The first run only records where Gmail's history stands. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const SECRET = "booking-secret-for-tests";
const OAUTH = JSON.stringify({ client_id: "c", client_secret: "s", refresh_token: "r" });
const call = (auth?: string) => POST(new Request("https://juliangigola.com/api/leads/gmail", { method: "POST", headers: auth ? { authorization: auth } : {} }));

let kv: FakeKV;
beforeEach(() => {
  forgetToken();
  kv = new FakeKV();
  ctx.env = { INBOX: kv, LEADS_KEY, BOOKING_SECRET: SECRET, GCAL_OAUTH: OAUTH };
  vi.stubGlobal("fetch", async (url: string) =>
    url.includes("oauth2") ? Response.json({ access_token: "t", expires_in: 3600 }) : url.endsWith("/profile") ? Response.json({ historyId: "4242" }) : Response.json({}, { status: 404 }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/leads/gmail", () => {
  it("refuses no bearer, a wrong one, and every call while the secret is unset", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    ctx.env = { ...ctx.env, BOOKING_SECRET: undefined };
    expect((await call(`Bearer ${SECRET}`)).status).toBe(401);
    expect(kv.puts).toEqual([]);
  });

  it("is off without GCAL_OAUTH", async () => {
    ctx.env = { ...ctx.env, GCAL_OAUTH: undefined };
    expect((await call(`Bearer ${SECRET}`)).status).toBe(503);
  });

  it("starts the history cursor on its first run", async () => {
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ folded: 0 });
    expect(await kv.get(CURSOR)).toBe("4242");
  });
});
