import { beforeEach, describe, expect, it, vi } from "vitest";

/* The /delivery/<id> file routes under `next dev` (on Cloudflare `worker.ts`
   answers /dl, /web and /zip first): each hands the request, the bindings
   and its ids to `lib/proofs/delivery-serve.ts`, and /f serves a final's
   web copy only from an open delivery. */

const ENV = { PROOFS: "r2", IMAGES: "img" };
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ENV }) }));
const serve = vi.hoisted(() => ({
  zipResponse: vi.fn(async () => new Response("zip")),
  webResponse: vi.fn(async () => new Response("web")),
  finalResponse: vi.fn(async () => new Response("dl")),
  finalOf: (p: { finals?: { id: string }[] }, id: string) => p.finals?.find((f) => f.id === id),
  servedPreview: vi.fn(),
}));
vi.mock("@/lib/proofs/delivery-serve", () => serve);
const delivery = vi.hoisted(() => ({ openDelivery: vi.fn() }));
vi.mock("@/lib/proofs/delivery", () => delivery);

const { GET: zip } = await import("@/app/delivery/[id]/zip/route");
const { GET: web } = await import("@/app/delivery/[id]/web/[fid]/route");
const { GET: dl } = await import("@/app/delivery/[id]/dl/[fid]/route");
const { GET: preview } = await import("@/app/delivery/[id]/f/[fid]/route");

const ID = "11082026-k7m2q9xd";
const req = (path: string, cookie?: string) =>
  new Request(`https://juliangigola.com/delivery/${ID}${path}`, { headers: cookie ? { cookie } : {} });
const g = { env: ENV, p: { token: "tok", finals: [{ id: "f1" }] } };

beforeEach(() => {
  delivery.openDelivery.mockReset().mockResolvedValue(g);
  serve.servedPreview.mockReset().mockResolvedValue({ body: "jpeg", httpEtag: '"p1"' });
});

describe("/delivery/[id] downloads", () => {
  it("hands zip, web and dl to delivery-serve with the bindings and ids", async () => {
    const r = req("/zip");
    expect(await (await zip(r, { params: Promise.resolve({ id: ID }) })).text()).toBe("zip");
    expect(serve.zipResponse).toHaveBeenCalledWith(r, ENV, ID);
    await web(r, { params: Promise.resolve({ id: ID, fid: "f1" }) });
    expect(serve.webResponse).toHaveBeenCalledWith(r, ENV, ID, "f1");
    await dl(r, { params: Promise.resolve({ id: ID, fid: "f1" }) });
    expect(serve.finalResponse).toHaveBeenCalledWith(r, ENV, ID, "f1");
  });
});

describe("/delivery/[id]/f/[fid]", () => {
  const get = (fid: string, query = "", cookie?: string) =>
    preview(req(`/f/${fid}${query}`, cookie), { params: Promise.resolve({ id: ID, fid }) });

  it("serves the 2000px copy, or 800px for ?w=800, with the gate's cookie passed on", async () => {
    const res = await get("f1", "", "pass=1");
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe('"p1"');
    expect(res.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(delivery.openDelivery).toHaveBeenCalledWith(ID, "pass=1");
    await get("f1", "?w=800");
    expect(serve.servedPreview.mock.calls.map((c) => c[3])).toEqual([false, true]);
    expect(serve.servedPreview.mock.calls[0].slice(0, 3)).toEqual([ENV, "tok", "f1"]);
  });

  it("is a 404 for a bad id without opening the delivery, a closed delivery or an unknown final", async () => {
    expect((await get("a/b")).status).toBe(404);
    expect(delivery.openDelivery).not.toHaveBeenCalled();
    expect((await get("nope")).status).toBe(404);
    delivery.openDelivery.mockResolvedValueOnce(null);
    expect((await get("f1")).status).toBe(404);
  });

  it("is a 503 to retry when the copy cannot be made, and a 404 when it is gone", async () => {
    serve.servedPreview.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(null);
    expect((await get("f1")).status).toBe(503);
    expect((await get("f1")).status).toBe(404);
  });
});
