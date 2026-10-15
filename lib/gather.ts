import { gsap } from "gsap";

/* ── the gather ───────────────────────────────────────────────────
 * Julian (2026-10-14): photographs come in from outside the page and
 * gather where they sit, solid all the way. Each on the line from the
 * middle of the screen out through its own place, in two waves: every
 * other one in their order (`--order` where they carry one, the page's
 * order otherwise), then the rest `WAVE` after. The cover's entrance
 * (`hero-gather.tsx`); the walls and a project's frames come in their
 * own ways (`streams`, `slides`, `gatherWhenSeen`).
 * ─────────────────────────────────────────────────────────────── */

export const FLY = 1.3; // s
export const WAVE = 0.15; // s, the second wave after the first

/** Where a frame starts and how long after the first it leaves. */
type Path = (f: HTMLElement, r: DOMRect, rank: number) => { x: number; y: number; delay: number };

/** Out along the line from the middle of the screen, in two waves. */
const radial: Path = (f, r, rank) => {
  const dx = r.left + r.width / 2 - innerWidth / 2;
  const dy = r.top + r.height / 2 - innerHeight / 2;
  const d = Math.hypot(dx, dy) || 1;
  // Far enough along that line to clear the screen's edge.
  const out = Math.hypot(innerWidth, innerHeight) / 2 + Math.max(r.width, r.height);
  return { x: (dx / d) * out, y: (dy / d) * out, delay: (rank % 2) * WAVE };
};

/** Julian (2026-10-14), for the walls: the photographs stream in from
    above and below, a column at a time, every other column the other
    way (`data-col` on the tile, `DriftWall.tsx`). */
export const streams: Path = (f, r) => {
  const col = Number(f.closest<HTMLElement>("[data-col]")?.dataset.col ?? 0);
  return { x: 0, y: (col % 2 ? 1 : -1) * (innerHeight + r.height), delay: col * 0.05 };
};

/** Julian (2026-10-14), for a project: the frames come in from past the
    right edge and run left, in order, up to the title. */
export const slides: Path = (f, r, rank) => ({ x: innerWidth - r.left + 40, y: 0, delay: rank * 0.08 });

/** Puts each frame outside the page and returns the flight home. */
export function gather(frames: HTMLElement[], path: Path = radial) {
  const order = (f: HTMLElement) => parseFloat(getComputedStyle(f).getPropertyValue("--order")) || 0;
  const rank = new Map([...frames].sort((a, b) => order(a) - order(b)).map((f, i) => [f, i]));
  const delay = new Map<HTMLElement, number>();
  for (const f of frames) {
    const { x, y, delay: d } = path(f, f.getBoundingClientRect(), rank.get(f)!);
    gsap.set(f, { x, y });
    delay.set(f, d);
  }
  return () =>
    frames.forEach((f) => {
      // A frame with its own transform transition would chase GSAP's.
      f.style.transition = "none";
      gsap.to(f, {
        x: 0,
        y: 0,
        duration: FLY,
        ease: "expo.out",
        delay: 0.05 + delay.get(f)!,
        // Nothing left behind once it lands (`clearProps` left an identity
        // transform on a phone).
        onComplete: () => {
          f.style.removeProperty("transform");
          f.style.removeProperty("transition");
        },
      });
    });
}

/** Where motion is allowed (`data-moves`, set before the first paint in
    `layout.tsx`, or here): `box` stays
    hidden (`:not([data-gathered])` in `cover.css`) until it is first on
    screen, then the frames `pick` finds in view gather into it. Returns
    the cleanup. */
export function gatherWhenSeen(box: HTMLElement, pick: (box: HTMLElement) => Iterable<HTMLElement>, path?: Path) {
  const done = () => (box.dataset.gathered = "");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    done();
    return () => {};
  }
  // The 404 is drawn in the browser and never runs the head script that
  // sets this (QA, 2026-10-15): set here, before the paint, when called
  // from a layout effect.
  document.documentElement.dataset.moves = "";
  let frames: HTMLElement[] = [];
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    frames = [...pick(box)].filter((f) => {
      const r = f.getBoundingClientRect();
      return r.width > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
    });
    const go = gather(frames, path);
    done();
    go();
  });
  io.observe(box);
  return () => {
    io.disconnect();
    gsap.killTweensOf(frames);
    frames.forEach((f) => {
      f.style.removeProperty("transform");
      f.style.removeProperty("transition");
    });
  };
}
