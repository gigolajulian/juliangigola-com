import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { summary, enquiry, enquiryKey } from "@/lib/inbox";
import { FakeKV, githubToken, reply } from "./fakes";

/* /admin's inbox (`app/api/inbox/route.ts`): somebody's name, email and
   message, so the gate is the point. Either the INBOX_KEY or a GitHub
   token that can push opens it; nothing is ever cacheable. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const { GET, PATCH, DELETE } = await import("@/app/api/inbox/route");

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
  ctx.env = { INBOX: kv, INBOX_KEY: KEY };
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
    const fetch = vi.fn(async () => reply({ permissions: { push: true } }));
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
