/* ── beacon ───────────────────────────────────────────────────────
 * What the site's own click-and-scroll beacon sends, and how the Worker
 * checks it before it goes into Analytics Engine. Shared by the beacon
 * (`components/click-beacon.tsx`), its route (`app/api/beacon`) and the
 * SEO tab's reader (`app/api/seo`).
 *
 * One beacon per page view, sent when the page is left: where it was, how
 * far down it got, and up to MAX_CLICKS presses as fractions of the window.
 * No cookie, no id, no IP: nothing in it says who.
 *
 * Analytics Engine columns:
 *   blob1 path · blob2 'view' | 'click' · blob3 what was pressed · blob4 device
 *   double1 x · double2 y (in windows from the top, so > 1 is below the fold)
 *   double3 scroll depth reached, 0 to 1
 * ─────────────────────────────────────────────────────────────── */

export const BEACON_DATASET = "jg_beacon";
export const MAX_CLICKS = 50;
const DEVICES = ["desktop", "tablet", "phone"] as const;
const PATH = /^\/[\w\-/.#]{0,200}$/;

// `v`: the first beacon of a page view. A tab hidden and shown again sends
// its later clicks with `v: false`, so the view is counted once.
export type Beacon = { p: string; v: boolean; d: number; dev: (typeof DEVICES)[number]; c: [number, number, string][] };

const unit = (n: unknown, max = 1) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max;

/** The beacon if it is well formed, else null. Pages the public never sees are refused. */
export function parseBeacon(body: unknown): Beacon | null {
  const b = body as Partial<Beacon> | null;
  if (!b || typeof b.p !== "string" || !PATH.test(b.p) || /^\/(admin|api)(\/|$)/.test(b.p)) return null;
  if (typeof b.v !== "boolean" || !unit(b.d) || !DEVICES.includes(b.dev as Beacon["dev"]) || !Array.isArray(b.c) || b.c.length > MAX_CLICKS) return null;
  const c = b.c.filter(
    (k): k is [number, number, string] => Array.isArray(k) && unit(k[0]) && unit(k[1], 50) && typeof k[2] === "string",
  );
  return { p: b.p, v: b.v, d: b.d as number, dev: b.dev as Beacon["dev"], c: c.map(([x, y, l]) => [x, y, l.slice(0, 40)]) };
}
