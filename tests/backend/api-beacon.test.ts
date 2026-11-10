import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/beacon/route";

/* /api/beacon: public, always 204. A good page view lands in Analytics
   Engine; junk, an oversize body or a refused path writes nothing. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const post = (body: string) => POST(new Request("https://juliangigola.com/api/beacon", { method: "POST", body }));
const ok = { p: "/portfolio", v: true, d: 0.4, dev: "phone", c: [[0.5, 0.5, "See the work"]] };

describe("POST /api/beacon", () => {
  it("writes the view and each click", async () => {
    const writeDataPoint = vi.fn();
    ctx.env = { BEACON: { writeDataPoint } };
    const res = await post(JSON.stringify(ok));
    expect(res.status).toBe(204);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(writeDataPoint).toHaveBeenCalledTimes(2);
    expect(writeDataPoint.mock.calls[1][0].blobs).toEqual(["/portfolio", "click", "See the work", "phone"]);
  });

  it("answers 204 and writes nothing for junk, an oversize body or a refused path", async () => {
    const writeDataPoint = vi.fn();
    ctx.env = { BEACON: { writeDataPoint } };
    for (const body of ["not json", "x".repeat(8_001), JSON.stringify({ ...ok, p: "/admin" })]) expect((await post(body)).status).toBe(204);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("answers 204 without the BEACON binding", async () => {
    ctx.env = {};
    expect((await post(JSON.stringify(ok))).status).toBe(204);
  });
});
