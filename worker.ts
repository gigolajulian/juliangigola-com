/* ── the Worker's entry, around OpenNext's ────────────────────────
 * OpenNext builds `.open-next/worker.js`, which serves the site. This file
 * is `main` in wrangler.jsonc so the Worker can also export the booking
 * lock, a Durable Object (`worker/booking-lock.ts`). Everything the site
 * serves still goes through OpenNext's fetch, unchanged.
 * ─────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- the file exists only after a build, so expect-error would fail once it does
// @ts-ignore: built by `opennextjs-cloudflare build` before wrangler bundles this.
import openNext from "./.open-next/worker.js";

export { BookingLock } from "./worker/booking-lock";

export default {
  fetch: openNext.fetch,
};
