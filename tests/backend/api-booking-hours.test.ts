import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/booking/hours/route";
import { BookingLock } from "@/worker/booking-lock";
import { FakeStore, fakeLock, githubToken, reply } from "./fakes";

/* /api/booking/hours: the inbox key or a GitHub token that can push opens
   it; a malformed week is refused; a good one is read back. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const OAUTH = JSON.stringify({ client_id: "a", client_secret: "b", refresh_token: "c" });
const KEY = "inbox-key-for-tests";
const req = (method: string, body?: unknown, headers: Record<string, string> = { "x-inbox-key": KEY }) =>
  new Request("https://juliangigola.com/api/booking/hours", { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => {
  ctx.env = { GCAL_OAUTH: OAUTH, INBOX_KEY: KEY, BOOKING_LOCK: fakeLock(new BookingLock({ storage: new FakeStore() }, { GCAL_OAUTH: OAUTH })) };
});
afterEach(() => vi.unstubAllGlobals());

describe("/api/booking/hours", () => {
  it("refuses no credential, a wrong key, and a token that cannot push", async () => {
    expect((await GET(req("GET", undefined, {}))).status).toBe(401);
    expect((await GET(req("GET", undefined, { "x-inbox-key": "wrong" }))).status).toBe(401);
    vi.stubGlobal("fetch", vi.fn(async () => reply({ permissions: { push: false } })));
    expect((await PUT(req("PUT", { week: [] }, { authorization: `Bearer ${githubToken()}` }))).status).toBe(401);
  });

  it("refuses hours that do not read right", async () => {
    expect((await PUT(req("PUT", { week: [] }))).status).toBe(400);
    expect((await PUT(req("PUT", "nope"))).status).toBe(400);
  });

  it("sets a week and reads it back", async () => {
    const week = [[600, 1140], null, null, [600, 1140], [600, 1140], [600, 1140], [480, 600]];
    const res = await PUT(req("PUT", { week, days: {} }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await (await GET(req("GET"))).json()).hours.week).toEqual(week);
  });
});
