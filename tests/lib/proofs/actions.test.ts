import { describe, expect, it, vi } from "vitest";
// Relative imports: the coverage scanner resolves `@/` under src/, which this repo does not have.
import { deliverFinals, dropKeys, sendProofs, sendReminder, type ProofBindings } from "../../../lib/proofs/actions";
import type { Proof } from "../../../lib/proofs/proof-model";

/* lib/proofs/actions: R2 deletes in batches of 1000, and the refusals that
   answer before anything is read, written or mailed. */

const proof = (o: Partial<Proof> = {}): Proof =>
  ({
    token: "t1",
    name: "Shoot",
    included: 10,
    price: 15,
    days: 14,
    createdAt: "2026-01-01T00:00:00.000Z",
    frames: [],
    selects: [],
    notes: {},
    views: 0,
    ...o,
  }) as Proof;

// Any IO throws: a refusal must come back before the store or the mail is touched.
const desk = new Proxy(
  {},
  {
    get: () => {
      throw new Error("touched the desk");
    },
  },
) as ProofBindings;

describe("dropKeys", () => {
  it("deletes 1000 keys a call", async () => {
    const del = vi.fn<(keys: string[]) => Promise<void>>(async () => {});
    await dropKeys(
      { delete: del } as unknown as ProofBindings["r2"],
      Array.from({ length: 2001 }, (_, i) => `k${i}`),
    );
    expect(del.mock.calls.map(([keys]) => keys.length)).toEqual([1000, 1000, 1]);
  });
});

describe("refusals", () => {
  it("asks for the email, then the frames, before sending proofs", async () => {
    expect(await sendProofs(desk, proof(), undefined, "https://x")).toEqual({ error: "Add the client's email first.", status: 400 });
    expect(await sendProofs(desk, proof({ email: "a@b.co" }), undefined, "https://x")).toEqual({
      error: "Publish frames from Lightroom first.",
      status: 400,
    });
  });

  it("asks for the finals before delivering", async () => {
    expect(await deliverFinals(desk, proof({ email: "a@b.co" }), undefined)).toEqual({
      error: "Publish the finals from Lightroom first.",
      status: 400,
    });
  });

  it("answers 409 with the reason when no reminder is due", async () => {
    expect(await sendReminder(desk, proof())).toEqual({ error: "Not sent yet.", status: 409 });
    expect(
      await sendReminder(desk, proof({ sentAt: "2026-01-01T00:00:00.000Z", reminded: { proofs: "2026-01-02T00:00:00.000Z" } })),
    ).toEqual({ error: "Already reminded for this stage.", status: 409 });
  });
});
