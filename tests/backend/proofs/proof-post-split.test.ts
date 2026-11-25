import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as legacy } from "@/app/api/proof/[token]/route";
import { POST as unlock } from "@/app/api/proof/[token]/unlock/route";
import { POST as track } from "@/app/api/proof/[token]/track/route";
import { POST as send } from "@/app/api/proof/[token]/send/route";
import { sealer } from "@/lib/seal";
import { type Proof } from "@/lib/proofs/proof-model";
import { readProof, writeProof } from "@/lib/proofs/proof-store";
import { FakeKV, LEADS_KEY } from "../fakes";

/* /api/proof/[token]/{unlock,track,send}: one job per route. The old POST still picks the job by body shape, for tabs opened before the split. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("../fakes")).cloudflareMock(ctx));

const TOKEN = "AbCdEfGh12345678";
let kv: FakeKV;
let limits: string[];
const seal = async () => (await sealer(LEADS_KEY))!;
const limiter = (ok: (key: string) => boolean) => ({
  limit: async ({ key }: { key: string }) => ({ success: (limits.push(key), ok(key)) }),
});

beforeEach(async () => {
  kv = new FakeKV();
  limits = [];
  ctx.env = { INBOX: kv, LEADS_KEY, PUBLIC_WRITE_LIMIT: limiter(() => true), DOWNLOAD_LIMIT: limiter(() => true) };
  const p = {
    token: TOKEN,
    name: "Test",
    included: 2,
    price: 15,
    days: 14,
    createdAt: new Date().toISOString(),
    frames: ["a", "b", "c"].map((id) => ({ id, file: `${id}.jpg`, w: 1, h: 1 })),
    selects: [],
    notes: {},
    views: 0,
  };
  await writeProof(kv as never, await seal(), p as Proof);
});

type Handler = (r: Request, c: { params: Promise<{ token: string }> }) => Promise<Response>;
const call = (h: Handler, body: unknown) =>
  h(new Request("https://juliangigola.com/api/proof/x", { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ token: TOKEN }),
  });
const stored = async () => (await readProof(kv as never, await seal(), TOKEN))!;

describe("proof POST, one route per job", () => {
  it("track logs a visit with no action in the body, on the download limiter", async () => {
    const res = await call(track, { email: "a@example.com", kind: "review" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ picks: [] });
    expect(Object.keys((await stored()).viewers ?? {})).toHaveLength(1);
    expect(limits).toEqual([expect.stringMatching(/^track:/)]);
  });

  it("track answers 429 past its limit and writes nothing", async () => {
    ctx.env.DOWNLOAD_LIMIT = limiter(() => false);
    expect((await call(track, { email: "a@example.com", kind: "review" })).status).toBe(429);
    expect((await stored()).viewers).toBeUndefined();
  });

  it("send takes the picks within what is included, and never logs them as a track", async () => {
    const res = await call(send, { email: "a@example.com", selects: ["a"], action: "track" });
    expect(res.status).toBe(200);
    expect((await stored()).submittedAt).toBeTruthy();
    expect(limits).toEqual([expect.stringMatching(/^picks:/)]);
  });

  it("unlock lets a gallery with no password straight in", async () => {
    expect(await (await call(unlock, { password: "x" })).json()).toEqual({ ok: true });
  });

  it("the old POST still picks each job by body shape", async () => {
    expect(await (await call(legacy, { action: "unlock", password: "x" })).json()).toEqual({ ok: true });
    expect(await (await call(legacy, { action: "track", email: "a@example.com" })).json()).toEqual({ picks: [] });
    expect((await call(legacy, { email: "a@example.com", selects: ["a"] })).status).toBe(200);
    expect((await stored()).submittedAt).toBeTruthy();
  });
});
