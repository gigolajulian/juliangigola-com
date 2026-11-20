import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeKV, LEADS_KEY } from "./fakes";
import { sealer } from "@/lib/leads/lead-crypto";
import { deliveryDownload } from "@/lib/proofs/delivery-serve";
import { readProof, writeProof, type Proof } from "@/lib/proofs/proof";
import { zipLayout } from "@/lib/zip";

/* Delivery by model (Julian 2026-11-19): a final carries its model and five stars, and `/zip?m=<label>` takes one model. */

const KEY = "inbox-key-for-tests";
const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));
const { PUT } = await import("@/app/api/proof/route");

const ID = "11192026-k7m2q9xd";
const bytes: Record<string, string> = { a: "aaa", b: "bbbb", c: "cc" };
let kv: FakeKV;
let env: Record<string, unknown>;
beforeEach(async () => {
  vi.stubGlobal("FixedLengthStream", class { constructor() { return new TransformStream(); } });
  kv = new FakeKV();
  env = {
    INBOX: kv, INBOX_KEY: KEY, LEADS_KEY,
    PROOFS: { get: async (k: string) => { const b = bytes[k.split("/").pop()!.replace(".jpg", "")]; return b ? { body: new Response(b).body, size: b.length } : null; } },
    DOWNLOAD_LIMIT: { limit: async () => ({ success: true }) },
  };
  const finals = [
    { id: "a", file: "A.jpg", w: 1, h: 1, bytes: 3, crc: 0, model: "M04" },
    { id: "b", file: "B.jpg", w: 1, h: 1, bytes: 4, crc: 0, model: "Marcus K" },
    { id: "c", file: "C.jpg", w: 1, h: 1, bytes: 2, crc: 0, model: "M04" },
  ];
  await writeProof(kv as never, (await sealer(LEADS_KEY))!, { token: ID, name: "Paradox", frames: [], selects: [], notes: {}, finals } as unknown as Proof);
});

describe("a model's zip", () => {
  it("holds only that model's finals, with the exact length and the model in its name", async () => {
    const res = (await deliveryDownload(new Request(`https://x/delivery/${ID}/zip?m=M04`), env as never))!;
    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe(String(zipLayout([{ name: "A.jpg", size: 3, crc: 0 }, { name: "C.jpg", size: 2, crc: 0 }]).total));
    expect(res.headers.get("content-disposition")).toContain("M04.zip");
    const body = await res.text();
    expect(body).toContain("A.jpg");
    expect(body).toContain("C.jpg");
    expect(body).not.toContain("B.jpg");
  });

  it("is a 404 for a model the delivery does not have; no m is every final", async () => {
    expect((await deliveryDownload(new Request(`https://x/delivery/${ID}/zip?m=M99`), env as never))!.status).toBe(404);
    const all = await (await deliveryDownload(new Request(`https://x/delivery/${ID}/zip`), env as never))!.text();
    for (const f of ["A.jpg", "B.jpg", "C.jpg"]) expect(all).toContain(f);
    const named = await (await deliveryDownload(new Request(`https://x/delivery/${ID}/zip?m=Marcus%20K`), env as never))!.text();
    expect(named).toContain("B.jpg");
    expect(named).not.toContain("A.jpg");
  });
});

describe("publishing a final with its model", () => {
  const put = (q: string) =>
    PUT(new Request(`https://juliangigola.com/api/proof?token=${ID}&file=x.jpg&w=2&h=3&final=1&${q}`, { method: "PUT", body: "xy", headers: { "x-inbox-key": KEY, "content-type": "image/jpeg", "content-length": "2" }, duplex: "half" } as RequestInit));

  it("keeps the collection name as the label and five stars, and drops a label past 40 characters", async () => {
    ctx.env = { ...env, PROOFS: { put: async (_k: string, b: ReadableStream) => void (await new Response(b).arrayBuffer()), get: async () => null, delete: async () => {} }, IMAGES: { input: () => { throw new Error("off"); } } };
    expect((await put("id=d&model=Marcus%20%20K&top=1"))!.status).toBe(200);
    expect((await put(`id=e&model=${"x".repeat(41)}`))!.status).toBe(200);
    const p = (await readProof(kv as never, (await sealer(LEADS_KEY))!, ID))!;
    const by = Object.fromEntries(p.finals!.map((f) => [f.id, f]));
    expect([by.d.model, by.d.top]).toEqual(["Marcus K", true]);
    expect([by.e.model, by.e.top]).toEqual([undefined, undefined]);
  });
});
