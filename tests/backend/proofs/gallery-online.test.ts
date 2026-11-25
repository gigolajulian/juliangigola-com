import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/proof/[token]/route";
import { GET as adminGET, PATCH as adminPATCH } from "@/app/api/proof/route";
import { finalResponse } from "@/lib/proofs/delivery-serve";
import { sealer } from "@/lib/seal";
import { coverFrame, type Proof } from "@/lib/proofs/proof-model";
import { checkPass, hashPass, passOk, passValue, readProof, writeProof } from "@/lib/proofs/proof-store";
import { FakeKV, LEADS_KEY, refusesTargets } from "../fakes";

/* Online/offline and the gate's password (Julian 2026-11-15): offline closes the gallery, its frames and downloads at
   once; a password is stored hashed, checked on the gate with a rate limit, and every later call needs its cookie. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("../fakes")).cloudflareMock(ctx));

const ID = "11152026-k7m2q9xd";
let kv: FakeKV;
let tries: number;
const seal = async () => (await sealer(LEADS_KEY))!;
const gallery = (over: Partial<Proof> = {}): Proof => ({
  token: ID,
  name: "Ana",
  included: 2,
  price: 15,
  days: 14,
  createdAt: "2026-11-01T00:00:00Z",
  frames: [{ id: "a", file: "a.jpg", w: 1, h: 1 }],
  finals: [{ id: "a", file: "a.jpg", w: 1, h: 1, bytes: 3, crc: 0 }],
  selects: [],
  notes: {},
  views: 0,
  watermark: true,
  ...over,
});
const put = async (p: Proof) => writeProof(kv as never, await seal(), p);
beforeEach(() => {
  kv = new FakeKV();
  tries = 0;
  ctx.env = {
    INBOX: kv,
    LEADS_KEY,
    INBOX_KEY: "k",
    PROOFS: { get: async () => ({ body: new Response("abc").body, size: 3 }) },
    PUBLIC_WRITE_LIMIT: { limit: async () => ({ success: ++tries <= 5 }) },
    DOWNLOAD_LIMIT: { limit: async () => ({ success: true }) },
  };
});
const post = (body: unknown, cookie?: string) =>
  POST(
    new Request("https://juliangigola.com/api/proof/x", { method: "POST", body: JSON.stringify(body), headers: cookie ? { cookie } : {} }),
    { params: Promise.resolve({ token: ID }) },
  );
const track = (cookie?: string) => post({ action: "track", email: "ana@gmail.com", kind: "open" }, cookie);
const save = (cookie?: string) =>
  finalResponse(new Request(`https://x/delivery/${ID}/dl/a`, { headers: cookie ? { cookie } : {} }), ctx.env as never, ID, "a");

describe("password hashing", () => {
  it("checks the right one, refuses the rest, and keeps no plain text", async () => {
    const h = await hashPass("blue moon");
    expect(JSON.stringify(h)).not.toContain("blue moon");
    expect(await checkPass(h, "blue moon")).toBe(true);
    expect(await checkPass(h, "blue moo")).toBe(false);
  });
  it("a new password ends the old cookie", async () => {
    const p = gallery({ pass: await hashPass("one1") });
    const cookie = `gp_${ID}=${await passValue(p, LEADS_KEY)}`;
    expect(await passOk(p, cookie, LEADS_KEY)).toBe(true);
    expect(await passOk(p, null, LEADS_KEY)).toBe(false);
    expect(await passOk({ ...p, pass: await hashPass("two2") }, cookie, LEADS_KEY)).toBe(false);
    expect(await passOk(gallery(), null, LEADS_KEY)).toBe(true);
  });
  it("no link preview for a password or offline gallery", async () => {
    expect(coverFrame(gallery())).not.toBeNull();
    expect(coverFrame(gallery({ pass: await hashPass("one1") }))).toBeNull();
    expect(coverFrame(gallery({ offline: true }))).toBeNull();
  });
});

describe("offline", () => {
  it("stops the client API and the downloads at once", async () => {
    await put(gallery({ offline: true }));
    expect((await track()).status).toBe(404);
    expect((await save()).status).toBe(404);
    await put(gallery());
    expect((await track()).status).toBe(200);
    expect((await save()).status).toBe(200);
  });
});

describe("the gate's password", () => {
  it("refuses without the cookie, sets it on the right password, and rate-limits guesses", async () => {
    await put(gallery({ pass: await hashPass("blue moon") }));
    expect((await track()).status).toBe(404);
    expect((await save()).status).toBe(404);
    expect((await post({ action: "unlock", password: "nope" })).status).toBe(403);
    const ok = await post({ action: "unlock", password: "blue moon" });
    expect(ok.status).toBe(200);
    const set = ok.headers.get("set-cookie")!;
    expect(set).toMatch(/HttpOnly/);
    const cookie = set.split(";")[0];
    expect((await track(cookie)).status).toBe(200);
    expect((await save(cookie)).status).toBe(200);
    for (let i = 0; i < 3; i++) await post({ action: "unlock", password: "nope" });
    expect((await post({ action: "unlock", password: "blue moon" })).status).toBe(429);
  });

  it("the desk stores it hashed and only ever sees hasPass", async () => {
    await put(gallery());
    const patch = async (b: unknown) =>
      (await adminPATCH(
        new Request("https://juliangigola.com/api/proof", {
          method: "PATCH",
          body: JSON.stringify({ token: ID, ...(b as object) }),
          headers: { "x-admin-key": "k" },
        }),
      ))!;
    expect((await patch({ password: "ab" })).status).toBe(400);
    const res = await (await patch({ password: "blue moon", offline: true })).json();
    expect(res.proof.hasPass).toBe(true);
    expect(res.proof.pass).toBeUndefined();
    expect(res.proof.offline).toBe(true);
    const stored = (await readProof(kv as never, await seal(), ID))!;
    expect(await checkPass(stored.pass!, "blue moon")).toBe(true);
    const list = await (await adminGET(
      new Request("https://juliangigola.com/api/proof?list", { headers: { "x-admin-key": "k" } }),
    ))!.json();
    expect(JSON.stringify(list)).not.toContain(stored.pass!.hash);
    await patch({ password: "" });
    expect((await readProof(kv as never, await seal(), ID))!.pass).toBeUndefined();
  });
});

describe("per target", () => {
  it("counts wrong passwords per gallery from any address, and shuts the gate a minute past the limit", async () => {
    await put(gallery({ pass: await hashPass("blue moon") }));
    const lim = refusesTargets();
    ctx.env.PUBLIC_WRITE_LIMIT = lim;
    expect((await post({ action: "unlock", password: "blue moon" })).status).toBe(200);
    expect(lim.keys.some((k) => k.includes(":t:"))).toBe(false);
    expect((await post({ action: "unlock", password: "nope" })).status).toBe(403);
    expect(lim.keys).toContain(`pass-miss:t:${ID}`);
    expect((await post({ action: "unlock", password: "blue moon" })).status).toBe(429);
  });

  it("limits the delivery's downloads per delivery from every address together", async () => {
    await put(gallery({ deliveredAt: "2026-11-02T00:00:00Z" }));
    const lim = refusesTargets();
    ctx.env.DOWNLOAD_LIMIT = lim;
    expect((await save()).status).toBe(429);
    expect(lim.keys).toContain(`dl:t:${ID}`);
  });
});

describe("one gallery's link or cookie never opens another", () => {
  const OTHER = "11152026-p4n8w3zr";
  const on = (token: string, body: unknown, cookie?: string) =>
    POST(
      new Request("https://juliangigola.com/api/proof/x", { method: "POST", body: JSON.stringify(body), headers: cookie ? { cookie } : {} }),
      { params: Promise.resolve({ token }) },
    );
  const download = (token: string, cookie?: string) =>
    finalResponse(new Request(`https://x/delivery/${token}/dl/a`, { headers: cookie ? { cookie } : {} }), ctx.env as never, token, "a");

  it("refuses gallery A's cookie on gallery B, under either name, for picks, looks and downloads", async () => {
    const pass = await hashPass("blue moon");
    await put(gallery({ pass, deliveredAt: "2026-11-02T00:00:00Z" }));
    await put(gallery({ token: OTHER, name: "Ben", pass, deliveredAt: "2026-11-02T00:00:00Z" }));
    const ok = await on(ID, { action: "unlock", password: "blue moon" });
    const cookie = ok.headers.get("set-cookie")!.split(";")[0];
    const value = cookie.split("=").slice(1).join("=");
    expect((await on(ID, { action: "track", email: "ana@gmail.com", kind: "open" }, cookie)).status).toBe(200);
    for (const c of [cookie, `gp_${OTHER}=${value}`]) {
      expect((await on(OTHER, { action: "track", email: "ana@gmail.com", kind: "open" }, c)).status).toBe(404);
      expect((await on(OTHER, { email: "ana@gmail.com", selects: ["a"] }, c)).status).toBe(404);
      expect((await download(OTHER, c)).status).toBe(404);
    }
    expect((await readProof(kv as never, await seal(), OTHER))!.viewers).toBeUndefined();
  });

  it("a token names one gallery: A's token never reads B's frames or picks", async () => {
    await put(gallery({ frames: [{ id: "a", file: "a.jpg", w: 1, h: 1 }] }));
    await put(gallery({ token: OTHER, name: "Ben", frames: [{ id: "b", file: "b.jpg", w: 1, h: 1 }] }));
    const res = await on(ID, { action: "track", email: "ana@gmail.com", kind: "open" });
    expect(res.status).toBe(200);
    expect((await readProof(kv as never, await seal(), ID))!.viewers).toBeTruthy();
    expect((await readProof(kv as never, await seal(), OTHER))!.viewers).toBeUndefined();
  });
});
