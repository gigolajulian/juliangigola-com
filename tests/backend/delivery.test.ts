import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Relative imports: the coverage scanner resolves `@/` under src/, which this repo does not have.
import { openDelivery, storeFinal } from "../../lib/proofs/delivery";
import { crc32 } from "../../lib/proofs/zip";
import { sealer } from "../../lib/leads/lead-crypto";
import { finalKey, PREVIEW_W, THUMB_W, writeProof, type Proof } from "../../lib/proofs/proof";
import { FakeKV, LEADS_KEY } from "./fakes";

/* lib/proofs/delivery: a final streamed into R2 with its byte count and
   CRC, its web copies made after, dropped when Images fails; and
   openDelivery reading the request's bindings. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("./fakes")).cloudflareMock(ctx, () => {}));

// The Workers runtime's FixedLengthStream: a pass-through here, its length checked.
class FixedLengthStream extends TransformStream<Uint8Array, Uint8Array> {
  constructor(readonly length: number) {
    super();
  }
}
beforeEach(() => vi.stubGlobal("FixedLengthStream", FixedLengthStream));
afterEach(() => vi.unstubAllGlobals());

const TOKEN = "11152026-k7m2q9xd";
const bytesOf = (...chunks: number[][]) =>
  new ReadableStream<Uint8Array>({ start(c) { for (const ch of chunks) c.enqueue(new Uint8Array(ch)); c.close(); } });

/** An R2 bucket that reads every streamed body to the end, as R2 would. */
function bucket() {
  const kept = new Map<string, Uint8Array<ArrayBuffer>>();
  return {
    kept,
    deleted: [] as string[][],
    async put(key: string, body: ReadableStream<Uint8Array> | ArrayBuffer) {
      kept.set(key, new Uint8Array(body instanceof ArrayBuffer ? body : await new Response(body).arrayBuffer()));
    },
    async get(key: string) {
      const b = kept.get(key);
      return b ? { body: new Response(b).body } : null;
    },
    async delete(keys: string[]) {
      this.deleted.push(keys);
    },
  };
}
const images = (fail = false) => ({
  input: () => ({
    transform: () => ({
      output: async () => {
        if (fail) throw new Error("Images is down");
        return { response: () => new Response(new Uint8Array([9, 9])) };
      },
    }),
  }),
});

describe("storeFinal", () => {
  it("streams the file into R2, counts its bytes and CRC, and makes both web copies", async () => {
    const PROOFS = bucket();
    const out = await storeFinal({ PROOFS, IMAGES: images() } as never, TOKEN, "a", bytesOf([1, 2, 3], [4, 5]), 5);
    expect(out).toEqual({ bytes: 5, crc: crc32(new Uint8Array([1, 2, 3, 4, 5])) });
    expect([...PROOFS.kept.get(finalKey(TOKEN, "a"))!]).toEqual([1, 2, 3, 4, 5]);
    expect(PROOFS.kept.has(finalKey(TOKEN, "a", PREVIEW_W))).toBe(true);
    expect(PROOFS.kept.has(finalKey(TOKEN, "a", THUMB_W))).toBe(true);
    expect(PROOFS.deleted).toEqual([]);
  });

  it("keeps the final but drops the old web copies when Images fails", async () => {
    const PROOFS = bucket();
    const out = await storeFinal({ PROOFS, IMAGES: images(true) } as never, TOKEN, "a", bytesOf([7]), 1);
    expect(out.bytes).toBe(1);
    expect(PROOFS.kept.has(finalKey(TOKEN, "a"))).toBe(true);
    expect(PROOFS.deleted).toEqual([[finalKey(TOKEN, "a", PREVIEW_W), finalKey(TOKEN, "a", THUMB_W)]]);
  });

  it("still answers when the cleanup delete fails too", async () => {
    const PROOFS = { ...bucket(), delete: async () => { throw new Error("R2 is down"); } };
    await expect(storeFinal({ PROOFS, IMAGES: images(true) } as never, TOKEN, "a", bytesOf([7]), 1)).resolves.toMatchObject({ bytes: 1 });
  });
});

describe("openDelivery", () => {
  beforeEach(async () => {
    const kv = new FakeKV();
    ctx.env = { INBOX: kv, LEADS_KEY, PROOFS: bucket() };
    const p = { token: TOKEN, name: "Ana", included: 2, price: 15, days: 14, createdAt: "2026-11-01T00:00:00Z", frames: [], finals: [{ id: "a", file: "DSC0001.jpg", w: 1, h: 1, bytes: 9, crc: 0 }], selects: [], notes: {}, views: 0 };
    await writeProof(kv as never, (await sealer(LEADS_KEY))!, p as Proof);
  });

  it("opens a delivery with the request's env and ctx beside it", async () => {
    const g = await openDelivery(TOKEN, null);
    expect(g?.p.token).toBe(TOKEN);
    expect(g?.env).toBe(ctx.env);
    expect(typeof g?.ctx.waitUntil).toBe("function");
  });

  it("is null for an unknown delivery", async () => {
    expect(await openDelivery("11152026-zzzzzzzz", null)).toBeNull();
  });
});
