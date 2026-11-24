import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH, POST, PUT } from "@/app/api/proof/route";
import { sealer } from "@/lib/seal";
import { readProof, writeProof } from "@/lib/proofs/proof-store";
import { proofKey } from "@/lib/proofs/proof-model";
import { personKey, readLead, writeLead } from "@/lib/leads/lead-store";
import * as List from "@/app/api/proof/list/route";
import * as Gallery from "@/app/api/proof/gallery/route";
import * as Preview from "@/app/api/proof/preview/route";
import * as Remind from "@/app/api/proof/remind/route";
import * as Action from "@/app/api/proof/action/route";
import { FakeKV, LEADS_KEY, INBOX_KEY as KEY } from "../fakes";

/* /api/proof: Julian's side of proof galleries. Off without its bindings,
   behind the inbox key, refuses bad input, and creates, uploads to and
   reads back a gallery. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("../fakes")).cloudflareMock(ctx));

const req = (
  method: string,
  { body, query = "", key = KEY, type, path = "" }: { body?: BodyInit; query?: string; key?: string; type?: string; path?: string } = {},
) =>
  new Request(`https://juliangigola.com/api/proof${path}${query}`, {
    method,
    body,
    headers: { "x-admin-key": key, ...(type ? { "content-type": type } : {}) },
  });
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
    const up = await call(
      PUT,
      req("PUT", { query: `?token=${token}&id=a1&file=a.jpg&w=3&h=2`, body: new Uint8Array([0xff, 0xd8, 0xff]), type: "image/jpeg" }),
    );
    expect(await up.json()).toMatchObject({ ok: true, frames: 1 });
    expect(r2.put).toHaveBeenCalledTimes(1);
    const got = await (await call(GET, req("GET", { query: `?token=${token}` }))).json();
    expect(got.proof.frames).toEqual([{ id: "a1", file: "a.jpg", w: 3, h: 2 }]);
    expect((await readProof(kv as never, (await sealer(LEADS_KEY))!, token))?.name).toBe("Test");
  });

  it("stamps pulledAt only on the plugin's POST pulled, once, and only for sent selects", async () => {
    const s = (await sealer(LEADS_KEY))!;
    const { token } = await (await call(POST, req("POST", { body: json({ action: "create", name: "Test" }) }))).json();
    const pulled = async () => (await (await call(POST, req("POST", { body: json({ action: "pulled", token }) }))).json()).pulledAt;
    expect(await pulled()).toBeNull(); // nothing sent yet
    await writeProof(kv as never, s, { ...(await readProof(kv as never, s, token))!, submittedAt: "2026-11-20T10:00:00.000Z" });
    await call(GET, req("GET", { query: `?token=${token}` }));
    expect((await readProof(kv as never, s, token))!.pulledAt).toBeUndefined(); // a read stamps nothing
    const first = await pulled();
    expect(first).toMatch(/^\d{4}-/);
    expect(await pulled()).toBe(first);
  });

  it("readProof: null for a gallery that is not there, a throw for one it cannot open", async () => {
    const s = (await sealer(LEADS_KEY))!;
    expect(await readProof(kv as never, s, "nothere")).toBeNull();
    const { token } = await (await call(POST, req("POST", { body: json({ action: "create", name: "Test" }) }))).json();
    kv.data.get(proofKey(token))!.value = "not-sealed";
    await expect(readProof(kv as never, s, token)).rejects.toThrow();
  });

  it("refuses a bad client email and keeps the stored one", async () => {
    const { token } = await (
      await call(POST, req("POST", { body: json({ action: "create", name: "Test", email: "ana@example.com" }) }))
    ).json();
    const s = (await sealer(LEADS_KEY))!;
    const puts = kv.puts.length;
    for (const email of ["nope", `${"a".repeat(189)}@example.com`]) {
      const res = await call(PATCH, req("PATCH", { body: json({ token, email }) }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "That email does not look right." });
    }
    expect(kv.puts.length).toBe(puts);
    expect((await call(POST, req("POST", { body: json({ action: "create", name: "Bad", email: "nope" }) }))).status).toBe(400);
    expect((await call(PATCH, req("PATCH", { body: json({ token, name: "Renamed" }) }))).status).toBe(200);
    expect(await readProof(kv as never, s, token)).toMatchObject({ name: "Renamed", email: "ana@example.com" });
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

  it("forget takes the gallery's opens off Leads, and a lead made only of them", async () => {
    const { token } = await (await call(POST, req("POST", { body: json({ action: "create", name: "Test" }) }))).json();
    const s = (await sealer(LEADS_KEY))!;
    const p = (await readProof(kv as never, s, token))!;
    const v = { first: "", last: "", visits: 1, seconds: 0, picks: [] };
    await writeProof(kv as never, s, { ...p, viewers: { "me@x.com": v, "ana@x.com": v } } as never);
    const open = { at: "2026-11-12T00:00:00Z", kind: "proofs" as const, ref: token };
    const lead = (email: string, events: unknown[]) =>
      ({ email, name: email, stage: "Inquiry", stageAt: open.at, firstAt: open.at, lastAt: open.at, events }) as never;
    const me = await s.id("me@x.com"),
      ana = await s.id("ana@x.com");
    await writeLead(kv as never, s, me, lead("me@x.com", [open]));
    await writeLead(kv as never, s, ana, lead("ana@x.com", [{ ...open, kind: "inquiry", ref: undefined }, open]));
    for (const email of ["me@x.com", "ana@x.com"])
      expect((await call(POST, req("POST", { body: json({ action: "forget", token, email }) }))).status).toBe(200);
    expect(await readLead(kv as never, s, me)).toBeNull();
    expect((await readLead(kv as never, s, ana))?.events.map((e) => e.kind)).toEqual(["inquiry"]);
  });

  it("forget finds the lead through another person's address, as the open did", async () => {
    const { token } = await (await call(POST, req("POST", { body: json({ action: "create", name: "Test" }) }))).json();
    const s = (await sealer(LEADS_KEY))!;
    const p = (await readProof(kv as never, s, token))!;
    const v = { first: "", last: "", visits: 1, seconds: 0, picks: [] };
    await writeProof(kv as never, s, { ...p, viewers: { "ad@x.com": v } } as never);
    const open = { at: "2026-11-12T00:00:00Z", kind: "proofs" as const, ref: token };
    const brand = await s.id("brand@x.com");
    await writeLead(kv as never, s, brand, {
      email: "brand@x.com",
      name: "Brand",
      stage: "Inquiry",
      stageAt: open.at,
      firstAt: open.at,
      lastAt: open.at,
      events: [open],
      people: [{ name: "AD", email: "ad@x.com" }],
    } as never);
    await kv.put(personKey(await s.id("ad@x.com")), brand);
    expect((await call(POST, req("POST", { body: json({ action: "forget", token, email: "ad@x.com" }) }))).status).toBe(200);
    // The open is gone; the lead stays, since it lists people.
    expect((await readLead(kv as never, s, brand))?.events).toEqual([]);
  });

  it("answers JSON for a gallery it cannot open, and the list leaves it out", async () => {
    const s = (await sealer(LEADS_KEY))!;
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { token: good } = await (await call(POST, req("POST", { body: json({ action: "create", name: "Good" }) }))).json();
    const { token: bad } = await (await call(POST, req("POST", { body: json({ action: "create", name: "Bad" }) }))).json();
    kv.data.get(proofKey(bad))!.value = "not-sealed";
    for (const res of [
      await call(GET, req("GET", { query: `?token=${bad}` })),
      await call(GET, req("GET", { query: `?preview=${bad}` })),
      await call(POST, req("POST", { body: json({ action: "reopen", token: bad }) })),
      await call(PATCH, req("PATCH", { body: json({ token: bad, name: "X" }) })),
      await call(DELETE, req("DELETE", { query: `?token=${bad}` })),
    ]) {
      expect(res.status).toBe(500);
      expect((await res.json()).error).toMatch(/cannot be opened/);
    }
    const list = await (await call(GET, req("GET", { query: "?list" }))).json();
    expect(list.proofs.map((p: { token: string }) => p.token)).toEqual([good]);
    expect(errors).toHaveBeenCalledWith("proof list", bad, expect.any(String));
    expect(await readProof(kv as never, s, good)).not.toBeNull();
    errors.mockRestore();
  });
});

describe("/api/proof sub-routes", () => {
  it("each job answers on its own path, behind the same gate", async () => {
    expect((await call(List.GET, req("GET", { path: "/list", key: "wrong" }))).status).toBe(401);
    expect((await call(Action.POST, req("POST", { path: "/action", body: "{}", key: "wrong" }))).status).toBe(401);
    const made = await call(Gallery.POST, req("POST", { path: "/gallery", body: json({ name: "Sub", email: "ana@example.com" }) }));
    expect(made.status).toBe(201);
    const { token } = await made.json();
    expect((await (await call(List.GET, req("GET", { path: "/list" }))).json()).proofs.map((p: { name: string }) => p.name)).toEqual([
      "Sub",
    ]);
    expect((await (await call(Gallery.GET, req("GET", { path: "/gallery", query: `?token=${token}` }))).json()).proof.name).toBe("Sub");
    expect(
      (await (await call(Gallery.PATCH, req("PATCH", { path: "/gallery", body: json({ token, name: "Renamed" }) }))).json()).proof.name,
    ).toBe("Renamed");
    expect((await (await call(Preview.GET, req("GET", { path: "/preview", query: `?token=${token}` }))).json()).to).toBe("ana@example.com");
    expect((await call(Remind.GET, req("GET", { path: "/remind", query: `?token=${token}` }))).status).toBe(409); // not sent yet
    expect(
      (await (await call(Action.POST, req("POST", { path: "/action", body: json({ action: "extend", token, days: 3 }) }))).json()).proof
        .closesAt,
    ).toMatch(/^\d{4}-/);
    expect((await call(Action.POST, req("POST", { path: "/action", body: json({ action: "create", token }) }))).status).toBe(400);
    expect((await call(Gallery.DELETE, req("DELETE", { path: "/gallery", query: `?token=${token}` }))).status).toBe(200);
    expect(kv.data.has(proofKey(token))).toBe(false);
  });
});
