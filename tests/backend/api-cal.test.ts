import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeKV } from "./fakes";

/* Cal.com's booking webhook (`app/api/cal/route.ts`): only a body signed
   with CAL_WEBHOOK_SECRET gets into the inbox, and a new booking lands
   there as a "booking" row with its summary. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const { POST } = await import("@/app/api/cal/route");

const SECRET = "test-webhook-secret";

async function sign(body: string, secret = SECRET) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const post = (body: string, sig?: string) =>
  POST(new Request("https://juliangigola.com/api/cal", { method: "POST", body, headers: sig === undefined ? {} : { "x-cal-signature-256": sig } }));

const BOOKING = {
  triggerEvent: "BOOKING_CREATED",
  payload: {
    eventTitle: "Portraits",
    startTime: "2026-10-17T21:00:00Z",
    location: "Studio",
    additionalNotes: "Two looks",
    attendees: [{ name: "QA Test", email: "qa@example.com" }],
  },
};

let kv: FakeKV;
beforeEach(() => {
  kv = new FakeKV();
  ctx.env = { CAL_WEBHOOK_SECRET: SECRET, INBOX: kv };
});

describe("POST /api/cal", () => {
  it("refuses everything while the secret is unset", async () => {
    ctx.env = { INBOX: kv };
    const body = JSON.stringify(BOOKING);
    expect((await post(body, await sign(body))).status).toBe(503);
    expect(kv.puts).toEqual([]);
  });

  it("refuses everything without the INBOX binding", async () => {
    ctx.env = { CAL_WEBHOOK_SECRET: SECRET };
    const body = JSON.stringify(BOOKING);
    expect((await post(body, await sign(body))).status).toBe(503);
  });

  it("refuses a missing, malformed or wrong signature", async () => {
    const body = JSON.stringify(BOOKING);
    expect((await post(body)).status).toBe(401);
    expect((await post(body, "not-hex")).status).toBe(401);
    expect((await post(body, await sign(body, "someone-else"))).status).toBe(401);
    expect((await post(body + " ", await sign(body))).status).toBe(401);
    expect(kv.puts).toEqual([]);
  });

  it("answers 400 to a signed body that is not JSON", async () => {
    const body = "{not json";
    expect((await post(body, await sign(body))).status).toBe(400);
  });

  it("acknowledges a PING and other triggers without storing them", async () => {
    for (const triggerEvent of ["PING", "BOOKING_CANCELLED"]) {
      const body = JSON.stringify({ triggerEvent });
      const res = await post(body, await sign(body));
      expect(res.status).toBe(200);
    }
    expect(kv.puts).toEqual([]);
  });

  it("stores a new booking as a booking row, with its summary as metadata", async () => {
    const body = JSON.stringify(BOOKING);
    const res = await post(body, await sign(body));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const [key] = kv.puts;
    expect(key).toMatch(/^msg:\d{15}:[0-9a-f]{8}$/);
    const stored = kv.json(key);
    expect(stored).toMatchObject({ type: "booking", name: "QA Test", email: "qa@example.com", read: false });
    expect(stored.detail).toMatch(/^Portraits · Sat, Oct 17, 2:00\s?PM PDT$/);
    expect(stored.message).toBe("Two looks\n\nLocation: Studio");
    expect(kv.data.get(key)!.metadata).toMatchObject({ type: "booking", name: "QA Test", detail: stored.detail });
  });

  it("names an attendee with no name Unknown rather than dropping the booking", async () => {
    const body = JSON.stringify({ triggerEvent: "BOOKING_CREATED", payload: {} });
    expect((await post(body, await sign(body))).status).toBe(200);
    expect(kv.json(kv.puts[0])).toMatchObject({ name: "Unknown", type: "booking", message: "Booked on Cal.com. No notes." });
  });

  it("answers 500 when the write fails, so Cal.com retries", async () => {
    kv.broken = true;
    const body = JSON.stringify(BOOKING);
    await expect(post(body, await sign(body))).rejects.toThrow();
  });
});

describe("the four paid sessions", () => {
  const PI = "pi_TEST1234567890";
  let mails: { subject: string }[];
  let paid: boolean;
  beforeEach(() => {
    mails = [];
    paid = true;
    ctx.env = { ...ctx.env, STRIPE_SECRET_KEY: "sk_test_x", EMAIL: { send: async (m: { subject: string }) => void mails.push(m) } };
    vi.stubGlobal("fetch", async () =>
      Response.json({ status: paid ? "succeeded" : "requires_payment_method", amount: 10000, currency: "usd", metadata: { kind: "deposit", email: "qa@example.com", start: BOOKING.payload.startTime } }),
    );
  });
  const book = async (extra: object) => {
    const body = JSON.stringify({ ...BOOKING, payload: { ...BOOKING.payload, type: "portraits", ...extra } });
    expect((await post(body, await sign(body))).status).toBe(200);
    return kv.json(kv.puts[0]);
  };

  it("are marked paid when Stripe confirms the deposit", async () => {
    const row = await book({ metadata: { deposit: PI } });
    expect(row.deposit).toBe(`https://dashboard.stripe.com/test/payments/${PI}`);
    expect(row.noDeposit).toBeUndefined();
    expect(mails).toEqual([]);
  });

  it("are flagged, and Julian told, when booked with no deposit", async () => {
    paid = false;
    const row = await book({ metadata: { deposit: PI } });
    expect(row.deposit).toBeUndefined();
    expect(row.noDeposit).toBe(true);
    expect(mails[0].subject).toMatch(/^Booked without a deposit: Portraits, .+, QA Test$/);
  });

  it("are not called unpaid when Stripe cannot be asked", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ error: {} }, { status: 500 }));
    const row = await book({ metadata: { deposit: PI } });
    expect(row.deposit).toBeUndefined();
    expect(row.noDeposit).toBeUndefined();
    expect(mails).toEqual([]);
  });

  it("mail nothing when the Inbox write fails, so Cal.com's retry mails once", async () => {
    paid = false;
    kv.broken = true;
    const body = JSON.stringify({ ...BOOKING, payload: { ...BOOKING.payload, type: "portraits" } });
    await expect(post(body, await sign(body))).rejects.toThrow();
    expect(mails).toEqual([]);
  });

  it("leave the free calls alone", async () => {
    const row = await book({ type: "wedding-call" });
    expect(row.noDeposit).toBeUndefined();
    expect(mails).toEqual([]);
  });

  describe("the client's confirmation", () => {
    let sent: { to: { email: string }; subject: string; text: string }[];
    beforeEach(() => {
      sent = [];
      ctx.env.CLIENT_EMAIL = { send: async (m: (typeof sent)[0]) => void sent.push(m) };
    });

    it("goes out for a free call, with no deposit block", async () => {
      await book({ type: "wedding-call", eventTitle: "Wedding call", uid: "call_uid", endTime: "2026-10-17T21:30:00Z", location: "integrations:daily" });
      expect(sent).toHaveLength(1);
      expect(sent[0].to.email).toBe("qa@example.com");
      expect(sent[0].subject).toMatch(/^Booked: Wedding call, Sat, Oct 17, 2:00 to 2:30 PM PDT$/);
      expect(sent[0].text).toContain("Your wedding call is booked. I'll call you then.");
      expect(sent[0].text).not.toContain("Deposit");
      expect(sent[0].text).not.toContain("integrations:");
    });

    it("never goes out from here for a paid session, paid or not", async () => {
      await book({ uid: "u1", metadata: { deposit: PI } });
      paid = false;
      await book({ uid: "u2" });
      expect(sent).toEqual([]);
    });
  });

  it("copies a booking onto the Notion board, and still answers when Notion fails", async () => {
    const calls: { url: string; body: { parent: unknown; properties: unknown } }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return new Response("down", { status: 500 });
    });
    ctx.env = { ...ctx.env, NOTION_TOKEN: "test" };
    const body = JSON.stringify({ ...BOOKING, payload: { ...BOOKING.payload, type: "headshots", uid: "cal-1" } });
    expect((await post(body, await sign(body))).status).toBe(200);
    expect(kv.puts).toHaveLength(1);
    const p = calls.find((c) => c.url.includes("api.notion.com"))!.body.properties;
    expect(p).toMatchObject({
      Status: { select: { name: "Confirmed" } },
      "Shoot Type": { select: { name: "Headshots" } },
      "Cal UID": { rich_text: [{ text: { content: "cal-1" } }] },
      "Contact Email": { email: "qa@example.com" },
    });
    vi.unstubAllGlobals();
  });
});
