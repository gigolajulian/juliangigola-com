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
const LOAD_CAP_MS = 3000; // the longest a wall waits for its photographs

/** Where a frame starts and how long after the first it leaves. */
type Path = (
  f: HTMLElement,
  r: DOMRect,
  rank: number,
) => { x: number; y: number; delay: number; duration?: number; ease?: string };

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

/** Julian (2026-10-15), for the 404: the wall builds up. Row by row from
    the bottom, left to right in a row, each tile out of nowhere a short
    way under its place and up into it; hidden until its turn, no fade. */
export const builds: Path = (f, r) => {
  const row = Math.max(0, Math.floor((innerHeight - r.bottom) / r.height + 0.5));
  const col = Math.max(0, Math.floor(r.left / r.width));
  return { x: 0, y: r.height * 0.35, delay: row * 0.32 + col * 0.09, duration: 0.9, ease: "power3.out" };
};

/** Julian (2026-10-14), for a project: the frames come in from past the
    right edge and run left, in order, up to the title. */
export const slides: Path = (f, r, rank) => ({ x: innerWidth - r.left + 40, y: 0, delay: rank * 0.08 });

/** Puts each frame outside the page and returns the flight home. */
export function gather(frames: HTMLElement[], path: Path = radial) {
  const order = (f: HTMLElement) => parseFloat(getComputedStyle(f).getPropertyValue("--order")) || 0;
  const rank = new Map([...frames].sort((a, b) => order(a) - order(b)).map((f, i) => [f, i]));
  const how = new Map<HTMLElement, ReturnType<Path>>();
  for (const f of frames) {
    const p = path(f, f.getBoundingClientRect(), rank.get(f)!);
    // Hidden until its own flight starts: parked at the edge, waiting on
    // its photograph, a frame could show empty.
    gsap.set(f, { x: p.x, y: p.y, visibility: "hidden" });
    how.set(f, p);
  }
  return () =>
    frames.forEach((f) => {
      // A frame with its own transform transition would chase GSAP's.
      f.style.transition = "none";
      const p = how.get(f)!;
      gsap.to(f, {
        x: 0,
        y: 0,
        duration: p.duration ?? FLY,
        ease: p.ease ?? "expo.out",
        delay: 0.05 + p.delay,
        onStart: () => f.style.removeProperty("visibility"),
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
  let cap = 0;
  let gone = false;
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    frames = [...pick(box)].filter((f) => {
      const r = f.getBoundingClientRect();
      return r.width > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
    });
    // Julian: the photographs that come in are loaded first. Capped, so a
    // slow connection still gets the wall. Asked for now and eagerly: once
    // a frame is moved off the page to come in, lazy loading never fetched
    // it (QA, /book/headshots with slow images, 2026-10-15).
    const imgs = frames.flatMap((f) => [...f.querySelectorAll("img")]);
    for (const i of imgs) i.loading = "eager";
    const go = gather(frames, path);
    done();
    let started = false;
    const start = () => {
      if (started || gone) return;
      started = true;
      go();
    };
    // Their load, not `decode()`: turning a lazy picture eager restarts its
    // request, which rejected a pending decode at once and let empty frames go.
    const loaded = (i: HTMLImageElement) =>
      i.complete && i.naturalWidth
        ? Promise.resolve()
        : new Promise<void>((ok) => {
            i.addEventListener("load", () => ok(), { once: true });
            i.addEventListener("error", () => ok(), { once: true });
          });
    Promise.all(imgs.map(loaded)).then(start);
    cap = window.setTimeout(start, LOAD_CAP_MS);
  });
  io.observe(box);
  return () => {
    gone = true;
    clearTimeout(cap);
    io.disconnect();
    gsap.killTweensOf(frames);
    frames.forEach((f) => {
      f.style.removeProperty("transform");
      f.style.removeProperty("transition");
      f.style.removeProperty("visibility");
    });
  };
}
