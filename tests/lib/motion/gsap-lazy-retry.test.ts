import { expect, it, vi } from "vitest";

/* A failed fetch (a flaky network on a phone) is not kept: the next ask fetches again. */

const tries = vi.hoisted(() => ({ n: 0 }));
vi.mock("gsap", () => {
  if (++tries.n === 1) throw new Error("offline");
  return { gsap: { to: () => {} } };
});
// Relative import: the coverage scanner resolves `@/` under src/, which this repo does not have.
const { loadGsap } = await import("../../../lib/motion/gsap-lazy");

it("asks again after a failed fetch", async () => {
  await expect(loadGsap()).rejects.toThrow();
  await expect(loadGsap()).resolves.toHaveProperty("to");
});
