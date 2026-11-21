import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crc32 } from "@/lib/proofs/zip";

/* `lib/proofs/delivery.ts`: a final streams into R2 with its byte count
   and CRC taken on the way; its web copies are made after, and a failure
   there drops the copies instead of keeping an old edit's. */

const serve = vi.hoisted(() => ({ previews: vi.fn(), openDeliveryIn: vi.fn(), servedPreview: vi.fn() }));
vi.mock("@/lib/proofs/delivery-serve", () => serve);
const ctx = vi.hoisted(() => ({ env: { PROOFS: "r2" }, ctx: { waitUntil: () => {} } }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ctx }));
const { storeFinal, openDelivery } = await import("@/lib/proofs/delivery");

// Workers' FixedLengthStream: a pass-through that must see exactly `length` bytes.
class FixedLengthStream extends TransformStream<Uint8Array, Uint8Array> {
  constructor(public length: number) {
    super();
  }
}
beforeEach(() => {
  vi.stubGlobal("FixedLengthStream", FixedLengthStream);
  serve.previews.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());

const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])];
const body = () => new ReadableStream<Uint8Array>({ start(c) { for (const x of chunks) c.enqueue(x); c.close(); } });
const r2 = () => {
  const got: { key: string; bytes: number[]; type?: string }[] = [];
  return {
    got,
    put: vi.fn(async (key: string, stream: ReadableStream<Uint8Array>, opts: { httpMetadata: { contentType: string } }) => {
      const bytes: number[] = [];
      for await (const c of stream as unknown as AsyncIterable<Uint8Array>) bytes.push(...c);
      got.push({ key, bytes, type: opts.httpMetadata.contentType });
    }),
    delete: vi.fn(async () => undefined),
  };
};

describe("storeFinal", () => {
  it("streams the final into its key as a JPEG and counts its bytes and CRC", async () => {
    const PROOFS = r2();
    const out = await storeFinal({ PROOFS } as never, "tok", "f1", body(), 5);
    expect(PROOFS.got).toEqual([{ key: "delivery/tok/f1.jpg", bytes: [1, 2, 3, 4, 5], type: "image/jpeg" }]);
    expect(out).toEqual({ bytes: 5, crc: crc32(new Uint8Array([1, 2, 3, 4, 5])) });
    expect(serve.previews).toHaveBeenCalledWith({ PROOFS }, "tok", "f1");
    expect(PROOFS.delete).not.toHaveBeenCalled();
  });

  it("drops the web copies when they cannot be made, and still returns the final", async () => {
    const PROOFS = r2();
    serve.previews.mockRejectedValueOnce(new Error("Images down"));
    expect((await storeFinal({ PROOFS } as never, "tok", "f1", body(), 5)).bytes).toBe(5);
    expect(PROOFS.delete).toHaveBeenCalledWith(["delivery/tok/f1.w2000.jpg", "delivery/tok/f1.w800.jpg"]);
  });
});

describe("openDelivery", () => {
  it("opens with the request's bindings and passes the cookie on", async () => {
    serve.openDeliveryIn.mockResolvedValueOnce({ p: { token: "tok" } }).mockResolvedValueOnce(null);
    expect(await openDelivery("id1", "pass=x")).toEqual({ env: ctx.env, ctx: ctx.ctx, p: { token: "tok" } });
    expect(serve.openDeliveryIn).toHaveBeenCalledWith(ctx.env, "id1", "pass=x");
    expect(await openDelivery("id2", null)).toBeNull();
  });
});
