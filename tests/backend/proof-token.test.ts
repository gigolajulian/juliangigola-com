import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeKV, LEADS_KEY, reply } from "./fakes";
import { sealer } from "@/lib/lead-crypto";
import { readProof, writeProof, type Proof } from "@/lib/proofs";

/* The client's side of a proof gallery (`app/api/proof/[token]`): PATCH saves
   picks under the typed email, POST {confirm} locks the selects only for a paid
   Checkout session for this gallery that covers what is owed. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));
const { PATCH, POST } = await import("@/app/api/proof/[token]/route");

const TOKEN = "AbCdEfGh12345678";
const OTHER = "ZzZzZzZz87654321";
let kv: FakeKV;
let session: Record<string, unknown>;
const seal = async () => (await sealer(LEADS_KEY))!;
beforeEach(async () => {
  kv = new FakeKV();
  ctx.env = { INBOX: kv, LEADS_KEY, STRIPE_SECRET_KEY: "sk_test_x", DEPOSIT_LIMIT: { limit: async () => ({ success: true }) } };
  // Two selects, one included at $15: $15 owed.
  const p = { token: TOKEN, name: "Test", included: 1, price: 15, days: 14, createdAt: new Date().toISOString(), frames: ["a", "b", "c"].map((id) => ({ id, file: `${id}.jpg`, w: 1, h: 1 })), selects: ["a", "b"], notes: {}, views: 0 };
  await writeProof(kv as never, await seal(), p as Proof);
  session = { id: "cs_test_x", status: "complete", payment_status: "paid", amount_total: 1500, metadata: { proof: TOKEN } };
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/checkout/sessions/cs_test_x")) return reply(session);
    throw new Error(`unexpected fetch ${url}`);
  });
});

const req = (method: string, body: unknown) => new Request("https://juliangigola.com/api/proof/x", { method, body: JSON.stringify(body) });
const patch = (body: unknown, token = TOKEN) => PATCH(req("PATCH", body), { params: Promise.resolve({ token }) });
const post = (body: unknown, token = TOKEN) => POST(req("POST", body), { params: Promise.resolve({ token }) });
const stored = async () => (await readProof(kv as never, await seal(), TOKEN))!;

describe("/api/proof/[token]", () => {
  it("answers 404 for a gallery that does not exist", async () => {
    for (const res of [await patch({ email: "a@example.com", selects: ["a"] }, OTHER), await post({ confirm: "cs_test_x" }, OTHER)]) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "This gallery closed." });
    }
  });

  it("PATCH needs an email", async () => {
    const res = await patch({ selects: ["c"] });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Add your email first." });
    expect((await stored()).selects).toEqual(["a", "b"]);
  });

  it("PATCH saves the picks, dropping frames that do not exist", async () => {
    const res = await patch({ email: "Client@Example.com", selects: ["c", "a", "nope"] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const p = await stored();
    expect(p.selects).toEqual(["c", "a"]);
    expect(p.viewers?.["client@example.com"]?.picks).toEqual(["c", "a"]);
  });

  it("POST confirm locks the selects for a paid session", async () => {
    const res = await post({ confirm: "cs_test_x" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ done: true, submitted: true, paid: 1500, selects: ["a", "b"] });
    const p = await stored();
    expect(p.submittedAt).toBeTruthy();
    expect(p.paid).toMatchObject({ session: "cs_test_x", amount: 1500 });
  });

  it("POST confirm refuses an unpaid session and locks nothing", async () => {
    session = { ...session, status: "open", payment_status: "unpaid" };
    const res = await post({ confirm: "cs_test_x" });
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: "That payment did not go through." });
    expect((await stored()).submittedAt).toBeUndefined();
  });
});
