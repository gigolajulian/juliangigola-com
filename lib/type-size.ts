/* ── font v2: the sizes ──────────────────────────────────────────
 * Each kind of text (a level) at a multiple of the size its own CSS gives
 * it, set inline. Run by `type-dials.tsx`, and before the first paint by
 * the script at the foot of `app/layout.tsx`, which inlines `typeSizer`
 * with toString(): it must read nothing from outside its arguments.
 * ─────────────────────────────────────────────────────────────── */

export type Level = "titles" | "names" | "text" | "role" | "where" | "labels" | "buttons";
export type Setting = { font: string; cut: string; size: number; spacing: number; gap?: number };

/* Julian's settings from the bar, 2026-10-18 (second paste). */
export const DEFAULTS: Record<Level, Setting> = {
  titles: { font: "Display", cut: "Bold", size: 1.1, spacing: -0.035, gap: 0.95 },
  names: { font: "Display", cut: "Regular", size: 1.33, spacing: -0.035 },
  /* Gap 1.55 (was 1.4): long text read cramped (Julian, 2026-10-22). The
     spacing stays -0.015: at 0 the lines broke earlier and read ragged. */
  text: { font: "Text", cut: "Regular", size: 1.25, spacing: -0.015, gap: 1.55 },
  /* The two lines under the name on the cover; they were in Small labels
     when these were set. */
  role: { font: "Old Mono", cut: "Medium", size: 1.06, spacing: 0.04 },
  where: { font: "Old Mono", cut: "Medium", size: 1.46, spacing: -0.05 },
  labels: { font: "Old Mono", cut: "Medium", size: 1.06, spacing: 0.04 },
  buttons: { font: "Old Mono", cut: "Regular", size: 1.13, spacing: 0.04 },
};

/* The same levels `font-v2.css` styles, most specific first: an element
   takes the first level it matches. */
export const LEVELS: [Level, string][] = [
  ["buttons", ".action, .action-quiet, .cover-cta"],
  ["role", ".cover-float-title"],
  ["where", ".cover-float-where"],
  ["labels", ".label, .font-mono"],
  [
    "titles",
    ":is(h1, h2):is(.font-display, .title):not(.chapter-name, .enquiry-title):not(:is(.discipline-title, .project-plate) > *), .display, .title, h1[class*='font-wordmark']:not(.logo-grow)",
  ],
  ["names", "h1, h2, h3, h4, h5, h6, .font-display"],
  ["text", "p"],
];

/* Not the liquid buttons: their fill re-measures every frame until the
   button holds still, and a size written here kept it from ever settling
   (QA, #239). The cover's are sized in `font-v2.css` through `--cta-k`.
   Nor the cover's wordmark, a canvas that sizes itself: a size written
   here kept it and the buttons redrawing on hover (QA, #239), and Julian
   kept the wordmark as it was. */
// The copyright card's footer is sized to fit its width (photo-notice.tsx).
// The navbar's names are sized in `font-v2.css` from the first paint:
// written here after load, they grew 4% and the row jumped (Julian).
export const SKIP = ".logo-grow, .v2-bar, .v2-tags, .notice-foot, .site-bar nav";
// And the card captions under Commissions, held to two lines on a phone
// in `font-v2.css` (QA, #239).
// And /book's title and session names, sized to the window's height in
// `font-v2.css` (QA: the column outgrew the screen with #247's lines).
export const LIQUID =
  ".liquid-pair, .cover-float-ctas, .cover-float-name, .services-cap, .book-page h1, .book-page ul .font-display";


/* Left out of the pass before the first paint: the role and location
   lines under the cover's name fit themselves to each other
   (`fit-lines.tsx`) once React is up, and sized before that they ended a
   different size from the live site's. */
export const LATE = ".cover-float-title, .cover-float-where";

/* Also left to the pass after the faces are in: text in a box that
   clips it (a truncated name, the filter row). Fitting it to its box
   needs the faces' widths; sized before them it grew and then shrank. */
export const clips = (el: HTMLElement) => {
  const o = getComputedStyle(el);
  return /hidden|clip/.test(o.overflowX + o.overflowY);
};

export const sizesOf = (set: Record<Level, Setting>) =>
  Object.fromEntries(Object.entries(set).map(([k, v]) => [k, v.size])) as Record<string, number>;

