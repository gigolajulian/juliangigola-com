import { describe, expect, it, vi } from "vitest";
import { FakeKV, LEADS_KEY, INBOX_KEY as KEY } from "./fakes";
import { sealer } from "@/lib/leads/lead-crypto";
import { deliveryView, finalKey, PREVIEW_W, THUMB_W, type Proof } from "@/lib/proofs/proof-model";
import { readProof, writeProof } from "@/lib/proofs/proof-store";

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown>, crc: 0 }));
vi.mock("@opennextjs/cloudflare", async () => (await import("./fakes")).cloudflareMock(ctx));
const { PUT } = await import("@/app/api/proof/route");
const TOKEN = "AbCdEfGh12345678";

describe("republishing a final from Lightroom", () => {
  it("replaces the old final and its web copies", async () => {
    const kv = new FakeKV();
    const store = new Map<string, number>();
    // Workers' FixedLengthStream, stood in by a plain pass-through.
    vi.stubGlobal("FixedLengthStream", class { constructor() { return new TransformStream(); } });
    const r2 = {
      put: vi.fn(async (k: string, body: ReadableStream | ArrayBuffer) => { store.set(k, (body instanceof ReadableStream ? await new Response(body).arrayBuffer() : body).byteLength); }),
      get: vi.fn(async (k: string) => (store.has(k) ? { body: new Response("x").body } : null)),
      delete: vi.fn(async (ks: string[]) => { for (const k of ks) store.delete(k); }),
    };
    // Cloudflare Images down: the old 2000px and 800px copies must not outlive the edit.
    const IMAGES = { input: () => { throw new Error("Images down"); } };
    ctx.env = { INBOX: kv, INBOX_KEY: KEY, LEADS_KEY, PROOFS: r2, IMAGES };
    const s = (await sealer(LEADS_KEY))!;
    await writeProof(kv as never, s, { token: TOKEN, name: "Test", frames: [], selects: [], notes: {}, finals: [] } as unknown as Proof);
    for (const k of [finalKey(TOKEN, "a", PREVIEW_W), finalKey(TOKEN, "a", THUMB_W)]) store.set(k, 1);

    const put = (body: string) => PUT(new Request(`https://juliangigola.com/api/proof?token=${TOKEN}&id=a&file=a.jpg&w=2&h=3&final=1`, { method: "PUT", body, headers: { "x-inbox-key": KEY, "content-type": "image/jpeg", "content-length": String(body.length) }, duplex: "half" } as RequestInit));
    expect((await put("old"))!.status).toBe(200);
    const first = (await readProof(kv as never, s, TOKEN))!.finals![0];
    expect((await put("new edit"))!.status).toBe(200);
    const p = (await readProof(kv as never, s, TOKEN))!;
    expect(p.finals!.map((f) => [f.id, f.bytes])).toEqual([["a", 8]]);
    expect(store.get(finalKey(TOKEN, "a"))).toBe(8);
    expect(store.has(finalKey(TOKEN, "a", PREVIEW_W))).toBe(false);
    expect(store.has(finalKey(TOKEN, "a", THUMB_W))).toBe(false);
    // The page's image URLs change with the file, so a cached old copy is not shown.
    expect(deliveryView(p).finals[0].v).not.toBe(first.crc);
    vi.unstubAllGlobals();
  });
});
