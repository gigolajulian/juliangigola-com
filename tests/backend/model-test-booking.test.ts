import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeEmail, FakeKV, FakeStore, fakeLock } from "./fakes";
import { forgetToken } from "@/lib/booking/gcal";
import { BookingLock } from "@/worker/booking-lock";

/* Model test end to end on the server, every outside service faked:
   /api/deposit makes the $100 intent, Stripe's webhook books it
   (`bookDeposit`), Google gets an hour, the client gets "You're in.",
   and Notion gets a Confirmed row with Shoot Type "Model Test". */

vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-11-11T20:00:00Z"));

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env, ctx: { waitUntil: (p: Promise<unknown>) => p } }) }));
const { POST: deposit } = await import("@/app/api/deposit/route");
const { bookDeposit } = await import("@/lib/booking/deposit");

const START = "2026-11-18T18:00:00.000Z"; // Wednesday 10 AM Pacific, a week out
const PI = "pi_TEST1234567890";
const GCAL = JSON.stringify({ client_id: "a", client_secret: "b", refresh_token: "c" });

let inserts: Record<string, unknown>[];
let intents: URLSearchParams[];
let notion: { url: string; body: { properties?: Record<string, unknown> } }[];
let client: FakeEmail;

beforeEach(() => {
  forgetToken();
  inserts = [];
  intents = [];
  notion = [];
  client = new FakeEmail();
  ctx.env = {
    GCAL_OAUTH: GCAL,
    BOOKING_LOCK: fakeLock(new BookingLock({ storage: new FakeStore() }, { GCAL_OAUTH: GCAL })),
    INBOX: new FakeKV(),
    CLIENT_EMAIL: client,
    EMAIL: new FakeEmail(),
    NOTION_TOKEN: "t",
    STRIPE_SECRET_KEY: "sk_test_x",
    DEPOSIT_LIMIT: { limit: async () => ({ success: true }) },
  };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 3600 });
    if (url.includes("/freeBusy")) return Response.json({ calendars: { primary: { busy: [] } } });
    if (url.includes("/events?q=") || (url.includes("/events") && !init?.body)) return Response.json({ items: [] });
    if (url.includes("/events")) {
      inserts.push(JSON.parse(String(init?.body)));
      return Response.json({ id: "ev1" });
    }
    if (url.endsWith("/payment_intents")) {
      intents.push(new URLSearchParams(String(init?.body)));
      return Response.json({ id: PI, client_secret: `${PI}_secret_x` });
    }
    if (url.startsWith("https://api.notion.com")) {
      notion.push({ url, body: JSON.parse(String(init?.body)) });
      return Response.json(url.endsWith("/query") ? { results: [] } : { id: "page-1" });
    }
    if (url.startsWith("https://api.stripe.com")) return Response.json({ id: PI, status: "succeeded" });
    return Response.json({}, { status: 404 });
  });
});

describe("Model test, booked with the $100 deposit", () => {
  it("makes the intent, books an hour, mails the client and files Notion", async () => {
    const res = await deposit(new Request("https://juliangigola.com/api/deposit", {
      method: "POST",
      body: JSON.stringify({ engine: "own", slug: "model-test", start: START, timeZone: "America/Los_Angeles", name: "QA Test", email: "qa@example.com", phone: "+14085550100", where: "Studio" }),
    }));
    expect(res.status).toBe(200);
    expect(intents[0].get("amount")).toBe("10000");
    expect(intents[0].get("metadata[slug]")).toBe("model-test");

    const meta = { kind: "deposit", engine: "own", slug: "model-test", start: START, timeZone: "America/Los_Angeles", name: "QA Test", email: "qa@example.com", where: "Studio" };
    expect(await bookDeposit(ctx.env as never, PI, meta)).toBe("booked");

    expect(inserts).toHaveLength(1);
    const ev = inserts[0] as { summary: string; start: { dateTime: string }; end: { dateTime: string }; description: string };
    expect(ev.summary).toBe("Model test: QA Test");
    expect(Date.parse(ev.end.dateTime) - Date.parse(ev.start.dateTime)).toBe(60 * 6e4);
    expect(ev.description).toContain(PI);

    expect(client.sent).toHaveLength(1);
    const m = client.sent[0];
    expect(m.subject).toBe("Booked: Model test, Wed, Nov 18, 10:00 to 11:00 AM PST");
    expect(String(m.text)).toContain("60 minutes");
    expect(String(m.text)).toContain("Ref: pi_TEST1234");

    const row = notion.find((n) => n.url.endsWith("/pages"))!;
    expect(row.body.properties).toMatchObject({ "Shoot Type": { select: { name: "Model Test" } }, Status: { select: { name: "Confirmed" } } });
  });
});
