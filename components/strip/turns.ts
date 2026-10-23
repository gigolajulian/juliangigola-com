import { isTrackpad } from "@/lib/motion/wheel";
import { EASE, SLIDE_MS } from "./slide";

/* ── the portfolio's disciplines under `?scroll=1` ─────────────────
 * Julian, 2026-10-22: the homepage's turn for crossing into the next
 * discipline, varied so the two do not clash. The covers within a
 * discipline scroll as they always did. Once the next discipline's name
 * is on screen, a mouse turns to it as the homepage turns a screen: two
 * notches, one fixed slide, the wheel ignored while it plays. The next
 * discipline comes over as one sheet, with a shadow at its edge, and the
 * one before drifts the same way a third as far beneath it, a page
 * turned over a page. A trackpad and the way back keep the free scroll.
 * ─────────────────────────────────────────────────────────────── */

export type Turns = { take: (e: WheelEvent) => boolean };
/** Read by `wheel.ts` and by Lenis (`lenis.ts`), whichever hears an event first. */
export const turns = new WeakMap<HTMLElement, Turns>();
/** Stops Lenis where the strip stands (`lenis.ts`), so a turn starts from rest. */
export const haltLenis = new WeakMap<HTMLElement, () => void>();

const TURN = 2;
/** The one before travels a third as far as the one coming over. */
const UNDER = 1 / 3;
/** The sheet's edge: a soft shadow cast over the discipline going under. */
const DEPTH = "-28px 0 56px -18px rgb(0 0 0 / 0.38)";

export function chapterTurns(el: HTMLElement) {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  const seen = new WeakMap<Event, boolean>();
  let busy = false;
  let acc = 0;
  let accAt = -Infinity;
  let rest = 0;
  let running: { anims: Animation[]; cells: HTMLElement[]; d: number } | null = null;
  let leaning: Animation[] = [];

  const heads = () =>
    (Array.from(el.children) as HTMLElement[]).filter((k) => k.hasAttribute("data-deck"));
  /** The next discipline's name on screen, and how far it has to go to
      stand where a discipline starts (the strip's own margin). */
  const nextHead = () => {
    const left = el.getBoundingClientRect().left;
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    for (const h of heads()) {
      const x = h.getBoundingClientRect().left - left;
      // Past a few px: the one just landed is where it should be.
      if (x > pad + 8) return x < el.clientWidth ? { h, x: x - pad } : null;
    }
    return null;
  };

  const clear = (cells: HTMLElement[]) => {
    for (const c of cells) {
      c.style.removeProperty("z-index");
      c.style.removeProperty("box-shadow");
    }
  };
  const land = () => {
    if (!running) return;
    const { anims, cells, d } = running;
    running = null;
    el.scrollLeft += d;
    haltLenis.get(el)?.();
    for (const a of anims) a.cancel();
    clear(cells);
    busy = false;
  };

  /** A notch short of a turn: the sheet leans in a little, and back. */
  const nudge = (h: HTMLElement) => {
    const cells = (Array.from(el.children) as HTMLElement[]).filter(
      (k) => k === h || k.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_PRECEDING,
    );
    leaning = cells.slice(0, 8).map((k) =>
      k.animate(
        [{ transform: "none" }, { transform: "translateX(-28px)" }, { transform: "none" }],
        { duration: 520, easing: EASE },
      ),
    );
  };

  const turn = (h: HTMLElement, d: number) => {
    window.clearTimeout(rest);
    acc = 0;
    haltLenis.get(el)?.();
    if (still.matches) {
      el.scrollLeft += d;
      haltLenis.get(el)?.();
      return;
    }
    busy = true;
    const w = el.clientWidth;
    const left = el.getBoundingClientRect().left;
    const kids = Array.from(el.children) as HTMLElement[];
    const at = kids.indexOf(h);
    const anims: Animation[] = [];
    const cells: HTMLElement[] = [];
    kids.forEach((k, i) => {
      const r = k.getBoundingClientRect();
      // Only what is or will be on screen moves.
      if (r.right - left < -w || r.left - left > w + d) return;
      const over = i >= at;
      const by = over ? d : d * UNDER;
      if (over) {
        cells.push(k);
        /* Over the one going under. Each cell already carries half the gap
           of ground (`--deal-ground`, strip-motion.css), so it comes over
           as one sheet with no sliver between its covers (Julian). */
        k.style.zIndex = "1";
        if (k === h) k.style.boxShadow = `var(--deal-ground), ${DEPTH}`;
      }
      anims.push(
        k.animate([{ transform: "none" }, { transform: `translateX(${-by}px)` }], {
          duration: SLIDE_MS,
          easing: EASE,
          fill: "forwards",
        }),
      );
    });
    running = { anims, cells, d };
    if (!anims.length) return land();
    anims[0]?.finished.then(land, () => {});
  };

  const take = (e: WheelEvent) => {
    const known = seen.get(e);
    if (known !== undefined) return known;
    const mine = decide(e);
    seen.set(e, mine);
    return mine;
  };
  const decide = (e: WheelEvent) => {
    if (busy) return true;
    if (isTrackpad(e, window.devicePixelRatio)) return false;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (d <= 0) return false;
    // Measured without the lean: a turn from mid-lean landed 24px short.
    for (const a of leaning) a.cancel();
    leaning = [];
    const next = nextHead();
    if (!next) return false;
    if (e.timeStamp - accAt > 250) acc = 0;
    accAt = e.timeStamp;
    acc += 1;
    if (acc >= TURN) {
      turn(next.h, next.x);
      return true;
    }
    haltLenis.get(el)?.();
    nudge(next.h);
    window.clearTimeout(rest);
    rest = window.setTimeout(() => (acc = 0), 220);
    return true;
  };

  turns.set(el, { take });
  return () => {
    turns.delete(el);
    window.clearTimeout(rest);
    land();
  };
}
