/** A MOTION-PLAN.md item on trial: `?mplan=<key>` (head script, app/layout.tsx). */
export const mplan = (key: string) =>
  typeof document !== "undefined" && !!document.documentElement.dataset.mplan?.split(" ").includes(key);

/** The plan's `out` curve for GSAP: power4.out is cubic-bezier(.23, 1, .32, 1). */
export const GSAP_OUT = "power4.out";
