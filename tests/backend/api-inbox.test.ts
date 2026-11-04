import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { summary, enquiry, enquiryKey } from "@/lib/inbox";
import { recordLead } from "@/lib/leads";
import { FakeKV, LEADS_KEY, SCOPED, githubToken, reply } from "./fakes";
import { sealer } from "@/lib/lead-crypto";

/* /admin's inbox (`app/api/inbox/route.ts`): somebody's name, email and
   message, so the gate is the point. Either the INBOX_KEY or a GitHub
   token that can push opens it; nothing is ever cacheable. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const { GET, PATCH, POST, DELETE } = await import("@/app/api/inbox/route");

const KEY = "inbox-key-for-tests";
const URL_ = "https://juliangigola.com/api/inbox";
const req = (method: string, { key = KEY, token, body, query = "" }: { key?: string | null; token?: string; body?: string; query?: string } = {}) =>
  new Request(URL_ + query, {
    method,
    body,
    headers: { ...(key ? { "x-inbox-key": key } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });

let kv: FakeKV;
const seed = async (at: number, id: string, extra: Partial<Parameters<typeof enquiry>[0]> = {}) => {
  const e = enquiry({ type: "portrait", name: `Person ${id}`, email: `${id}@example.com`, detail: "", message: "Hello", ...extra }, at, id);
  const k = enquiryKey(at, id);
  await kv.put(k, JSON.stringify(e), { metadata: summary(e) });
  return k;
};

beforeEach(() => {
  kv = new FakeKV();
  ctx.env = { INBOX: kv, INBOX_KEY: KEY, LEADS_KEY };
});
afterEach(() => vi.unstubAllGlobals());

describe("the gate", () => {
  it("answers 503 when the build has no INBOX binding", async () => {
    ctx.env = { INBOX_KEY: KEY };
    expect((await GET(req("GET"))).status).toBe(503);
  });

  it("refuses no credential, a wrong key, and a key when none is set", async () => {
    expect((await GET(req("GET", { key: null }))).status).toBe(401);
    expect((await GET(req("GET", { key: "wrong" }))).status).toBe(401);
    expect((await GET(req("GET", { key: KEY.slice(0, -1) }))).status).toBe(401);
    ctx.env = { INBOX: kv };
    expect((await GET(req("GET"))).status).toBe(401);
  });

  it("opens with the right key, and never lets a response be cached", async () => {
    const res = await GET(req("GET"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const refused = await GET(req("GET", { key: "wrong" }));
    expect(refused.headers.get("cache-control")).toContain("no-store");
  });

  it("opens with a GitHub token that can push, and asks GitHub once per token", async () => {
    const fetch = vi.fn(async () => reply({ permissions: { push: true } }, 200, SCOPED));
    vi.stubGlobal("fetch", fetch);
    const token = githubToken();
    expect((await GET(req("GET", { key: null, token }))).status).toBe(200);
    expect((await GET(req("GET", { key: null, token }))).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refuses a token that cannot push, one GitHub rejects, and GitHub being down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply({ permissions: { push: false } })));
    expect((await GET(req("GET", { key: null, token: githubToken() }))).status).toBe(401);
    vi.stubGlobal("fetch", vi.fn(async () => reply({ message: "Bad credentials" }, 401)));
    expect((await GET(req("GET", { key: null, token: githubToken() }))).status).toBe(401);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    expect((await GET(req("GET", { key: null, token: githubToken() }))).status).toBe(401);
  });

  it("refuses a made-up bearer string without asking GitHub", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await GET(req("GET", { key: null, token: "letmein" }))).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("GET", () => {
  it("returns every message past one page of keys, newest first", async () => {
    // KV pages its list (1000 a page; 400 was asked for before), oldest
    // first: the newest are the ones a single page would drop. 1,001 rows
    // take two pages and pass the old 400.
    for (let i = 0; i < 1001; i++) await seed(1_700_000_000_000 + i * 1000, `m${String(i).padStart(4, "0")}`);
    const res = await GET(req("GET"));
    const body = (await res.json()) as { rows: { key: string }[]; complete: boolean };
    expect(body.rows).toHaveLength(1001);
    expect(body.rows[0].key).toBe(enquiryKey(1_700_000_000_000 + 1000 * 1000, "m1000"));
    expect(body.complete).toBe(true);
  });

  it("lists newest first from metadata, without reading a message", async () => {
    await seed(1_000, "aaaaaaaa");
    await seed(3_000, "cccccccc");
    await seed(2_000, "bbbbbbbb");
    await kv.put("cool:x", "1");
    const get = vi.spyOn(kv, "get");
    const body = await (await GET(req("GET"))).json();
    expect(body.rows.map((r: { id: string }) => r.id)).toEqual(["cccccccc", "bbbbbbbb", "aaaaaaaa"]);
    expect(body.rows[0]).toMatchObject({ key: enquiryKey(3_000, "cccccccc"), name: "Person cccccccc", read: false });
    expect(body.complete).toBe(true);
    expect(get).not.toHaveBeenCalled();
  });

  it("opens one message, and says Gone or Unknown for the rest", async () => {
    const k = await seed(1_000, "aaaaaaaa");
    const one = await (await GET(req("GET", { query: `?key=${k}` }))).json();
    expect(one.enquiry).toMatchObject({ id: "aaaaaaaa", message: "Hello" });
    expect((await GET(req("GET", { query: "?key=msg:000000000000001:gone" }))).status).toBe(404);
    expect((await GET(req("GET", { query: "?key=cool:abc" }))).status).toBe(400);
  });

  it("serves an enquiry's uploaded image with its own content type", async () => {
    const k = await seed(1_000, "aaaaaaaa");
    await kv.put(`ref:${k}:0`, new Uint8Array([1, 2, 3]).buffer, { metadata: { type: "image/png" } });
    const res = await GET(req("GET", { query: `?key=ref:${k}:0` }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect((await GET(req("GET", { query: `?key=ref:${k}:9` }))).status).toBe(404);
  });

  it("serves anything stored that is not a JPEG or PNG as a download that cannot run", async () => {
    const k = await seed(1_000, "aaaaaaaa");
    await kv.put(`ref:${k}:0`, new TextEncoder().encode("<svg><script>alert(1)</script></svg>").buffer, { metadata: { type: "image/svg+xml" } });
    const res = await GET(req("GET", { query: `?key=ref:${k}:0` }));
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("content-disposition")).toBe("attachment");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("PATCH", () => {
  it("marks read and keeps the row's metadata", async () => {
    const k = await seed(1_000, "aaaaaaaa");
    const res = await PATCH(req("PATCH", { body: JSON.stringify({ key: k, read: true }) }));
    expect(res.status).toBe(200);
    expect(kv.json(k).read).toBe(true);
    expect(kv.data.get(k)!.metadata).toMatchObject({ read: true, name: "Person aaaaaaaa" });
  });

  it("answers 400 to bad JSON and bad fields, 404 to a missing message", async () => {
    expect((await PATCH(req("PATCH", { body: "{nope" }))).status).toBe(400);
    expect((await PATCH(req("PATCH", { body: JSON.stringify({ key: "cool:x", read: true }) }))).status).toBe(400);
    expect((await PATCH(req("PATCH", { body: JSON.stringify({ key: "msg:1", read: "yes" }) }))).status).toBe(400);
    expect((await PATCH(req("PATCH", { body: JSON.stringify({ key: "msg:000000000000001:gone", read: true }) }))).status).toBe(404);
  });

  it("is behind the gate", async () => {
    const k = await seed(1_000, "aaaaaaaa");
    expect((await PATCH(req("PATCH", { key: "wrong", body: JSON.stringify({ key: k, read: true }) }))).status).toBe(401);
    expect(kv.json(k).read).toBe(false);
  });
});

describe("DELETE", () => {
  it("removes the message and the images it arrived with, and nothing else", async () => {
    const k = await seed(1_000, "aaaaaaaa");
    const other = await seed(2_000, "bbbbbbbb");
    await kv.put(`ref:${k}:0`, "img");
    await kv.put(`ref:${k}:1`, "img");
    await kv.put(`ref:${other}:0`, "img");
    expect((await DELETE(req("DELETE", { body: JSON.stringify({ key: k }) }))).status).toBe(200);
    expect([...kv.data.keys()].sort()).toEqual([other, `ref:${other}:0`].sort());
  });

  it("answers 400 to bad JSON or a key outside the inbox, and is behind the gate", async () => {
    const k = await seed(1_000, "aaaaaaaa");
    expect((await DELETE(req("DELETE", { body: "{" }))).status).toBe(400);
    expect((await DELETE(req("DELETE", { body: JSON.stringify({ key: "count:2026-10-11" }) }))).status).toBe(400);
    expect((await DELETE(req("DELETE", { key: null, body: JSON.stringify({ key: k }) }))).status).toBe(401);
    expect(kv.data.has(k)).toBe(true);
  });
});

describe("leads", () => {
  const idOf = async (email: string) => (await sealer(LEADS_KEY)!).id(email);
  const lead = async (email: string, at: string) =>
    (await recordLead({ INBOX: kv as never, LEADS_KEY }, email, { event: { at, kind: "inquiry", ref: `msg:${email}` }, name: email.split("@")[0] }))!;

  it("lists people newest first, opened from sealed metadata, behind the same gate", async () => {
    await lead("a@example.com", "2026-11-01T10:00:00Z");
    await lead("b@example.com", "2026-11-02T10:00:00Z");
    expect((await GET(req("GET", { key: null, query: "?leads" }))).status).toBe(401);
    const { leads } = await (await GET(req("GET", { query: "?leads" }))).json();
    expect(leads.map((l: { email: string }) => l.email)).toEqual(["b@example.com", "a@example.com"]);
    expect(leads[0].id).toBe(await idOf("b@example.com"));
    expect(leads[0].events).toBeUndefined();
  });

  it("stores nothing readable: no address in the key, value or metadata", async () => {
    await lead("a@example.com", "2026-11-01T10:00:00Z");
    const [[key, entry]] = [...kv.data.entries()].filter(([k]) => k.startsWith("lead:"));
    expect(key).toBe(`lead:${await idOf("a@example.com")}`);
    expect(JSON.stringify(entry)).not.toContain("example.com");
  });

  it("opens one with its timeline, and moves its stage, snooze and seen by hand", async () => {
    await lead("a@example.com", "2026-11-01T10:00:00Z");
    const key = `lead:${await idOf("a@example.com")}`;
    const one = await (await GET(req("GET", { query: `?key=${key}` }))).json();
    expect(one.lead.events).toHaveLength(1);
    const res = await PATCH(req("PATCH", { body: JSON.stringify({ key, stage: "Quoted", snoozeUntil: "2026-12-01T00:00:00Z", seen: true }) }));
    expect((await res.json()).lead).toMatchObject({ stage: "Quoted", snoozeUntil: "2026-12-01T00:00:00Z", unread: false });
    const { leads } = await (await GET(req("GET", { query: "?leads" }))).json();
    expect(leads[0]).toMatchObject({ stage: "Quoted", unread: false });
    // Marked unread again by hand.
    const again = await PATCH(req("PATCH", { body: JSON.stringify({ key, seen: false }) }));
    expect((await again.json()).lead).toMatchObject({ unread: true });
  });

  it("archives, trashes and recovers by hand, and empties only the trash, keeping Inbox rows", async () => {
    await seed(Date.UTC(2026, 9, 1), "row");
    await lead("a@example.com", "2026-11-01T10:00:00Z");
    await lead("b@example.com", "2026-11-02T10:00:00Z");
    const [a, b] = [`lead:${await idOf("a@example.com")}`, `lead:${await idOf("b@example.com")}`];
    const patch = async (key: string, body: object) => (await (await PATCH(req("PATCH", { body: JSON.stringify({ key, ...body }) }))).json()).lead;
    expect(await patch(a, { archive: true })).toHaveProperty("archivedAt");
    expect(await patch(a, { archive: false })).not.toHaveProperty("archivedAt");
    expect(await patch(a, { trash: true })).toHaveProperty("trashedAt");
    const back = await patch(a, { trash: false });
    expect(back).not.toHaveProperty("trashedAt");
    expect(back.events.map((e: { kind: string; note: string }) => `${e.kind} ${e.note}`).slice(-4)).toEqual(["archive in", "archive out", "trash in", "trash out"]);
    await patch(b, { trash: true });
    expect((await DELETE(req("DELETE", { key: null, body: JSON.stringify({ emptyTrash: true }) }))).status).toBe(401);
    expect(await (await DELETE(req("DELETE", { body: JSON.stringify({ emptyTrash: true }) }))).json()).toEqual({ ok: true, deleted: 1 });
    expect(kv.data.has(a)).toBe(true);
    expect(kv.data.has(b)).toBe(false);
    expect([...kv.data.keys()].some((k) => k.startsWith("msg:"))).toBe(true);
  });

  it("does not bring an emptied lead back on Import from Inbox", async () => {
    await seed(Date.UTC(2026, 9, 1), "spam");
    await seed(Date.UTC(2026, 9, 2), "keep");
    const post = async () => (await POST(req("POST", { body: JSON.stringify({ backfill: true }) }))).json();
    expect(await post()).toMatchObject({ added: 2 });
    const spam = `lead:${await idOf("spam@example.com")}`;
    await PATCH(req("PATCH", { body: JSON.stringify({ key: spam, trash: true }) }));
    await DELETE(req("DELETE", { body: JSON.stringify({ emptyTrash: true }) }));
    expect(kv.data.has(spam)).toBe(false);
    expect(await post()).toMatchObject({ added: 0, updated: 0 });
    expect(kv.data.has(spam)).toBe(false);
    expect([...kv.data.keys()].some((k) => k.startsWith("gone:") && k.includes("@"))).toBe(false);
  });

  it("does not bring a lead the 30-day sweep removed back on Import from Inbox", async () => {
    await seed(Date.UTC(2026, 9, 1), "old");
    const post = async () => (await POST(req("POST", { body: JSON.stringify({ backfill: true }) }))).json();
    expect(await post()).toMatchObject({ added: 1 });
    const key = `lead:${await idOf("old@example.com")}`;
    await PATCH(req("PATCH", { body: JSON.stringify({ key, trash: true }) }));
    vi.useFakeTimers({ now: Date.now() + 31 * 864e5, toFake: ["Date"] });
    expect((await (await GET(req("GET", { query: "?leads" }))).json()).leads).toHaveLength(0);
    vi.useRealTimers();
    expect(kv.data.has(key)).toBe(false);
    expect(await post()).toMatchObject({ added: 0, updated: 0 });
    expect(kv.data.has(key)).toBe(false);
  });

  it("deletes a lead 30 days after it went in the trash, when the list is read, keeping Inbox rows", async () => {
    await seed(Date.UTC(2026, 9, 1), "row");
    await lead("a@example.com", "2026-11-01T10:00:00Z");
    await lead("b@example.com", "2026-11-02T10:00:00Z");
    const [a, b] = [`lead:${await idOf("a@example.com")}`, `lead:${await idOf("b@example.com")}`];
    for (const k of [a, b]) await PATCH(req("PATCH", { body: JSON.stringify({ key: k, trash: true }) }));
    vi.useFakeTimers({ now: Date.now() + 29 * 864e5, toFake: ["Date"] });
    expect((await (await GET(req("GET", { query: "?leads" }))).json()).leads).toHaveLength(2);
    await PATCH(req("PATCH", { body: JSON.stringify({ key: b, trash: false }) }));
    vi.setSystemTime(Date.now() + 2 * 864e5);
    const { leads } = await (await GET(req("GET", { query: "?leads" }))).json();
    vi.useRealTimers();
    expect(leads.map((l: { email: string }) => l.email)).toEqual(["b@example.com"]);
    expect(kv.data.has(a)).toBe(false);
    expect([...kv.data.keys()].some((k) => k.startsWith("msg:"))).toBe(true);
  });

  it("backfills the Inbox: counts dry, then writes once, keeps every row, calls nothing outside", async () => {
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    await seed(Date.UTC(2026, 9, 1), "old");
    await seed(Date.UTC(2026, 9, 2), "old", { message: "Again" });
    await seed(Date.UTC(2026, 9, 3), "two");
    await lead("old@example.com", "2026-11-01T10:00:00Z");
    const msgs = [...kv.data.keys()].filter((k) => k.startsWith("msg:")).length;
    const post = async (b: object, key: string | null = KEY) => (await POST(req("POST", { key, body: JSON.stringify(b) }))).json();

    expect((await POST(req("POST", { key: null, body: JSON.stringify({ backfill: true }) }))).status).toBe(401);
    expect(await post({ backfill: true, dry: true })).toEqual({ dry: true, people: 2, added: 1, updated: 1, stages: { Inquiry: 1 } });
    expect([...kv.data.keys()].filter((k) => k.startsWith("lead:"))).toHaveLength(1);
    expect(await post({ backfill: true })).toMatchObject({ added: 1, updated: 1 });
    expect(await post({ backfill: true })).toMatchObject({ added: 0, updated: 0 });
    const old = (await (await GET(req("GET", { query: `?key=lead:${await idOf("old@example.com")}` }))).json()).lead;
    expect(old.firstAt).toBe(new Date(Date.UTC(2026, 9, 1)).toISOString());
    expect(old.events).toHaveLength(3);
    expect([...kv.data.keys()].filter((k) => k.startsWith("msg:"))).toHaveLength(msgs);
    expect(fetched).not.toHaveBeenCalled();
  });

  it("mirrors a stage to the person's Notion row, then reuses that row", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url.split("/v1")[1]} ${init.body}`);
      return url.endsWith("/query") ? Response.json({ results: [{ id: "row-1" }] }) : Response.json({ id: "row-1" });
    });
    ctx.env = { ...ctx.env, NOTION_TOKEN: "test" };
    await lead("a@example.com", "2026-11-01T10:00:00Z");
    const key = `lead:${await idOf("a@example.com")}`;
    await PATCH(req("PATCH", { body: JSON.stringify({ key, stage: "Quoted" }) }));
    await PATCH(req("PATCH", { body: JSON.stringify({ key, stage: "Shot" }) }));
    expect(calls).toEqual([
      expect.stringMatching(/^POST \/databases\/.+\/query .*a@example\.com/),
      'PATCH /pages/row-1 {"properties":{"Status":{"select":{"name":"Quoted"}}}}',
      'PATCH /pages/row-1 {"properties":{"Status":{"select":{"name":"Editing"}}}}',
    ]);
  });

  it("subscribes a device, pings it when a lead arrives, and forgets it when the push service says it is gone", async () => {
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"])) as CryptoKeyPair;
    const VAPID_KEY = JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey));
    expect((await GET(req("GET", { query: "?vapid" }))).status).toBe(503);
    ctx.env = { ...ctx.env, VAPID_KEY };
    expect((await (await GET(req("GET", { query: "?vapid" }))).json()).key).toMatch(/^[A-Za-z0-9_-]{87}$/);
    expect((await GET(req("GET", { key: null, query: "?vapid" }))).status).toBe(401);

    const ua = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
    const b64 = (u: ArrayBuffer | Uint8Array) => Buffer.from(u as ArrayBuffer).toString("base64url");
    const sub = { endpoint: "https://web.push.apple.com/dev-1", keys: { p256dh: b64(await crypto.subtle.exportKey("raw", ua.publicKey)), auth: b64(crypto.getRandomValues(new Uint8Array(16))) } };
    const patch = (body: object) => PATCH(req("PATCH", { body: JSON.stringify(body) }));
    expect((await patch({ push: { endpoint: "http://nope" } })).status).toBe(400);
    expect((await patch({ push: sub })).status).toBe(200);
    expect([...kv.data.keys()].filter((k) => k.startsWith("push:"))).toHaveLength(1);

    const sent: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => (sent.push({ url, init }), new Response(null, { status: 201 })));
    await recordLead({ INBOX: kv as never, LEADS_KEY, VAPID_KEY }, "maya@example.com", { event: { at: "2026-11-04T10:00:00Z", kind: "inquiry", ref: "msg:p1" }, name: "Maya" });
    await recordLead({ INBOX: kv as never, LEADS_KEY, VAPID_KEY }, "maya@example.com", { event: { at: "2026-11-04T10:01:00Z", kind: "mail", note: "x" } });
    expect(sent.map((x) => x.url)).toEqual(["https://web.push.apple.com/dev-1"]);
    expect(sent[0].init.headers).toMatchObject({ "content-encoding": "aes128gcm" });

    vi.stubGlobal("fetch", async () => new Response(null, { status: 410 }));
    await recordLead({ INBOX: kv as never, LEADS_KEY, VAPID_KEY }, "noor@example.com", { event: { at: "2026-11-04T11:00:00Z", kind: "booking", ref: "cal-9" }, name: "Noor" });
    expect([...kv.data.keys()].filter((k) => k.startsWith("push:"))).toHaveLength(0);

    await patch({ push: sub });
    expect((await patch({ push: { endpoint: sub.endpoint }, off: true })).status).toBe(200);
    expect([...kv.data.keys()].filter((k) => k.startsWith("push:"))).toHaveLength(0);
  });

  it("refuses an unknown stage, a bad time and a missing lead, and says when LEADS_KEY is unset", async () => {
    await lead("a@example.com", "2026-11-01T10:00:00Z");
    const key = `lead:${await idOf("a@example.com")}`;
    const patch = (b: object) => PATCH(req("PATCH", { body: JSON.stringify({ key, ...b }) }));
    expect((await patch({ stage: "Won" })).status).toBe(400);
    expect((await patch({ snoozeUntil: "soon" })).status).toBe(400);
    expect((await PATCH(req("PATCH", { body: JSON.stringify({ key: "lead:0000", seen: true }) }))).status).toBe(404);
    ctx.env = { INBOX: kv, INBOX_KEY: KEY };
    expect((await GET(req("GET", { query: "?leads" }))).status).toBe(503);
  });
});