export function typeSizer(
  LEVELS: [string, string][],
  sizes: Record<string, number>,
  SKIP: string,
  LIQUID: string,
) {
  // ponytail: sizes multiply the measured px, so a fluid clamp() freezes
  // at this window's size until the next resize; fine for tuning.
  // Each scaled element's own inline size, put back after: lines that fit
  // themselves (`fit-lines.tsx`) carry one.
  const scaled = new Map<HTMLElement, string>();
  const base = new Map<HTMLElement, number>();
  const restore = () => {
    for (const [el, was] of scaled) el.style.fontSize = was;
    scaled.clear();
    base.clear();
  };
  /* QA (#239): every size read first, then every size written. Reading
     after each write made the browser restyle the page once per element,
     a 120ms frame after load. */
  const scaleAll = (list: [HTMLElement, number][]) => {
    const px = list.map(([el]) => parseFloat(getComputedStyle(el).fontSize));
    list.forEach(([el, k], i) => {
      scaled.set(el, el.style.fontSize);
      base.set(el, px[i]);
      el.style.fontSize = `${px[i] * k}px`;
    });
  };
  /* Julian: "adjust for different sizes". A size that is right on a
     laptop pushes a long word out of a phone's card or a fitted line off
     the screen. Anything enlarged gives back just enough to fit its own
     box and the window (16px clear), never below the size it had. */
  const fit = (els: HTMLElement[] = [...scaled.keys()]) => {
    // One layout for every reading, then the writes.
    const shrink = els.map((el) => {
      const r = el.getBoundingClientRect();
      let f = 1;
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) f = el.clientWidth / el.scrollWidth;
      const room = innerWidth - 16 - Math.max(r.left, 16);
      if (r.width > room && r.left < innerWidth && r.right > 0) f = Math.min(f, room / r.width);
      return f;
    });
    // Boxes that scroll, and boxes that clip (QA: a Commissions card title
    // lost its third line); the second never below the old size.
    const boxes = els.flatMap((el) => {
      const o = getComputedStyle(el).overflowY;
      return /auto|scroll/.test(o) ? [[el, 12] as const] : /hidden|clip/.test(o) ? [[el, base.get(el)!] as const] : [];
    });
    els.forEach((el, i) => {
      if (shrink[i] < 1)
        el.style.fontSize = `${Math.max(base.get(el)!, parseFloat(el.style.fontSize) * shrink[i])}px`;
    });
    for (const [el, least] of boxes) {
      /* Julian: the Biography text scrolled in its box. Text in a box of
         its own height (a scroll box) comes down until it fits, below its old size too
         (12px floor). Area goes with the square of the size, so the root
         of the overflow, a few times over for the rewrap. */
      for (let i = 0; i < 4 && el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1; i++) {
        const now = parseFloat(el.style.fontSize);
        if (now <= least) break;
        el.style.fontSize = `${Math.max(least, now * Math.sqrt(el.clientHeight / el.scrollHeight) * 0.99)}px`;
      }
    }
    /* Julian: on Commissions at 1440x900 the bigger list pushed Inquire
       onto the logos. A screen taller than its box gives back part of the
       enlargement of everything in it, together, until it fits. Sessions
       ran 17px over even at the old sizes (the new faces sit taller), so
       down to 85% of them if it must. */
    const screens = new Set<Element>();
    for (const el of els) {
      const s = el.closest(".screen-measure");
      // Not Inquiries: it runs past its box at the old sizes too, by design.
      if (s && !s.classList.contains("contact-inquire")) screens.add(s);
      // A scrolling list around the text the same way (QA: Biography's
      // steps at 1280x720 hid the end of 04).
      const list = el.parentElement?.closest("[data-scroll]");
      if (list) screens.add(list);
    }
    /* A few rounds, every screen read at once and then written: one
       layout a round, not one a screen a step (QA, #239). Height goes
       roughly with size, so each round takes the overflow's ratio. */
    const inside = [...screens].map((s) => [...scaled.keys()].filter((el) => s.contains(el)));
    for (let round = 0; round < 3; round++) {
      const over = [...screens].map((s) => (s.scrollHeight > s.clientHeight + 1 ? s.clientHeight / s.scrollHeight : 1));
      if (over.every((r) => r === 1)) break;
      over.forEach((r, n) => {
        if (r === 1) return;
        for (const el of inside[n]) {
          const floor = base.get(el)! * 0.85;
          el.style.fontSize = `${Math.max(floor, parseFloat(el.style.fontSize) * r * 0.98)}px`;
        }
      });
    }
  };
  const levelOf = new Map<Element, string>();
  /* The text inside `roots` (and the roots), each kind at its size.
     Returns what it sized. */
  /* Julian: text looked bad on smaller laptops, and shorter still with
     the tab bar open. The sizes were tuned on his 1547x889 window and
     grew everything by the same amount everywhere. From the laptop up
     the enlargement now goes with the window: all of it from 1536 by
     860, none at 1180 wide or 600 tall, in between in proportion. A
     phone and a tablet upright keep theirs. */
  const ramp = (v: number, lo: number, hi: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  let room = 1;
  const scan = (roots: Element[], skip = SKIP, leave?: (el: HTMLElement) => boolean) => {
    room = innerWidth < 1024 ? 1 : Math.min(ramp(innerWidth, 1180, 1536), ramp(innerHeight, 600, 860));
    const fresh: HTMLElement[] = [];
    const todo: [HTMLElement, number][] = [];
    for (const [level, sel] of LEVELS) {
      for (const root of roots) {
        const found = [...root.querySelectorAll<HTMLElement>(sel)];
        if (root.matches(sel)) found.unshift(root as HTMLElement);
        for (const el of found) {
          if (levelOf.has(el) || el.closest(skip) || leave?.(el)) continue;
          levelOf.set(el, level);
          const k = 1 + (sizes[level] - 1) * room;
          // At 1 on a small window it is still sized, so `fit` can bring it down.
          if (sizes[level] === 1 || el.closest(LIQUID)) continue;
          // A line that fits itself (`fit-lines.tsx`) sets its own size, so
          // that is the one to scale, not the box around it.
          const fitted = el.querySelectorAll<HTMLElement>("[style*='font-size']");
          for (const c of fitted.length ? [...fitted] : [el]) {
            if (scaled.has(c) || fresh.includes(c) || c.closest(LIQUID)) continue;
            todo.push([c, k]);
            fresh.push(c);
          }
        }
      }
    }
    scaleAll(todo);
    return fresh;
  };
  return { scaled, levelOf, restore, fit, scan };
}

declare global {
  interface Window {
    /** What the pre-paint script sized (`app/layout.tsx`). */
    __jgType?: ReturnType<typeof typeSizer>;
  }
}
