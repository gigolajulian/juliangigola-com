import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/deposit/[id]/route";
import { FakeKV, reply } from "./fakes";

/* /api/deposit/[id]: the status poll (no personal data) and the references
   sent with a live deposit. A made-up id or a settled intent is a 404. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const PI = "pi_TEST1234567890";
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const url = (id: string) => `https://juliangigola.com/api/deposit/${id}`;
let intent: { amount: number; currency: string; metadata: Record<string, string> };
let kv: FakeKV;
beforeEach(() => {
  kv = new FakeKV();
  intent = { amount: 10000, currency: "usd", metadata: { kind: "deposit" } };
  ctx.env = { INBOX: kv, STRIPE_SECRET_KEY: "sk_test_x", DEPOSIT_LIMIT: { limit: async () => ({ success: true }) } };
  vi.stubGlobal("fetch", async (u: string) => (u.endsWith(`/payment_intents/${PI}`) ? reply({ id: PI, ...intent }) : reply({ error: {} }, 404)));
});
afterEach(() => vi.unstubAllGlobals());

const put = (form: FormData, id = PI) => PUT(new Request(url(id), { method: "PUT", body: form }), params(id));

describe("GET /api/deposit/[id]", () => {
  it("is a 404 for a malformed id, an unknown one, and another kind of payment", async () => {
    expect((await GET(new Request(url("x")), params("../x"))).status).toBe(404);
    expect((await GET(new Request(url("pi_OTHER1234567890")), params("pi_OTHER1234567890"))).status).toBe(404);
    intent.metadata = {};
    expect((await GET(new Request(url(PI)), params(PI))).status).toBe(404);
  });

  it("is pending until the webhook settles it, then booked with the time only", async () => {
    expect(await (await GET(new Request(url(PI)), params(PI))).json()).toEqual({ status: "pending" });
    intent.metadata = { kind: "deposit", outcome: "booked", cal_uid: "uid1", cal_start: "2026-12-02T18:00:00Z", email: "qa@example.com" };
    expect(await (await GET(new Request(url(PI)), params(PI))).json()).toEqual({ status: "booked", booking: { uid: "uid1", start: "2026-12-02T18:00:00Z" } });
  });
});

describe("PUT /api/deposit/[id]", () => {
  it("refuses a malformed id, a settled deposit, and a body that is not a form", async () => {
    expect((await put(new FormData(), "nope")).status).toBe(404);
    intent.metadata = { kind: "deposit", outcome: "booked" };
    expect((await put(new FormData())).status).toBe(404);
    intent.metadata = { kind: "deposit" };
    expect((await PUT(new Request(url(PI), { method: "PUT", body: "x" }), params(PI))).status).toBe(400);
    expect(kv.puts).toEqual([]);
  });

  it("tells Stripe being down from an unknown deposit", async () => {
    expect((await put(new FormData(), "pi_OTHER1234567890")).status).toBe(404);
    vi.stubGlobal("fetch", async () => reply({ error: {} }, 500));
    expect((await put(new FormData())).status).toBe(502);
  });

  it("keeps the site picks and a file beside the intent", async () => {
    const form = new FormData();
    form.set("picks", "/work/sago/01.jpg\n../etc/passwd");
    form.append("refs", new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "ref.jpg", { type: "image/jpeg" }));
    const res = await put(form);
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.picks).toBe(1);
    expect(kv.puts.length).toBe(out.files + 1);
  });
});
