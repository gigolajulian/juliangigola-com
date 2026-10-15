import { afterEach, describe, expect, it, vi } from "vitest";
import { githubToken, reply } from "./fakes";
import { parseBeacon } from "@/lib/beacon";

/* /api/seo (behind the GitHub gate, like /api/traffic) and the public
   click-and-scroll beacon that feeds its map. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/seo", async () => {
  const { GET } = await import("@/app/api/seo/route");
  const get = (q = "", token?: string) =>
    GET(new Request(`https://juliangigola.com/api/seo${q}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }));

  it("refuses without a token that can push", async () => {
    expect((await get()).status).toBe(401);
    vi.stubGlobal("fetch", vi.fn(async () => reply({ permissions: { push: false } })));
    expect((await get("", githubToken())).status).toBe(401);
  });

  it("answers 503 without CF_ANALYTICS_TOKEN, and refuses a map path that is not a page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply({ permissions: { push: true } })));
    ctx.env = {};
    expect((await get("", githubToken())).status).toBe(503);
    ctx.env = { CF_ANALYTICS_TOKEN: "k" };
    expect((await get("?map=/x' OR 1=1", githubToken())).status).toBe(400);
  });
});

describe("the beacon", async () => {
  const { POST } = await import("@/app/api/beacon/route");
  const ok = { p: "/#sessions", v: true, d: 0.5, dev: "desktop", c: [[0.4, 0.6, "Book a session"]] };

  it("takes a well-formed page view and nothing else", () => {
    expect(parseBeacon(ok)).toEqual(ok);
    expect(parseBeacon({ ...ok, p: "/admin" })).toBeNull();
    expect(parseBeacon({ ...ok, p: "/a' --" })).toBeNull();
    expect(parseBeacon({ ...ok, d: 2 })).toBeNull();
    expect(parseBeacon({ ...ok, c: Array(51).fill([0, 0, ""]) })).toBeNull();
    expect(parseBeacon({ ...ok, c: [[5, 0, "off screen"]] })!.c).toEqual([]);
  });

  it("writes one view and one point per press, and the view once per page view", async () => {
    const writeDataPoint = vi.fn();
    ctx.env = { BEACON: { writeDataPoint } };
    const post = (b: unknown) => POST(new Request("https://juliangigola.com/api/beacon", { method: "POST", body: JSON.stringify(b) }));
    expect((await post(ok)).status).toBe(204);
    expect(writeDataPoint.mock.calls.map(([d]) => d.blobs[1])).toEqual(["view", "click"]);
    writeDataPoint.mockClear();
    await post({ ...ok, v: false });
    expect(writeDataPoint.mock.calls.map(([d]) => d.blobs[1])).toEqual(["click"]);
    writeDataPoint.mockClear();
    expect((await post("junk")).status).toBe(204);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });
});
