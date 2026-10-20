"use client";

import * as React from "react";
import { createPortal } from "react-dom";

/* ── font v2: the type bar ───────────────────────────────────────
 * Julian: set the type live, switch faces and cuts with a click, see
 * which text is in which face. A bar at the foot of the window on the dev
 * server with `?font=v2` only (not DialKit: "make it easier to switch").
 * Pick a kind of text, click a face and a thickness, drag a number. Face,
 * thickness, spacing and line gap go to the `--v2-*` variables
 * `font-v2.css` reads. Size multiplies whatever size the element has now,
 * set inline, because the sizes live at the call sites. Kept for the tab
 * (sessionStorage); Copy puts it on the clipboard to paste back.
 * ─────────────────────────────────────────────────────────────── */

/* The faces on the page: the kit's two, and today's three to compare. */
const FACES: Record<string, string> = {
  Display: '"neue-haas-grotesk-display", sans-serif',
  Text: '"neue-haas-grotesk-text", sans-serif',
  "Old Endless": 'display, "display Fallback", sans-serif',
  "Old Mono": '"IBM Plex Mono", monospace',
  "Old Inter": '"Inter Tight", sans-serif',
};

/* How a face is written in the bar: the kit's two are Neue Haas. */
const label = (f: string) => (f === "Display" || f === "Text" ? `Neue Haas ${f}` : f);

/* The kit's cuts, and the CSS weight each one is in each face. Endless is
   one cut, Inter Tight only its 900: those draw the same at any weight. */
const CUTS = ["Regular", "Medium", "Bold"];
const WEIGHT: Record<string, number[]> = {
  Display: [500, 600, 700],
  Text: [400, 500, 700],
  "Old Endless": [900, 900, 900],
  "Old Mono": [400, 500, 700],
  "Old Inter": [900, 900, 900],
};

type Level = "titles" | "names" | "text" | "role" | "where" | "labels" | "buttons";
type Setting = { font: string; cut: string; size: number; spacing: number; gap?: number };
type State = {
  level: Level;
  show: boolean;
  open: boolean;
  /** Where the bar was dragged to; null is its place at the foot. */
  at: { x: number; y: number } | null;
  set: Record<Level, Setting>;
};

/* Julian's settings from the bar, 2026-10-18 (second paste). */
const DEFAULTS: Record<Level, Setting> = {
  titles: { font: "Display", cut: "Bold", size: 1.1, spacing: -0.035, gap: 0.95 },
  names: { font: "Display", cut: "Regular", size: 1.33, spacing: -0.035 },
  text: { font: "Text", cut: "Regular", size: 1.25, spacing: -0.015, gap: 1.4 },
  /* The two lines under the name on the cover; they were in Small labels
     when these were set. */
  role: { font: "Old Mono", cut: "Medium", size: 1.06, spacing: 0.04 },
  where: { font: "Old Mono", cut: "Medium", size: 1.46, spacing: -0.05 },
  labels: { font: "Old Mono", cut: "Medium", size: 1.06, spacing: 0.04 },
  buttons: { font: "Old Mono", cut: "Regular", size: 1.13, spacing: 0.04 },
};

/* What each kind is called in the bar, its colour when shown, and the
   `--v2-*` name `font-v2.css` reads. */
const NAME: Record<Level | "other", string> = {
  titles: "Big titles",
  names: "List names",
  text: "Paragraphs",
  role: "Role line",
  where: "Based in line",
  labels: "Small labels",
  buttons: "Buttons",
  other: "Other",
};
const COLOUR: Record<Level | "other", string> = {
  titles: "#ff4d4d",
  names: "#2ad4ff",
  text: "#ffd23f",
  role: "#ff9f43",
  where: "#b98cff",
  labels: "#ff5cf0",
  buttons: "#5cff8a",
  other: "#8a8a8a",
};
const VAR: Record<Level, string> = {
  titles: "title",
  names: "row",
  text: "body",
  role: "role",
  where: "where",
  labels: "label",
  buttons: "button",
};

/* The same levels `font-v2.css` styles, most specific first: an element
   takes the first level it matches. */
