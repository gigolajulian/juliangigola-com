import { afterEach, describe, expect, it, vi } from "vitest";

/* The site Worker's entry (`worker.ts`): delivery downloads are answered by
   delivery-serve before OpenNext, everything else falls through. And
   /api/build, the commit stamp live-check reads. */

const fx = vi.hoisted(() => ({
  openNext: vi.fn(async () => new Response("next")),
  deliveryDownload: vi.fn((): Promise<Response> | null => null),
}));
// The generated worker exists only after `opennextjs-cloudflare build`; unresolved, it is matched by the raw id worker.ts uses.
vi.mock("./.open-next/worker.js", () => ({
  default: { fetch: fx.openNext },
  DOQueueHandler: class {},
  DOShardedTagCache: class {},
  BucketCachePurge: class {},
}));
vi.mock("@/lib/proofs/delivery-serve", () => ({ deliveryDownload: fx.deliveryDownload }));

const { default: site } = await import("../../worker");
const { GET: build } = await import("@/app/api/build/route");

const ENV = { PROOFS: {} } as unknown as CloudflareEnv;

afterEach(() => {
  fx.openNext.mockClear();
  fx.deliveryDownload.mockReset().mockReturnValue(null);
  vi.unstubAllEnvs();
});

describe("worker.ts fetch", () => {
  it("answers a delivery download itself and never reaches OpenNext", async () => {
    fx.deliveryDownload.mockReturnValue(Promise.resolve(new Response("zip", { status: 200 })));
    const req = new Request("https://juliangigola.com/delivery/11082026-k7m2q9xd/zip");
    const res = await site.fetch(req, ENV, {});
    expect(await res.text()).toBe("zip");
    expect(fx.deliveryDownload).toHaveBeenCalledWith(req, ENV);
    expect(fx.openNext).not.toHaveBeenCalled();
  });

  it("keeps a delivery 404 instead of falling through", async () => {
    fx.deliveryDownload.mockReturnValue(Promise.resolve(new Response(null, { status: 404 })));
    const res = await site.fetch(new Request("https://juliangigola.com/delivery/bad/zip"), ENV, {});
    expect(res.status).toBe(404);
    expect(fx.openNext).not.toHaveBeenCalled();
  });

  it("hands every other request to OpenNext with the same env and ctx", async () => {
    const req = new Request("https://juliangigola.com/portfolio");
    const ctx = { waitUntil: vi.fn() };
    const res = await site.fetch(req, ENV, ctx);
    expect(await res.text()).toBe("next");
    expect(fx.openNext).toHaveBeenCalledWith(req, ENV, ctx);
  });
});

describe("GET /api/build", () => {
  it("answers the baked-in commit", async () => {
    vi.stubEnv("BUILD_SHA", "abc1234");
    const res = build();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sha: "abc1234" });
  });

  it("says local when no commit was baked in", async () => {
    vi.stubEnv("BUILD_SHA", undefined);
    expect(await build().json()).toEqual({ sha: "local" });
  });
});
