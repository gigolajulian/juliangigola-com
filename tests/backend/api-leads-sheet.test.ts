import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/leads/sheet/route";
import { forgetToken } from "@/lib/booking/gcal";
import { recordLead } from "@/lib/leads/lead-store";
import { SHEET_DIRTY } from "@/lib/leads/activity-log";
import { SHEET_ID } from "@/lib/leads/sheet-sync";
import { FakeKV, LEADS_KEY } from "./fakes";

/* /api/leads/sheet: the booking Worker's cron copies the desk to hello@'s Sheet.
   Only when the log changed or a day passed; KV is never written from Google. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const SECRET = "booking-secret-for-tests";
const OAUTH = JSON.stringify({ client_id: "c", client_secret: "s", refresh_token: "r" });
const call = (auth = `Bearer ${SECRET}`) => POST(new Request("https://juliangigola.com/api/leads/sheet", { method: "POST", headers: { authorization: auth } }));

let kv: FakeKV;
let sent: { url: string; body: string }[];
let status: number;
beforeEach(() => {
  forgetToken();
  kv = new FakeKV();
  sent = [];
  status = 200;
  ctx.env = { INBOX: kv, LEADS_KEY, BOOKING_SECRET: SECRET, GCAL_OAUTH: OAUTH };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 3600 });
    sent.push({ url, body: String(init?.body) });
    return url.endsWith("/spreadsheets") ? Response.json({ spreadsheetId: "S1" }) : Response.json({}, { status });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/leads/sheet", () => {
  it("refuses a wrong bearer, and is off without GCAL_OAUTH", async () => {
    expect((await call("Bearer wrong")).status).toBe(401);
    ctx.env = { ...ctx.env, GCAL_OAUTH: undefined };
    expect((await call()).status).toBe(503);
    expect(sent).toEqual([]);
  });

  it("makes the sheet once, copies both tabs after a change, then skips until the next one", async () => {
    await recordLead(ctx.env as never, "a@example.com", { event: { at: "2026-11-11T10:00:00Z", kind: "inquiry", ref: "msg:a" }, name: "Ana" });
    expect(await kv.get(SHEET_DIRTY)).toBe("1");
    expect(await (await call()).json()).toEqual({ sheet: "synced" });
    expect(sent.map((s) => s.url)).toEqual(["https://sheets.googleapis.com/v4/spreadsheets", "https://sheets.googleapis.com/v4/spreadsheets/S1:batchUpdate"]);
    const paste = JSON.parse(sent[1].body).requests.filter((r: { pasteData?: unknown }) => r.pasteData);
    expect(paste).toHaveLength(2);
    expect(paste[0].pasteData.data).toContain("a@example.com");
    expect(paste[1].pasteData.data).toContain("inquiry");
    expect(await kv.get(SHEET_DIRTY)).toBeNull();

    expect(await (await call()).json()).toEqual({ sheet: "clean" });
    expect(sent).toHaveLength(2);

    await recordLead(ctx.env as never, "a@example.com", { event: { at: "2026-11-11T11:00:00Z", kind: "payment", ref: "pi_1", amount: 100 } });
    expect(await (await call()).json()).toEqual({ sheet: "synced" });
    expect(sent.map((s) => s.url).at(-1)).toBe("https://sheets.googleapis.com/v4/spreadsheets/S1:batchUpdate");
    expect(sent).toHaveLength(3);
  });

  it("keeps the change marked when Google fails, and makes a new sheet if the old one was deleted", async () => {
    await recordLead(ctx.env as never, "a@example.com", { event: { at: "2026-11-11T10:00:00Z", kind: "inquiry", ref: "msg:a" } });
    status = 404;
    expect((await call()).status).toBe(502);
    expect(await kv.get(SHEET_DIRTY)).toBe("1");
    expect(await kv.get(SHEET_ID)).toBeNull();
  });
});