const LEVELS: [Level, string][] = [
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

/* The bar lists them top down, biggest first. */
const ORDER: Level[] = ["titles", "names", "text", "role", "where", "labels", "buttons"];

const KEY = "jg-font-v2-bar";
/* Not the liquid buttons: their fill re-measures every frame until the
   button holds still, and a size written here kept it from ever settling
   (QA, #239). The cover's are sized in `font-v2.css` through `--cta-k`.
   Nor the cover's wordmark, a canvas that sizes itself: a size written
   here kept it and the buttons redrawing on hover (QA, #239), and Julian
   kept the wordmark as it was. */
const SKIP = ".logo-grow, .v2-bar, .v2-tags";
// And the card captions under Commissions, held to two lines on a phone
// in `font-v2.css` (QA, #239).
// And /book's title and session names, sized to the window's height in
// `font-v2.css` (QA: the column outgrew the screen with #247's lines).
const LIQUID =
  ".liquid-pair, .cover-float-ctas, .cover-float-name, .services-cap, .book-page h1, .book-page ul .font-display";

/** "Display Bold" from what the browser actually drew with. */
function realFace(cs: CSSStyleDeclaration) {
  const f = cs.fontFamily.toLowerCase();
  const name = f.includes("neue-haas-grotesk-display")
    ? "Display"
    : f.includes("neue-haas-grotesk-text")
      ? "Text"
      : f.includes("plex")
        ? "Old Mono"
        : f.includes("inter tight")
          ? "Old Inter"
          : f.startsWith("display")
            ? "Old Endless"
            : f.split(",")[0].replace(/"/g, "");
  const i = WEIGHT[name]?.indexOf(Number(cs.fontWeight)) ?? -1;
  return i >= 0 && !name.startsWith("Old") ? `${label(name)} ${CUTS[i]}` : name;
}

const noop = () => () => {};

export function TypeDials() {
  // Set before the first paint by the head script in `app/layout.tsx`.
  const on = React.useSyncExternalStore(
    noop,
    () => document.documentElement.dataset.font === "v2",
    () => false,
  );
  if (!on) return null;
  // The bar is for the dev server, and only with `?dials` (Julian: remove
  // the panel); everywhere else the page gets the settings.
  return process.env.NODE_ENV !== "production" && /[?&]dials/.test(location.search) ? <TypeBar /> : <TypeDefaults />;
}

function TypeDefaults() {
  useTypeApply(DEFAULTS, false, noop);
  return null;
}

type Tag = { x: number; y: number; w: number; h: number; level: Level | "other"; text: string };

function load(): State {
  const base: State = { level: "titles", show: false, open: true, at: null, set: DEFAULTS };
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (saved) return { ...base, ...saved, set: { ...DEFAULTS, ...saved.set } };
  } catch {}
  return base;
}

/* Puts the settings on the page: faces, cuts, spacing and line gaps as
   the `--v2-*` variables, sizes as a multiple of each element's own, and
   (with `show`) the boxes naming every piece of text. */
function useTypeApply(
  set: Record<Level, Setting>,
  show: boolean,
  setTags: (t: Tag[]) => void,
) {
  React.useEffect(() => {
    const root = document.documentElement.style;
    for (const [level] of LEVELS) {
      const v = set[level];
      const name = VAR[level];
      root.setProperty(`--v2-${name}-family`, FACES[v.font]);
      root.setProperty(`--v2-${name}-weight`, String(WEIGHT[v.font][CUTS.indexOf(v.cut)]));
      root.setProperty(`--v2-${name}-track`, `${v.spacing}em`);
      root.setProperty(`--v2-${name}-size`, String(v.size));
      if (v.gap !== undefined) root.setProperty(`--v2-${name}-lead`, String(v.gap));
    }

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
    const levelOf = new Map<Element, Level>();
    let watch: MutationObserver | null = null;
    let fitWatch: MutationObserver | null = null;
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
    const scan = (roots: Element[]) => {
      room = innerWidth < 1024 ? 1 : Math.min(ramp(innerWidth, 1180, 1536), ramp(innerHeight, 600, 860));
      const fresh: HTMLElement[] = [];
      const todo: [HTMLElement, number][] = [];
      for (const [level, sel] of LEVELS) {
        for (const root of roots) {
          const found = [...root.querySelectorAll<HTMLElement>(sel)];
          if (root.matches(sel)) found.unshift(root as HTMLElement);
          for (const el of found) {
            if (levelOf.has(el) || el.closest(SKIP)) continue;
            levelOf.set(el, level);
            const k = 1 + (set[level].size - 1) * room;
            // At 1 on a small window it is still sized, so `fit` can bring it down.
            if (set[level].size === 1 || el.closest(LIQUID)) continue;
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
    const apply = () => {
      restore();
      levelOf.clear();
      added.clear();
      scan([document.body]);
      fit();
      settle();
    };
    /* QA (#239): text that arrives later is sized on its own; the rest of
       the page is not touched again until the window or the fonts change. */
    const added = new Set<Element>();
    const applyAdded = () => {
      const roots = [...added].filter((el) => el.isConnected);
      added.clear();
      for (const el of scaled.keys()) if (!el.isConnected) scaled.delete(el);
      const fresh = scan(roots);
      if (fresh.length) fit(fresh);
      settle();
    };
    const settle = () => {
      // Our own size changes are not news.
      watch?.takeRecords();
      fitWatch?.disconnect();
      document.querySelectorAll(".fit-line").forEach((l) => fitWatch?.observe(l, { attributes: true, attributeFilter: ["style"] }));
      draw();
    };

    /* Every visible piece of text: its kind (or "other", grey), the face
       and cut it is really drawn in, its size. */
    const draw = () => {
      if (!show) return setTags([]);
      const out: Tag[] = [];
      const done = new Set<Element>();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent?.trim()) continue;
        const parent = n.parentElement;
        if (!parent || parent.closest(`${SKIP}, [class*=dialkit], script, style, .sr-only`)) continue;
        let el: Element | null = parent;
        while (el && !levelOf.has(el)) el = el.parentElement;
        const box = el ?? parent;
        if (done.has(box)) continue;
        done.add(box);
        const r = box.getBoundingClientRect();
        if (r.width < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
        if (!parent.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        // Only text that is on top where it sits, not a screen sunk under another.
        const hit = document.elementFromPoint(
          Math.min(Math.max(r.left + Math.min(r.width, 40) / 2, 0), innerWidth - 1),
          Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1),
        );
        if (hit && !box.contains(hit) && !hit.contains(box) && !hit.closest(".v2-bar")) continue;
        const cs = getComputedStyle(parent);
        out.push({
          x: r.left,
          y: r.top,
          w: r.width,
          h: r.height,
          level: el ? levelOf.get(el)! : "other",
          text: `${realFace(cs)} · ${Math.round(parseFloat(cs.fontSize))}`,
        });
      }
      setTags(out);
    };

    // After the page has loaded and gone idle: a size set on text React has
    // not hydrated yet is a hydration mismatch.
    // Safari has no requestIdleCallback (QA, #239): a short timeout there.
    let stop = () => {};
    let ready = false;
    const start = () => {
      const go = () => {
        ready = true;
        apply();
      };
      if (typeof window.requestIdleCallback === "function") {
        const id = requestIdleCallback(go, { timeout: 1500 });
        stop = () => cancelIdleCallback(id);
      } else {
        const id = setTimeout(go, 250);
        stop = () => clearTimeout(id);
      }
    };
    if (document.readyState === "complete") start();
    else addEventListener("load", start, { once: true });
    let frame = 0;
    /* QA (#239): once per quiet spell, not per frame. Re-sizing every level
       on each motion frame forced a layout a frame and brought back the
       hover lag #233 fixed. */
    let quiet = 0;
    let whole = false;
    const later = (all = true) => {
      if (!ready) return;
      whole ||= all;
      clearTimeout(quiet);
      quiet = window.setTimeout(() => {
        if (whole) apply();
        else applyAdded();
        whole = false;
      }, 300);
    };
    const redraw = () => {
      if (!ready) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    };
    /* New text only, not the bar's or the tags' own redraws, or they tag
       themselves forever. No style watching on the whole page: motion
       writes styles every frame. A line that fits itself (`fit-lines.tsx`)
       re-fits after we size it, so those few lines are watched alone. */
    watch = new MutationObserver((list) => {
      for (const m of list) {
        if ((m.target as Element).closest?.(".v2-tags, .v2-bar")) continue;
        m.addedNodes.forEach((n) => n instanceof Element && added.add(n));
      }
      if (added.size) later(false);
    });
    watch.observe(document.body, { childList: true, subtree: true });
    const all = () => later();
    fitWatch = new MutationObserver(all);
    // Only when they land after the first pass, not on every load.
    const loaded = document.fonts.status === "loaded";
    if (!loaded) void document.fonts.ready.then(all);
    addEventListener("resize", all);
    if (show) addEventListener("scroll", redraw, true);
    return () => {
      watch?.disconnect();
      fitWatch?.disconnect();
      clearTimeout(quiet);
      stop();
      removeEventListener("load", start);
      removeEventListener("resize", all);
      removeEventListener("scroll", redraw, true);
      cancelAnimationFrame(frame);
      restore();
    };
  }, [set, show, setTags]);
}

function TypeBar() {
  const [s, setS] = React.useState<State>(load);
  const [tags, setTags] = React.useState<Tag[]>([]);
  const [copied, setCopied] = React.useState(false);
  const cur = s.set[s.level];
  const change = (patch: Partial<Setting>) =>
    setS((p) => ({ ...p, set: { ...p.set, [p.level]: { ...p.set[p.level], ...patch } } }));

  React.useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
  }, [s]);

  useTypeApply(s.set, s.show, setTags);

  const copy = () => {
    const lines = ORDER.map((l) => {
      const v = s.set[l];
      return `${NAME[l]}: ${label(v.font)} ${v.cut}, size ×${+v.size.toFixed(2)}, spacing ${+v.spacing.toFixed(3)}${v.gap !== undefined ? `, line gap ${+v.gap.toFixed(2)}` : ""}`;
    });
    void navigator.clipboard.writeText(`Font v2 settings:\n${lines.join("\n")}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return createPortal(
    <>
      {s.show && (
        <div className="v2-tags" aria-hidden>
          {tags.map((g, i) => (
            <div
              key={i}
              className="v2-tag"
              style={{ left: g.x, top: g.y, width: g.w, height: g.h, color: COLOUR[g.level] }}
            >
              <span>
                {NAME[g.level]} · {g.text}
              </span>
            </div>
          ))}
        </div>
      )}
      {s.open ? (
        <div
          className="v2-bar"
          role="toolbar"
          aria-label="Type"
          style={s.at ? { left: s.at.x, top: s.at.y, bottom: "auto", translate: "none" } : undefined}
        >
          <div className="v2-row">
            <span
              className="v2-grip"
              title="Drag to move, double-click to put back"
              onDoubleClick={() => setS((p) => ({ ...p, at: null }))}
              onPointerDown={(e) => {
                const bar = e.currentTarget.closest<HTMLElement>(".v2-bar")!.getBoundingClientRect();
                const dx = e.clientX - bar.left;
                const dy = e.clientY - bar.top;
                e.currentTarget.setPointerCapture(e.pointerId);
                const move = (m: PointerEvent) =>
                  setS((p) => ({
                    ...p,
                    at: {
                      x: Math.min(Math.max(m.clientX - dx, 0), innerWidth - bar.width),
                      y: Math.min(Math.max(m.clientY - dy, 0), innerHeight - bar.height),
                    },
                  }));
                const up = () => {
                  removeEventListener("pointermove", move);
                  removeEventListener("pointerup", up);
                };
                addEventListener("pointermove", move);
                addEventListener("pointerup", up);
              }}
            >
              ⠿
            </span>
            {ORDER.map((l) => (
              <button
                key={l}
                aria-pressed={s.level === l}
                onClick={() => setS((p) => ({ ...p, level: l }))}
                style={{ "--dot": COLOUR[l] } as React.CSSProperties}
              >
                {NAME[l]}
              </button>
            ))}
            <span className="v2-gap" />
            <button aria-pressed={s.show} onClick={() => setS((p) => ({ ...p, show: !p.show }))}>
              Show fonts
            </button>
            <button onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            <button onClick={() => setS((p) => ({ ...p, set: { ...p.set, [p.level]: DEFAULTS[p.level] } }))}>
              Reset
            </button>
            <button aria-label="Hide" onClick={() => setS((p) => ({ ...p, open: false }))}>
              ×
            </button>
          </div>
          <div className="v2-row">
            {Object.keys(FACES).map((f) => (
              <button key={f} aria-pressed={cur.font === f} onClick={() => change({ font: f })}>
                {label(f)}
              </button>
            ))}
            <span className="v2-sep" />
            {CUTS.map((c) => (
              <button key={c} aria-pressed={cur.cut === c} onClick={() => change({ cut: c })}>
                {c}
              </button>
            ))}
            <span className="v2-sep" />
            <Scrub label="Size" value={cur.size} step={0.01} min={0.5} max={2} onChange={(size) => change({ size })} />
            <Scrub
              label="Spacing"
              value={cur.spacing}
              step={0.005}
              min={-0.1}
              max={0.2}
              onChange={(spacing) => change({ spacing })}
            />
            {cur.gap !== undefined && (
              <Scrub label="Line gap" value={cur.gap} step={0.01} min={0.8} max={2} onChange={(gap) => change({ gap })} />
            )}
          </div>
        </div>
      ) : (
        <button className="v2-bar v2-open" onClick={() => setS((p) => ({ ...p, open: true }))}>
          Aa
        </button>
      )}
    </>,
    document.body,
  );
}

/** A number you drag sideways (or nudge with the arrows) to change. */
function Scrub(props: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const { label, value, step, min, max, onChange } = props;
  const set = (v: number) => onChange(Math.round(Math.min(max, Math.max(min, v)) / step) * step);
  const digits = step < 0.01 ? 3 : 2;
  return (
    <span
      className="v2-scrub"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") set(value + step);
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") set(value - step);
      }}
      onPointerDown={(e) => {
        const x0 = e.clientX;
        const v0 = value;
        e.currentTarget.setPointerCapture(e.pointerId);
        const move = (m: PointerEvent) => set(v0 + Math.round((m.clientX - x0) / 4) * step);
        const up = () => {
          removeEventListener("pointermove", move);
          removeEventListener("pointerup", up);
        };
        addEventListener("pointermove", move);
        addEventListener("pointerup", up);
      }}
    >
      {label} <b>{value.toFixed(digits)}</b>
    </span>
  );
}
