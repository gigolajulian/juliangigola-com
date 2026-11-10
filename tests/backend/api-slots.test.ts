import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/slots/route";
import { forgetToken } from "@/lib/booking/gcal";

/* /api/slots: public. Off without GCAL_OAUTH, refuses an unknown session,
   a bad range and an unknown zone, and answers in Cal.com's shape. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const get = (q: string) => GET(new Request(`https://juliangigola.com/api/slots?${q}`));
const OK = "slug=portraits&start=2026-11-18&end=2026-11-18&timeZone=America/Los_Angeles";

beforeEach(() => {
  forgetToken();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.parse("2026-11-11T18:00:00Z"));
  ctx.env = { GCAL_OAUTH: JSON.stringify({ client_id: "a", client_secret: "b", refresh_token: "c" }) };
  vi.stubGlobal("fetch", async (url: string) =>
    url.includes("oauth2") ? Response.json({ access_token: "t", expires_in: 3600 }) : url.includes("/events?") ? Response.json({ items: [] }) : Response.json({ calendars: { primary: { busy: [] } } }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("GET /api/slots", () => {
  it("is off without GCAL_OAUTH", async () => {
    ctx.env = {};
    expect((await get(OK)).status).toBe(503);
  });

  it("refuses an unknown session, a bad range and an unknown zone", async () => {
    expect((await get("slug=nope&start=2026-11-18&end=2026-11-18")).status).toBe(400);
    expect((await get("slug=portraits&start=tomorrow&end=2026-11-18")).status).toBe(400);
    expect((await get("slug=portraits&start=2026-11-18&end=2026-11-18&timeZone=Mars/Base")).status).toBe(400);
  });

  it("answers a Wednesday's open starts in the visitor's zone", async () => {
    const res = await get(OK);
    expect(res.status).toBe(200);
    const o = await res.json();
    expect(o.status).toBe("success");
    expect(o.event).toMatchObject({ lengthInMinutes: expect.any(Number) });
    expect(o.data["2026-11-18"][0].start.slice(11, 16)).toBe("10:00");
  });
});
