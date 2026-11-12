import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH, POST, PUT } from "@/app/api/proof/route";
import { sealer } from "@/lib/leads/lead-crypto";
import { readProof, writeProof } from "@/lib/proofs/proof";
import { FakeKV, LEADS_KEY } from "./fakes";

/* /api/proof: Julian's side of proof galleries. Off without its bindings,
   behind the inbox key, refuses bad input, and creates, uploads to and
   reads back a gallery. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const KEY = "inbox-key-for-tests";
const req = (method: string, { body, query = "", key = KEY, type }: { body?: BodyInit; query?: string; key?: string; type?: string } = {}) =>
  new Request(`https://juliangigola.com/api/proof${query}`, { method, body, headers: { "x-inbox-key": key, ...(type ? { "content-type": type } : {}) } });
const json = (o: unknown) => JSON.stringify(o);
// The handlers are typed as maybe answering nothing; they always answer.
const call = async (h: (r: Request) => Promise<Response | undefined>, r: Request) => (await h(r))!;

let kv: FakeKV;
let r2: { put: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
beforeEach(() => {
  kv = new FakeKV();
  r2 = { put: vi.fn(async () => {}), get: vi.fn(async () => null), delete: vi.fn(async () => {}) };
  ctx.env = { INBOX: kv, INBOX_KEY: KEY, LEADS_KEY, PROOFS: r2 };
});

describe("/api/proof", () => {
  it("is off without PROOFS or LEADS_KEY", async () => {
    ctx.env = { INBOX: kv, INBOX_KEY: KEY, LEADS_KEY };
    expect((await call(GET, req("GET", { query: "?list" }))).status).toBe(503);
    ctx.env = { INBOX: kv, INBOX_KEY: KEY, PROOFS: r2 };
    expect((await call(GET, req("GET", { query: "?list" }))).status).toBe(503);
  });

  it("refuses every verb with a wrong key", async () => {
    for (const res of [
      await call(GET, req("GET", { query: "?list", key: "wrong" })),
      await call(POST, req("POST", { body: json({ action: "create" }), key: "wrong" })),
      await call(PATCH, req("PATCH", { body: "{}", key: "wrong" })),
      await call(PUT, req("PUT", { key: "wrong" })),
      await call(DELETE, req("DELETE", { key: "wrong" })),
    ])
      expect(res.status).toBe(401);
    expect(kv.puts).toEqual([]);
  });

  it("refuses a missing token, an unknown action, and a frame that is not a JPEG", async () => {
    expect((await call(GET, req("GET"))).status).toBe(400);
    expect((await call(POST, req("POST", { body: json({ action: "send", token: "../x" }) }))).status).toBe(400);
    expect((await call(PATCH, req("PATCH", { body: "{}" }))).status).toBe(400);
    const { token } = await (await call(POST, req("POST", { body: json({ action: "create", name: "Test" }) }))).json();
    expect((await call(POST, req("POST", { body: json({ action: "nope", token }) }))).status).toBe(400);
    expect((await call(PUT, req("PUT", { query: `?token=${token}&id=a1&file=a.jpg`, body: "x", type: "image/png" }))).status).toBe(415);
    expect(r2.put).not.toHaveBeenCalled();
  });

  it("creates a gallery, takes a frame, and reads it back", async () => {
    const res = await call(POST, req("POST", { body: json({ action: "create", name: "Test" }) }));
    expect(res.status).toBe(201);
    const { token } = await res.json();
    const up = await call(PUT, req("PUT", { query: `?token=${token}&id=a1&file=a.jpg&w=3&h=2`, body: new Uint8Array([0xff, 0xd8, 0xff]), type: "image/jpeg" }));
    expect(await up.json()).toMatchObject({ ok: true, frames: 1 });
    expect(r2.put).toHaveBeenCalledTimes(1);
    const got = await (await call(GET, req("GET", { query: `?token=${token}` }))).json();
    expect(got.proof.frames).toEqual([{ id: "a1", file: "a.jpg", w: 3, h: 2 }]);
    expect((await readProof(kv as never, (await sealer(LEADS_KEY))!, token))?.name).toBe("Test");
  });

  it("forgets one visitor and keeps the rest of the gallery", async () => {
    const { token } = await (await call(POST, req("POST", { body: json({ action: "create", name: "Test" }) }))).json();
    const s = (await sealer(LEADS_KEY))!;
    const p = (await readProof(kv as never, s, token))!;
    const v = { first: "", last: "", visits: 1, seconds: 0, picks: [] };
    await writeProof(kv as never, s, { ...p, selects: ["a1"], viewers: { "me@example.test": v, "hello@example.test": v } } as never);
    expect((await call(POST, req("POST", { body: json({ action: "forget", token, email: "nobody@example.test" }) }))).status).toBe(404);
    expect((await call(POST, req("POST", { body: json({ action: "forget", token, email: " ME@example.test " }) }))).status).toBe(200);
    const after = (await readProof(kv as never, s, token))!;
    expect(Object.keys(after.viewers ?? {})).toEqual(["hello@example.test"]);
    expect(after.selects).toEqual(["a1"]);
  });
});
