import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/cal/route";
import { FakeKV, LEADS_KEY } from "./fakes";

/* /api/cal: Cal.com's webhook. Off without its secret, refuses a bad
   signature and a body that is not JSON, and files a signed booking. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown>, waits: [] as Promise<unknown>[] }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env, ctx: { waitUntil: (p: Promise<unknown>) => void ctx.waits.push(p) } }) }));

const SECRET = "test-webhook-secret";
async function sign(body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const post = async (body: string, sig?: string) =>
  POST(new Request("https://juliangigola.com/api/cal", { method: "POST", body, headers: { "x-cal-signature-256": sig ?? (await sign(body)) } }));

const BOOKING = JSON.stringify({
  triggerEvent: "BOOKING_CREATED",
  payload: { eventTitle: "Portraits", startTime: "2026-12-17T21:00:00Z", attendees: [{ name: "QA Test", email: "qa@example.com" }] },
});

let kv: FakeKV;
beforeEach(() => {
  kv = new FakeKV();
  ctx.waits = [];
  ctx.env = { CAL_WEBHOOK_SECRET: SECRET, INBOX: kv, LEADS_KEY };
});

describe("POST /api/cal", () => {
  it("is off without the secret", async () => {
    ctx.env = { INBOX: kv };
    expect((await post(BOOKING)).status).toBe(503);
  });

  it("refuses a missing or wrong signature, and stores nothing", async () => {
    expect((await post(BOOKING, "")).status).toBe(401);
    expect((await post(BOOKING, "0".repeat(64))).status).toBe(401);
    expect(kv.puts).toEqual([]);
  });

  it("refuses a signed body that is not JSON, and acknowledges other events", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post(JSON.stringify({ triggerEvent: "BOOKING_CANCELLED" }))).status).toBe(200);
    expect(kv.puts).toEqual([]);
  });

  it("files a signed booking in the inbox", async () => {
    const res = await post(BOOKING);
    expect(res.status).toBe(200);
    await Promise.all(ctx.waits);
    const row = [...kv.data.keys()].find((k) => k.startsWith("msg:"));
    expect(row).toBeDefined();
    expect(kv.json(row!)).toMatchObject({ name: "QA Test", email: "qa@example.com" });
  });
});
