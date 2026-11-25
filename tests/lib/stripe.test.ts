import { afterEach, describe, expect, it, vi } from "vitest";
import { stripe } from "@/lib/stripe";
import { reply } from "../backend/fakes";

/* `lib/stripe.ts`: one call to Stripe's API. A form makes it a POST with a
   pinned API version; a refusal throws with Stripe's status attached. */

afterEach(() => vi.unstubAllGlobals());

describe("stripe", () => {
  it("POSTs a form with the key, the pinned version and the idempotency key", async () => {
    const fetch = vi.fn(async () => reply({ id: "pi_1" }));
    vi.stubGlobal("fetch", fetch);
    expect(await stripe("sk_test_x", "/payment_intents", { amount: "1700" }, "dep:1")).toEqual({ id: "pi_1" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/payment_intents");
    expect(init.method).toBe("POST");
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe("Bearer sk_test_x");
    expect(h["Stripe-Version"]).toBe("2025-09-30.clover");
    expect(h["Idempotency-Key"]).toBe("dep:1");
    expect(String(init.body)).toBe("amount=1700");
  });

  it("GETs without a form or an idempotency key", async () => {
    const fetch = vi.fn(async () => reply({ data: [] }));
    vi.stubGlobal("fetch", fetch);
    await stripe("sk_test_x", "/charges?limit=1");
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect("Idempotency-Key" in (init.headers as object)).toBe(false);
  });

  it("throws with the status when Stripe refuses, even with a body that is not JSON", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply({ error: { type: "card_error", code: "declined" } }, 402)),
    );
    await expect(stripe("k", "/payment_intents", {})).rejects.toMatchObject({ status: 402 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply("<html>", 500)),
    );
    await expect(stripe("k", "/x")).rejects.toMatchObject({ status: 500, message: "Stripe /x 500" });
    err.mockRestore();
  });
});
