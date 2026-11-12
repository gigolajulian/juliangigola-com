/* ── the proof gate's wall, tuned per screen (Julian 2026-11-11, in the gridwall tuner) ──
 * The default since Julian's yes (2026-11-11); `?gw=0` for the untuned wall. Each screen size carries the wall's scale and shift (x, y in px of that screen)
 * and, where set, the gallery's column count; the rest is one set for every screen. A window takes the values of the
 * nearest screen by shape, its shift scaled to its own size: phone portrait at 520 wide and under, phone landscape under
 * 500 tall (the sizes proof.css already lays the card out for), else the nearest by width over height.
 * ─────────────────────────────────────────────────────────────── */

type Screen = { w: number; h: number; scale: number; x: number; y: number; cols?: number; card?: number };

export const GRIDWALL_SCREENS: Record<string, Screen> = {
  "phone-portrait": { w: 390, h: 844, scale: 0.86, x: -111, y: 7, card: 1.04 },
  "phone-landscape": { w: 844, h: 390, scale: 0.63, x: -78, y: 0 },
  "ipad-portrait": { w: 820, h: 1180, scale: 1.05, x: -43, y: 0 },
  "ipad-landscape": { w: 1180, h: 820, scale: 1.24, x: -59, y: 0 },
  "laptop-16x10": { w: 1440, h: 900, scale: 1.4, x: -157, y: 0 },
  "1080p-16x9": { w: 1920, h: 1080, scale: 1.76, x: -209, y: 0 },
  "ultrawide-21x9": { w: 2560, h: 1080, scale: 1.7, x: -279, y: 0 },
  "superwide-32x9": { w: 5120, h: 1440, scale: 2.39, x: -558, y: 0 },
};

export const GRIDWALL = {
  tilt: 27,
  turn: -14,
  depth: 120,
  persp: 1200,
  /** The sign-in card's size; it also grows on screens past a 1440x900 laptop (`cardFit`). */
  card: 0.97,
  photoRadius: 0,
  /** The card's corners; the phone portrait card sits flush on the bottom edge and stays square. */
  cardRadius: 8,
  speed: 30,
  /** Open proofs: a gallery cell not quite on its tile eases the last of the way over this (live 450). */
  handOver: 500,
};

/** How many screens wide the wall runs: the site's 1.5 left the far edge bare on wide screens once the wall turns (32:9).
 *  Grown with the shape only: 2.6 everywhere drew a laptop 15 columns for 9 and cost it frames on Open proofs. */
export const wallFill = (W: number, H: number) => Math.max(1.5, (0.75 * W) / H);

export type Gridwall = { scale: number; x: number; y: number; cols?: number; card: number; cardRadius: number };

export function gridwallScreen(W: number, H: number): string {
  if (W <= 520 && H > W) return "phone-portrait";
  if (H <= 500 && W > H) return "phone-landscape";
  const a = Math.log(W / H);
  let best = "laptop-16x10";
  for (const [id, s] of Object.entries(GRIDWALL_SCREENS)) {
    if (id.startsWith("phone")) continue;
    if (Math.abs(a - Math.log(s.w / s.h)) < Math.abs(a - Math.log(GRIDWALL_SCREENS[best].w / GRIDWALL_SCREENS[best].h))) best = id;
  }
  return best;
}

/** The wall's values for a window this size. */
export function gridwallFor(W: number, H: number): Gridwall {
  const id = gridwallScreen(W, H);
  const s = GRIDWALL_SCREENS[id];
  const phone = id === "phone-portrait";
  const fit = phone ? 1 : Math.max(1, Math.min(W / 1440, H / 900));
  return {
    scale: s.scale,
    x: Math.round((s.x * W) / s.w),
    y: Math.round((s.y * H) / s.h),
    cols: s.cols,
    card: Math.round((s.card ?? GRIDWALL.card) * fit * 1000) / 1000,
    cardRadius: phone ? 0 : GRIDWALL.cardRadius,
  };
}
