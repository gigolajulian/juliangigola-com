import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeKV, LEADS_KEY, leadOf } from "./fakes";

/* The booking Worker's two calls into leads: /api/leads/mail logs a mail it
   sent, /api/leads/gmail folds hello@'s new mail in. Both take BOOKING_SECRET
   as the bearer and nothing else. */

const SECRET = "booking-secret-for-tests";
const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));
const { POST: mailPost } = await import("@/app/api/leads/mail/route");
const { POST: gmailPost } = await import("@/app/api/leads/gmail/route");

let kv: FakeKV;
beforeEach(() => {
  kv = new FakeKV();
  ctx.env = { INBOX: kv, LEADS_KEY, BOOKING_SECRET: SECRET, GCAL_OAUTH: JSON.stringify({ client_id: "c", client_secret: "s", refresh_token: "r" }) };
  vi.unstubAllGlobals();
});

const call = (route: (r: Request) => Promise<Response>, path: string, body: unknown, auth?: string) =>
  route(new Request(`https://juliangigola.com/api/leads/${path}`, { method: "POST", body: JSON.stringify(body), headers: auth ? { authorization: auth } : {} }));
const MAIL = { email: "client@example.com", subject: "See you tomorrow", kind: "reminder", booking: "bk_1" };

describe("POST /api/leads/mail", () => {
  it("refuses no bearer and a wrong one, and stores nothing", async () => {
    for (const auth of [undefined, "Bearer wrong-secret"]) {
      const res = await call(mailPost, "mail", MAIL, auth);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "No." });
    }
    expect(kv.puts).toEqual([]);
  });

  it("refuses a mail missing its email, subject or kind", async () => {
    for (const k of ["email", "subject", "kind"] as const) {
      const rest: Record<string, string> = { ...MAIL };
      delete rest[k];
      const res = await call(mailPost, "mail", rest, `Bearer ${SECRET}`);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Bad mail." });
    }
    expect(kv.puts).toEqual([]);
  });

  it("logs the mail on the person's lead", async () => {
    const res = await call(mailPost, "mail", MAIL, `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ logged: true });
    const lead = await leadOf(kv, MAIL.email);
    const ev = lead!.events.find((e) => e.kind === "mail")!;
    expect(ev.note).toBe(MAIL.subject);
    expect(ev.mail).toMatchObject({ to: "client", kind: "reminder", booking: "bk_1" });
  });
});

describe("POST /api/leads/gmail", () => {
  it("refuses no bearer and a wrong one", async () => {
    for (const auth of [undefined, "Bearer wrong-secret"]) {
      const res = await call(gmailPost, "gmail", {}, auth);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "No." });
    }
  });

  it("is off without GCAL_OAUTH or LEADS_KEY", async () => {
    const full = ctx.env;
    for (const k of ["GCAL_OAUTH", "LEADS_KEY"]) {
      ctx.env = { ...full, [k]: undefined };
      const res = await call(gmailPost, "gmail", {}, `Bearer ${SECRET}`);
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "Not set up." });
    }
  });

  it("answers 502 when Google can't be reached", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("network down");
    });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(gmailPost, "gmail", {}, `Bearer ${SECRET}`);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Gmail sync failed." });
    quiet.mockRestore();
  });
});
