import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH, POST } from "@/app/api/proof/[token]/route";
import { sealer } from "@/lib/seal";
import { readLog } from "@/lib/leads/activity-log";
import { proofKey, type Proof } from "@/lib/proofs/proof-model";
import { readProof, writeProof } from "@/lib/proofs/proof-store";
import { FakeKV, LEADS_KEY } from "../fakes";

/* /api/proof/[token]: the client's side. The token is the only key: an
   unknown one is a 404; picks need an email; a submit within what is
   included is done without a payment. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("../fakes")).cloudflareMock(ctx));

const TOKEN = "AbCdEfGh12345678";
let kv: FakeKV;
let saves: string[];
const seal = async () => (await sealer(LEADS_KEY))!;
beforeEach(async () => {
  kv = new FakeKV();
  saves = [];
  // Autosave's own limit: the first five saves go through here, the rest are refused.
  ctx.env = {
    INBOX: kv,
    LEADS_KEY,
    PUBLIC_WRITE_LIMIT: { limit: async () => ({ success: true }) },
    DOWNLOAD_LIMIT: { limit: async ({ key }: { key: string }) => ({ success: saves.push(key) <= 5 }) },
  };
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

const req = (method: string, body: unknown) => new Request("https://juliangigola.com/api/proof/x", { method, body: JSON.stringify(body) });
const patch = (body: unknown, token = TOKEN) => PATCH(req("PATCH", body), { params: Promise.resolve({ token }) });
const post = (body: unknown, token = TOKEN) => POST(req("POST", body), { params: Promise.resolve({ token }) });
const stored = async () => (await readProof(kv as never, await seal(), TOKEN))!;

describe("/api/proof/[token]", () => {
  it("rate-limits the picks autosave under its own kind, before the body is read", async () => {
    for (let i = 0; i < 5; i++) expect((await patch({ email: "a@example.com", selects: ["a"] })).status).toBe(200);
    const res = await patch("not json");
    expect(res.status).toBe(429);
    expect(saves.every((k) => k.startsWith("selects:"))).toBe(true);
  });

  it("answers JSON when the gallery will not open", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    kv.data.get(proofKey(TOKEN))!.value = "not-sealed";
    for (const res of [
      await patch({ email: "a@example.com", selects: ["a"] }),
      await post({ action: "track", email: "a@example.com" }),
      await post({ action: "unlock", password: "x" }),
    ]) {
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "This gallery cannot be opened right now." });
    }
    errors.mockRestore();
  });

  it("is a 404 for an unknown or malformed token", async () => {
    expect((await patch({ email: "a@example.com", selects: ["a"] }, "ZzZzZzZz87654321")).status).toBe(404);
    expect((await post({ action: "track", email: "a@example.com" }, "../x")).status).toBe(404);
  });

  it("refuses picks and a submit without an email, and a submit with no frames", async () => {
    expect((await patch({ selects: ["a"] })).status).toBe(400);
    expect((await post({ selects: ["a"] })).status).toBe(400);
    expect((await post({ email: "a@example.com", selects: ["zz"] })).status).toBe(400);
    expect((await stored()).selects).toEqual([]);
  });

  it("saves picks, then submits within what is included without a payment", async () => {
    expect((await patch({ email: "a@example.com", selects: ["a", "zz"] })).status).toBe(200);
    expect((await stored()).selects).toEqual(["a"]);
    const res = await post({ email: "a@example.com", selects: ["a", "b"] });
    expect(await res.json()).toMatchObject({ done: true });
    const p = await stored();
    expect(p.selects).toEqual(["a", "b"]);
    expect(p.submittedAt).toBeTruthy();
    expect((await patch({ email: "a@example.com", selects: ["c"] })).status).toBe(409);
    // On the client's activity log: the selects, with the frame count.
    const s = await seal();
    expect((await readLog(kv as never, s, await s.id("a@example.com"))).find((e) => e.kind === "selects")).toMatchObject({
      note: "2 frames, Test",
    });
  });

  it("records a gate open as a lead, but not from a reserved test address", async () => {
    const leads = async () => (await kv.list({ prefix: "lead:" })).keys.length;
    expect((await post({ action: "track", kind: "open", email: "qa@example.com" })).status).toBe(200);
    expect((await post({ action: "track", kind: "open", email: "qa@studio.test" })).status).toBe(200);
    expect(await leads()).toBe(0);
    expect((await stored()).viewers).toBeTruthy();
    expect((await post({ action: "track", kind: "open", email: "maya@gmail.com" })).status).toBe(200);
    expect(await leads()).toBe(1);
  });
});
