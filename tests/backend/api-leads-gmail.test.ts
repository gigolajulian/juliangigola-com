import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/leads/gmail/route";
import { forgetToken } from "@/lib/google";
import { CURSOR } from "@/lib/leads/sync/gmail-sync";
import { FakeKV, LEADS_KEY } from "./fakes";
import { sealer } from "@/lib/leads/lead-crypto";
import { personKey, readLead, writeLead } from "@/lib/leads/lead-store";
import { applyLeadEvent } from "@/lib/leads/leads";

/* /api/leads/gmail: the booking Worker's cron, WORKER_KEY as bearer.
   The first run only records where Gmail's history stands. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("./fakes")).cloudflareMock(ctx));

const SECRET = "worker-key-for-tests";
const OAUTH = JSON.stringify({ client_id: "c", client_secret: "s", refresh_token: "r" });
const call = (auth?: string) => POST(new Request("https://juliangigola.com/api/leads/gmail", { method: "POST", headers: auth ? { authorization: auth } : {} }));

let kv: FakeKV;
beforeEach(() => {
  forgetToken();
  kv = new FakeKV();
  ctx.env = { INBOX: kv, LEADS_KEY, WORKER_KEY: SECRET, GCAL_OAUTH: OAUTH };
  vi.stubGlobal("fetch", async (url: string) =>
    url.includes("oauth2") ? Response.json({ access_token: "t", expires_in: 3600 }) : url.endsWith("/profile") ? Response.json({ historyId: "4242" }) : Response.json({}, { status: 404 }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/leads/gmail", () => {
  it("refuses no bearer, a wrong one, and every call while the secret is unset", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    ctx.env = { ...ctx.env, WORKER_KEY: undefined };
    expect((await call(`Bearer ${SECRET}`)).status).toBe(401);
    expect(kv.puts).toEqual([]);
  });

  it("is off without GCAL_OAUTH", async () => {
    ctx.env = { ...ctx.env, GCAL_OAUTH: undefined };
    expect((await call(`Bearer ${SECRET}`)).status).toBe(503);
  });

  it("starts the history cursor on its first run", async () => {
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ folded: 0 });
    expect(await kv.get(CURSOR)).toBe("4242");
  });

  it("skips a message deleted since history listed it, and moves the cursor past it", async () => {
    await kv.put(CURSOR, "100");
    vi.stubGlobal("fetch", async (url: string) =>
      url.includes("oauth2")
        ? Response.json({ access_token: "t", expires_in: 3600 })
        : url.includes("/history")
          ? Response.json({ history: [{ id: "101", messagesAdded: [{ message: { id: "gone" } }] }], historyId: "101" })
          : Response.json({ error: { message: "Requested entity was not found." } }, { status: 404 }),
    );
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await kv.get(CURSOR)).not.toBe("100");
  });

  it("folds mail from a person on a lead into that lead, and skips a stranger", async () => {
    const s = await sealer(LEADS_KEY)!;
    const id = await s.id("brand@example.com");
    await writeLead(kv as never, s, id, { ...applyLeadEvent(null, "brand@example.com", { event: { at: "2026-11-15T10:00:00Z", kind: "inquiry" } }), people: [{ name: "Ana", email: "ana@agency.com" }] });
    await kv.put(personKey(await s.id("ana@agency.com")), id);
    await kv.put(CURSOR, "100");
    const msg = (mid: string, from: string) => ({ id: mid, labelIds: ["INBOX"], internalDate: String(Date.UTC(2026, 10, 15, 12)), payload: { headers: [{ name: "From", value: from }, { name: "Subject", value: "Shot list" }] } });
    vi.stubGlobal("fetch", async (url: string) =>
      url.includes("oauth2")
        ? Response.json({ access_token: "t", expires_in: 3600 })
        : url.includes("/history")
          ? Response.json({ history: [{ id: "101", messagesAdded: [{ message: { id: "m1" } }, { message: { id: "m2" } }] }], historyId: "101" })
          : Response.json(url.includes("/messages/m1") ? msg("m1", "Ana Diaz <ana@agency.com>") : msg("m2", "news@shop.com")),
    );
    expect(await (await call(`Bearer ${SECRET}`)).json()).toEqual({ folded: 1 });
    expect((await readLead(kv as never, s, id))?.events.map((e) => e.kind)).toEqual(["inquiry", "wrote"]);
    expect(await readLead(kv as never, s, await s.id("ana@agency.com"))).toBeNull();
  });
});
