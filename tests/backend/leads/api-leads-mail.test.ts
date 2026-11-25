import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/leads/mail/route";
import { FakeKV, LEADS_KEY, leadOf } from "../fakes";

/* /api/leads/mail: the booking Worker reports a mail it sent, with
   WORKER_KEY as bearer; it lands on the person's lead. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("../fakes")).cloudflareMock(ctx));

const SECRET = "worker-key-for-tests";
const MAIL = { email: "client@example.com", subject: "See you tomorrow", kind: "reminder", booking: "bk_1" };
const call = (body: unknown, auth?: string) =>
  POST(
    new Request("https://juliangigola.com/api/leads/mail", {
      method: "POST",
      body: JSON.stringify(body),
      headers: auth ? { authorization: auth } : {},
    }),
  );

let kv: FakeKV;
beforeEach(() => {
  kv = new FakeKV();
  ctx.env = { INBOX: kv, LEADS_KEY, WORKER_KEY: SECRET, BOOKING_SECRET: "the-link-secret" };
});

describe("POST /api/leads/mail", () => {
  it("refuses no bearer and a wrong one", async () => {
    expect((await call(MAIL)).status).toBe(401);
    expect((await call(MAIL, "Bearer nope")).status).toBe(401);
    // the link secret is not the Worker's bearer
    expect((await call(MAIL, "Bearer the-link-secret")).status).toBe(401);
    expect(kv.puts).toEqual([]);
  });

  it("refuses a mail with a missing or non-string field", async () => {
    expect((await call({ ...MAIL, subject: 3 }, `Bearer ${SECRET}`)).status).toBe(400);
    expect((await call(null, `Bearer ${SECRET}`)).status).toBe(400);
    expect(kv.puts).toEqual([]);
  });

  it("logs the mail on the lead", async () => {
    const res = await call(MAIL, `Bearer ${SECRET}`);
    expect(await res.json()).toEqual({ logged: true });
    const lead = await leadOf(kv, MAIL.email);
    expect(JSON.stringify(lead)).toContain("See you tomorrow");
  });
});
