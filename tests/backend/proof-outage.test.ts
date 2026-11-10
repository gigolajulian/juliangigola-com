import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeKV, LEADS_KEY } from "./fakes";
import { sealer } from "@/lib/lead-crypto";
import { readProof, writeProof, type Proof } from "@/lib/proofs";

/* Confirming a proof payment while Stripe is down: the client is told payments
   are down (502), not that their payment failed, and nothing is locked. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));
const { POST } = await import("@/app/api/proof/[token]/route");

const TOKEN = "AbCdEfGh12345678";
let kv: FakeKV;
const seal = async () => (await sealer(LEADS_KEY))!;
beforeEach(async () => {
  kv = new FakeKV();
  ctx.env = { INBOX: kv, LEADS_KEY, STRIPE_SECRET_KEY: "sk_test_x", DEPOSIT_LIMIT: { limit: async () => ({ success: true }) } };
  const p = { token: TOKEN, name: "Test", included: 1, price: 15, days: 14, createdAt: new Date().toISOString(), frames: ["a", "b"].map((id) => ({ id, file: `${id}.jpg`, w: 1, h: 1 })), selects: ["a", "b"], notes: {}, views: 0 };
  await writeProof(kv as never, await seal(), p as Proof);
});

const confirm = () => POST(new Request("https://juliangigola.com/api/proof/x", { method: "POST", body: JSON.stringify({ confirm: "cs_test_x" }) }), { params: Promise.resolve({ token: TOKEN }) });

describe("/api/proof/[token] confirm when Stripe cannot answer", () => {
  it("says payments are down on a Stripe 500, and locks nothing", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ error: { message: "boom" } }, { status: 500 }));
    const res = await confirm();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Payments are down right now. Try again in a few minutes." });
    expect((await readProof(kv as never, await seal(), TOKEN))!.submittedAt).toBeUndefined();
  });

  it("says payments are down when Stripe does not answer at all", async () => {
    vi.stubGlobal("fetch", async () => { throw new TypeError("fetch failed"); });
    expect((await confirm()).status).toBe(502);
  });

  it("still says the payment did not go through when Stripe has no such session", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ error: { message: "No such session" } }, { status: 404 }));
    const res = await confirm();
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: "That payment did not go through." });
  });
});

/* The same outage on the way back from Checkout (/proof/<token>?paid=<session>), the path clients actually take. */
const { default: ProofPage } = await import("@/app/proof/[token]/page");
const open = async () => (await ProofPage({ params: Promise.resolve({ token: TOKEN }), searchParams: Promise.resolve({ paid: "cs_test_x" }) })) as { props: { notice?: string; initial: { submitted: boolean } } };

describe("/proof/[token] back from Checkout when Stripe cannot answer", () => {
  it("tells the client payments are down on a Stripe 500, and locks nothing", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ error: { message: "boom" } }, { status: 500 }));
    const el = await open();
    expect(el.props.notice).toBe("Payments are down right now. Try again in a few minutes.");
    expect(el.props.initial.submitted).toBe(false);
  });

  it("tells the client payments are down when Stripe does not answer at all", async () => {
    vi.stubGlobal("fetch", async () => { throw new TypeError("fetch failed"); });
    expect((await open()).props.notice).toBe("Payments are down right now. Try again in a few minutes.");
  });

  it("shows the normal unpaid gallery, no message, when the session is not paid", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ id: "cs_test_x", status: "open", payment_status: "unpaid", metadata: { proof: TOKEN }, amount_total: 0 }));
    const el = await open();
    expect(el.props.notice).toBeUndefined();
    expect(el.props.initial.submitted).toBe(false);
  });
});
