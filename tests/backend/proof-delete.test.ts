import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeKV, LEADS_KEY } from "./fakes";
import { sealer } from "@/lib/lead-crypto";
import { readProof, writeProof, type Proof } from "@/lib/proofs";

const KEY = "inbox-key-for-tests";
const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));
const { DELETE } = await import("@/app/api/proof/route");

const TOKEN = "AbCdEfGh12345678";
let kv: FakeKV;
let r2: { delete: ReturnType<typeof vi.fn> };
beforeEach(async () => {
  kv = new FakeKV();
  r2 = { delete: vi.fn(async () => {}) };
  ctx.env = { INBOX: kv, INBOX_KEY: KEY, LEADS_KEY, PROOFS: r2 };
  const p = { token: TOKEN, name: "Test", frames: ["a", "b", "c"].map((id) => ({ id, file: `${id}.jpg`, w: 1, h: 1 })), selects: ["a", "c"], notes: { a: "keep", b: "x" } };
  await writeProof(kv as never, (await sealer(LEADS_KEY))!, p as unknown as Proof);
});
const del = async (query: string) => (await DELETE(new Request(`https://juliangigola.com/api/proof${query}`, { method: "DELETE", headers: { "x-inbox-key": KEY } })))!;

describe("DELETE /api/proof", () => {
  it("drops several frames in one write, and one frame the old way", async () => {
    expect((await del(`?token=${TOKEN}&ids=a,b`)).status).toBe(200);
    // The watermarked copies go with the originals.
    expect(r2.delete).toHaveBeenCalledWith([`${TOKEN}/a.jpg`, `${TOKEN}/a.wm1.jpg`, `${TOKEN}/b.jpg`, `${TOKEN}/b.wm1.jpg`]);
    let p = (await readProof(kv as never, (await sealer(LEADS_KEY))!, TOKEN))!;
    expect(p.frames.map((f) => f.id)).toEqual(["c"]);
    expect(p.selects).toEqual(["c"]);
    expect(p.notes).toEqual({});
    expect((await del(`?token=${TOKEN}&id=c`)).status).toBe(200);
    p = (await readProof(kv as never, (await sealer(LEADS_KEY))!, TOKEN))!;
    expect(p.frames).toEqual([]);
  });
  it("refuses a bad id in the list", async () => {
    expect((await del(`?token=${TOKEN}&ids=a,bad%20id`)).status).toBe(400);
    expect(r2.delete).not.toHaveBeenCalled();
  });
});
