import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/calendar/route";
import { forgetToken } from "@/lib/booking/gcal";
import { FakeKV } from "./fakes";

/* /api/calendar: the Leads app's calendar. Off without INBOX or GCAL_OAUTH,
   behind the inbox key, refuses a bad range or block, lists and blocks. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const OAUTH = JSON.stringify({ client_id: "a", client_secret: "b", refresh_token: "c" });
const KEY = "inbox-key-for-tests";
const req = (method: string, { body, query = "", key = KEY }: { body?: unknown; query?: string; key?: string } = {}) =>
  new Request(`https://juliangigola.com/api/calendar${query}`, { method, headers: { "x-inbox-key": key }, body: body === undefined ? undefined : JSON.stringify(body) });

let posted: unknown[];
beforeEach(() => {
  forgetToken();
  posted = [];
  ctx.env = { INBOX: new FakeKV(), INBOX_KEY: KEY, GCAL_OAUTH: OAUTH };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 3600 });
    if (url.includes("/freeBusy")) return Response.json({ calendars: { primary: { busy: [] } } });
    if (init?.method === "POST") {
      posted.push(JSON.parse(String(init.body)));
      return Response.json({ id: "new1" });
    }
    return Response.json({ items: [{ id: "e1", summary: "Shoot", start: { dateTime: "2026-12-02T18:00:00Z" }, end: { dateTime: "2026-12-02T19:00:00Z" } }] });
  });
});

describe("/api/calendar", () => {
  it("is off without INBOX or GCAL_OAUTH", async () => {
    ctx.env = { INBOX_KEY: KEY, GCAL_OAUTH: OAUTH };
    expect((await GET(req("GET", { query: "?from=2026-12-01&to=2026-12-07" }))).status).toBe(503);
    ctx.env = { INBOX: new FakeKV(), INBOX_KEY: KEY };
    expect((await GET(req("GET", { query: "?from=2026-12-01&to=2026-12-07" }))).status).toBe(503);
  });

  it("refuses a wrong key", async () => {
    expect((await GET(req("GET", { query: "?from=2026-12-01&to=2026-12-07", key: "wrong" }))).status).toBe(401);
    expect((await POST(req("POST", { body: { block: { from: "2026-12-01" } }, key: "wrong" }))).status).toBe(401);
    expect(posted).toEqual([]);
  });

  it("refuses a bad range, a bad block and an empty body", async () => {
    expect((await GET(req("GET", { query: "?from=2026-12-07&to=2026-12-01" }))).status).toBe(400);
    expect((await POST(req("POST", { body: { block: { from: "tomorrow" } } }))).status).toBe(400);
    expect((await POST(req("POST", { body: { block: { from: "2026-12-01", start: "14:00", end: "13:00" } } }))).status).toBe(400);
    expect((await POST(req("POST", { body: {} }))).status).toBe(400);
    expect(posted).toEqual([]);
  });

  it("lists the week's events and blocks a day", async () => {
    const res = await GET(req("GET", { query: "?from=2026-12-01&to=2026-12-07" }));
    expect(res.status).toBe(200);
    expect((await res.json()).events).toEqual([expect.objectContaining({ id: "e1", title: "Shoot", allDay: false })]);
    const b = await POST(req("POST", { body: { block: { from: "2026-12-05", note: "Away" } } }));
    expect(await b.json()).toEqual({ ok: true, id: "new1" });
    expect(posted[0]).toMatchObject({ summary: "Blocked: Away", start: { date: "2026-12-05" }, end: { date: "2026-12-06" } });
  });
});
