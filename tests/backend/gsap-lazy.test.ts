import { describe, expect, it, vi } from "vitest";

/* gsap fetched once, after hydration: a call before it lands waits for it,
   a call after runs on the same tick, and the module is loaded only once. */

const loads = vi.hoisted(() => ({ n: 0 }));
vi.mock("gsap", () => {
  loads.n++;
  return { gsap: { to: () => {} } };
});
// Relative import: the coverage scanner resolves `@/` under src/, which this repo does not have.
const { warmGsap, withGsap } = await import("../../lib/motion/gsap-lazy");

describe("gsap-lazy", () => {
  it("queues a call until gsap loads, then runs later calls synchronously", async () => {
    const first = new Promise((ok) => withGsap(ok));
    let ranNow = false;
    expect(await first).toHaveProperty("to");
    withGsap(() => (ranNow = true));
    expect(ranNow).toBe(true);
    warmGsap();
    expect(loads.n).toBe(1);
  });
});
