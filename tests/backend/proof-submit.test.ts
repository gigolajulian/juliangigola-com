import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkout, checkPaid, paidFor, settle } from "@/lib/proof-submit";
import type { Proof } from "@/lib/proofs";

/* Paying for selects: a Stripe session only counts when it is paid, for
   this gallery, for at least what is owed; a settling bank payment is
   followed until it clears or bounces. Stripe is a stubbed fetch. */

const proof = (over: Partial<Proof> = {}): Proof => ({
  token: "tok1",
  name: "Shoot",
  email: "kai@x.co",
  included: 1,
  price: 25,
  days: 14,
  createdAt: "",
  frames: [],
  selects: ["a", "b", "c"],
  notes: {},
  views: 0,
  ...over,
});

let calls: { url: string; body?: string }[] = [];
const stripeSays = (answer: (url: string) => { status?: number; body: unknown }) =>
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? String(init.body) : undefined });
    const a = answer(url);
    return Response.json(a.body, { status: a.status ?? 200 });
  });

beforeEach(() => {
  calls = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

describe("paidFor", () => {
  it("refuses a malformed session or one already counted without asking Stripe", async () => {
    stripeSays(() => ({ body: {} }));
    expect(await paidFor("k", proof(), "nope")).toBeNull();
    expect(await paidFor("k", proof({ paid: { session: "cs_test_A", amount: 0, at: "" } }), "cs_test_A")).toBeNull();
    expect(calls).toHaveLength(0);
  });
  it("counts a paid session for this gallery, capped at what was owed", async () => {
    stripeSays(() => ({ body: { payment_status: "paid", amount_total: 5300, metadata: { proof: "tok1" } } }));
    const paid = await paidFor("k", proof(), "cs_test_A");
    expect(paid).toMatchObject({ session: "cs_test_A", amount: 5000 });
    expect(paid).not.toHaveProperty("pending");
  });
  it("refuses another gallery's session or too little", async () => {
    stripeSays(() => ({ body: { payment_status: "paid", amount_total: 5000, metadata: { proof: "other" } } }));
    expect(await paidFor("k", proof(), "cs_test_A")).toBeNull();
    stripeSays(() => ({ body: { payment_status: "paid", amount_total: 100, metadata: { proof: "tok1" } } }));
    expect(await paidFor("k", proof(), "cs_test_A")).toBeNull();
  });
  it("takes a complete but unpaid bank session as pending", async () => {
    stripeSays(() => ({ body: { status: "complete", payment_status: "unpaid", amount_total: 5000, metadata: { proof: "tok1" } } }));
    expect(await paidFor("k", proof(), "cs_live_B")).toMatchObject({ pending: true, amount: 5000 });
  });
});

describe("checkPaid", () => {
  it("tells a refused session (null) from Stripe being down", async () => {
    stripeSays(() => ({ status: 404, body: {} }));
    expect(await checkPaid("k", proof(), "cs_test_A")).toBeNull();
    stripeSays(() => ({ status: 503, body: {} }));
    expect(await checkPaid("k", proof(), "cs_test_A")).toBe("down");
  });
});

describe("settle", () => {
  const pending = proof({ paid: { session: "cs_test_A", amount: 5000, at: "", pending: true } });
  it("does nothing for a payment that is not settling", async () => {
    expect(await settle("k", proof())).toBeNull();
  });
  it("clears a payment Stripe now calls paid", async () => {
    stripeSays(() => ({ body: { payment_status: "paid" } }));
    expect((await settle("k", pending))?.paid).toMatchObject({ amount: 5000, pending: undefined });
  });
  it("takes a bounced payment back off what was paid", async () => {
    stripeSays(() => ({ body: { payment_status: "unpaid", amount_total: 5000, payment_intent: { status: "canceled" } } }));
    expect((await settle("k", pending))?.paid).toMatchObject({ amount: 0, failed: true });
  });
  it("is null while still on its way", async () => {
    stripeSays(() => ({ body: { payment_status: "unpaid", payment_intent: { status: "processing" } } }));
    expect(await settle("k", pending)).toBeNull();
  });
});

describe("checkout", () => {
  it("by card: one session at the card price, back to the gallery", async () => {
    stripeSays(() => ({ body: { id: "cs_test_N", url: "https://checkout.stripe.com/x" } }));
    expect(await checkout("k", proof(), "card")).toEqual({ id: "cs_test_N", url: "https://checkout.stripe.com/x" });
    expect(calls).toHaveLength(1);
    const form = new URLSearchParams(calls[0].body);
    expect(form.get("payment_method_types[0]")).toBe("card");
    expect(form.get("line_items[0][price_data][product_data][name]")).toBe("Shoot: 2 extra retouched frames");
    expect(Number(form.get("line_items[0][price_data][unit_amount]"))).toBeGreaterThan(5000);
    expect(form.get("cancel_url")).toBe("https://juliangigola.com/proof/tok1");
  });
  it("falls back to card when the bank coupon cannot be made", async () => {
    stripeSays((url) => (url.endsWith("/coupons") ? { status: 400, body: {} } : { body: { id: "cs_test_C", url: "u" } }));
    expect((await checkout("k", proof())).id).toBe("cs_test_C");
    expect(new URLSearchParams(calls.at(-1)!.body).get("payment_method_types[0]")).toBe("card");
  });
});
