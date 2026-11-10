import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH, POST } from "@/app/api/inbox/route";
import { enquiry, enquiryKey, summary } from "@/lib/inbox";
import { FakeKV, LEADS_KEY } from "./fakes";

/* /api/inbox: the gate on every verb, bad bodies refused, and the list and
   read flag as the desk uses them. The rest is in api-inbox.test.ts. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const KEY = "inbox-key-for-tests";
const req = (method: string, body?: string, key: string | null = KEY, query = "") =>
  new Request(`https://juliangigola.com/api/inbox${query}`, { method, body, headers: key ? { "x-inbox-key": key } : {} });

let kv: FakeKV;
let k: string;
beforeEach(async () => {
  kv = new FakeKV();
  ctx.env = { INBOX: kv, INBOX_KEY: KEY, LEADS_KEY };
  const e = enquiry({ type: "portrait", name: "QA Test", email: "qa@example.com", detail: "", message: "Hello" }, 1_000, "aaaaaaaa");
  k = enquiryKey(1_000, "aaaaaaaa");
  await kv.put(k, JSON.stringify(e), { metadata: summary(e) });
  kv.puts = [];
});

describe("/api/inbox", () => {
  it("is off without the INBOX binding", async () => {
    ctx.env = { INBOX_KEY: KEY };
    expect((await GET(req("GET"))).status).toBe(503);
  });

  it("refuses every verb without the key", async () => {
    for (const res of [await GET(req("GET", undefined, null)), await PATCH(req("PATCH", "{}", null)), await POST(req("POST", "{}", "wrong")), await DELETE(req("DELETE", "{}", null))])
      expect(res.status).toBe(401);
    expect(kv.puts).toEqual([]);
  });

  it("refuses bodies that are not JSON or not a message", async () => {
    expect((await PATCH(req("PATCH", "nope"))).status).toBe(400);
    expect((await DELETE(req("DELETE", "nope"))).status).toBe(400);
    expect((await POST(req("POST", JSON.stringify({ backfill: false })))).status).toBe(400);
    expect((await GET(req("GET", undefined, KEY, "?key=cool:x"))).status).toBe(400);
  });

  it("lists the message, opens it, and marks it read", async () => {
    const list = await GET(req("GET"));
    expect(list.headers.get("cache-control")).toContain("no-store");
    expect((await list.json()).rows).toEqual([expect.objectContaining({ key: k, name: "QA Test", read: false })]);
    expect((await (await GET(req("GET", undefined, KEY, `?key=${k}`))).json())).toMatchObject({ enquiry: { message: "Hello" } });
    expect((await PATCH(req("PATCH", JSON.stringify({ key: k, read: true })))).status).toBe(200);
    expect((await (await GET(req("GET"))).json()).rows[0].read).toBe(true);
  });
});
