import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/slots/route";
import { forgetToken } from "@/lib/google";

/* /api/slots: public. Off without GCAL_OAUTH, refuses an unknown session,
   a bad range and an unknown zone, and answers slots by day. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("../fakes")).cloudflareMock(ctx));

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
    expect(o).toMatchObject({ length: expect.any(Number) });
    expect(o.slots["2026-11-18"][0].slice(11, 16)).toBe("10:00");
  });

  it("keeps an answer a minute in the colo's cache, and asks Google again on &fresh", async () => {
    const kept = new Map<string, Response>();
    vi.stubGlobal("caches", {
      default: {
        match: async (r: Request) => kept.get(r.url)?.clone(),
        put: async (r: Request, res: Response) => void kept.set(r.url, res),
      },
    });
    let asks = 0;
    const real = globalThis.fetch;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => (url.includes("freeBusy") && asks++, real(url, init)));
    const a = await (await get(OK)).json();
    const before = asks;
    expect(before).toBeGreaterThan(0);
    expect(await (await get(OK)).json()).toEqual(a);
    expect(asks).toBe(before);
    await get(`${OK}&fresh`);
    expect(asks).toBeGreaterThan(before);
  });
});
