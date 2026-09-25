"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { Frame } from "@/lib/work-types";

/* ── the work by colour ───────────────────────────────────────────
 * A vectorscope of the palettes of the work on the page: each dot is a
 * patch of a photograph, placed where a colourist's scope would put it
 * (Cb across, Cr up), drawn in its own colour.
 *
 * Julian: a button that brings it in from the left, and with it the page
 * turns to colour. The discipline rack steps away (`data-scope-open` in
 * globals.css) and in its place a grid of the projects in the hue the
 * scope is reading, the strongest first, each shown by its cover with the
 * set's dominant colours on a white plate at its top left, and the rest
 * of its photographs in that colour stacked under it, to fan out on hover
 * (`ColourTile`). The page follows the pointer over the scope as it
 * moves; a click holds the hue. A tile opens its project.
 *
 * Smooth rather than redrawn: the tiles are keyed by project, so one that
 * stays glides to its new place (`ColourGrid`) and one that arrives rises
 * in.
 *
 * Which projects are in play is read from the page, not handed down: the
 * rack is still there under the panel, so the chip that is lit still
 * decides, and the strip needs to know nothing about any of this.
 *
 * The samples are `public/scope.json`, written by `npm run scope`
 * (`scripts/make-scope.mts`), one entry per photograph, and fetched the
 * first time the panel opens. Only RGB is stored; position is derived
 * here. A project added since the file was written is simply absent until
 * it is run again.
 * ─────────────────────────────────────────────────────────────── */

export type ScopeRow = { slug: string; href: string; name: string };

/** [src, width, height, colour, dominant, r, g, b, ...] */
type Entry = [string, number, number, string, string, ...number[]];

/** Fetched once per visit. */
let samples: Promise<Record<string, Entry[]>> | null = null;
const loadSamples = () =>
  (samples ??= fetch("/scope.json")
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))) as Promise<Record<string, Entry[]>>;

/** Chroma units from the middle to the rim. Footage rarely goes past half
    of the full ±128, so the scope is drawn at the gain a colourist would
    use to read it. */
const RIM = 70;
/** How far round the scope a point may be from the hue and still count. */
const REACH = (16 * Math.PI) / 180;
/** And how far out it must reach, as a share of the hue's own chroma: a
    point near the middle is close to every hue and says nothing of this. */
const DEPTH = 0.35;
/** The share of a photograph's points that must be in reach for it to be
    in the colour. */
const KEEP = 0.25;
/** Inside this, the point is on neutral and the page shows everything. */
const NEUTRAL = 5;
/** The page follows the pointer in steps of this many chroma units, so it
    moves when the hue does and not on every pixel of the hand. */
const STEP = 2;
/** The strong ease-out the site uses for things settling into place. */
const SETTLE = "cubic-bezier(0.23, 1, 0.32, 1)";
/** The panel's width; the results start where it ends. */
const PANEL = "clamp(22rem, 31vw, 28rem)";

const cbcr = (r: number, g: number, b: number) => [
  -0.1687 * r - 0.3313 * g + 0.5 * b,
  0.5 * r - 0.4187 * g - 0.0813 * b,
];

/** The colour at a point of the scope, at mid grey's brightness. */
const colourAt = (cb: number, cr: number) => {
  const y = 128;
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return [c(y + 1.402 * cr), c(y - 0.344 * cb - 0.714 * cr), c(y + 1.772 * cb)];
};

const hsl = ([r, g, b]: number[]) => {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
  }
  const l = (max + min) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return { h: (h * 60 + 360) % 360, s };
};

const hex = (rgb: number[]) =>
  "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");

/** Held to the rim radially, so a colour past the scale sits on the
    circle in its own direction rather than in a corner. */
const rim = ([cb, cr]: [number, number]): [number, number] => {
  const m = Math.hypot(cb, cr);
  return m > RIM ? [(cb * RIM) / m, (cr * RIM) / m] : [cb, cr];
};

/* The six targets a scope marks, where 75% bars land. */
const TARGETS: [string, number[]][] = [
  ["R", [191, 0, 0]],
  ["MG", [191, 0, 191]],
  ["B", [0, 0, 191]],
  ["CY", [0, 191, 191]],
  ["G", [0, 191, 0]],
  ["YL", [191, 191, 0]],
];

type Shot = Frame & { dominant: string; pts: number[]; xy: number[] };
type Placed = { slug: string; name: string; href: string; shots: Shot[] };
type ColourSet = { p: Placed; shots: Shot[]; score: number };
/** A tile: the project's cover, and its other photographs in the colour. */
type Item = {
  p: Placed;
  shot: Shot;
  stack: Shot[];
  count: number;
  colours: string[];
};

/** The share of a photograph's points in reach of a hue. */
const inHue = (xy: number[], point: [number, number]) => {
  const aim = Math.atan2(point[1], point[0]);
  const floor = Math.hypot(point[0], point[1]) * DEPTH;
  let near = 0;
  for (let i = 0; i < xy.length; i += 2) {
    if (Math.hypot(xy[i], xy[i + 1]) < floor) continue;
    let d = Math.abs(Math.atan2(xy[i + 1], xy[i]) - aim);
    if (d > Math.PI) d = 2 * Math.PI - d;
    if (d < REACH) near++;
  }
  return near / (xy.length / 2 || 1);
};

/** Three colours of a set, the near-duplicates folded: the frames'
    dominant colours first, then, where those run out, colours sampled
    from the photographs themselves. Julian: always three. */
const swatches = (shots: Shot[]) => {
  const pool: number[][] = shots.map((s) => {
    const n = parseInt(s.dominant.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  });
  for (const s of shots)
    for (let i = 0; i + 2 < s.pts.length; i += 3) pool.push(s.pts.slice(i, i + 3));
  const out: number[][] = [];
  for (const apart of [40, 12, 0])
    for (const c of pool) {
      if (out.length === 3) break;
      if (out.every((o) => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) > apart))
        out.push(c);
    }
  while (out.length < 3) out.push(out[0] ?? [17, 17, 17]);
  return out.map(hex);
};

/** The slugs of the work the page is showing: the rack under the panel. */
const onPage = (byHref: Map<string, ScopeRow>) => {
  const main = document.querySelector("main");
  const seen = new Set<string>();
  if (!main) return "";
  for (const a of main.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    if (a.closest("nav, header, footer, #work-filter, [data-scope-panel]")) continue;
    const row = byHref.get(a.getAttribute("href") ?? "");
    if (row) seen.add(row.slug);
  }
  return [...seen].sort().join(" ");
};

export function ScopePanel({
  open,
  onClose,
  rows,
}: {
  open: boolean;
  onClose: () => void;
  rows: ScopeRow[];
}) {
  /* Mounted from the first open on, so it can slide out as well as in. */
  const [ever, setEver] = React.useState(false);
  if (open && !ever) setEver(true);

  const [data, setData] = React.useState<Record<string, Entry[]> | null>(null);
  React.useEffect(() => {
    if (!ever) return;
    let live = true;
    loadSamples().then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, [ever]);

  const byHref = React.useMemo(
    () => new Map(rows.map((r) => [r.href, r])),
    [rows],
  );

  /** Which projects the page is showing, as one comparable string. */
  const [present, setPresent] = React.useState("");
  React.useEffect(() => {
    if (!open) return;
    const main = document.querySelector("main");
    let frame = requestAnimationFrame(() => setPresent(onPage(byHref)));
    if (!main) return () => cancelAnimationFrame(frame);
    /* A chip puts different work on the page. */
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setPresent(onPage(byHref)));
    });
    mo.observe(main, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [open, byHref]);

  /** Where a click left the point. Julian: the page follows a click, not
      the hand; following the pointer redrew the grid on every move. */
  const [held, setHeld] = React.useState<[number, number] | null>(null);
  /** The hue the page is showing, in steps. */
  const at0 = held;
  const qx = at0 ? Math.round(at0[0] / STEP) : null;
  const qy = at0 ? Math.round(at0[1] / STEP) : null;
  const settled = React.useMemo<[number, number] | null>(
    () => (qx === null || qy === null ? null : [qx * STEP, qy * STEP]),
    [qx, qy],
  );
  /** The project of the set under the pointer. */
  const [over, setOver] = React.useState<string | null>(null);
  const [brand, setBrand] = React.useState("");

  /* Each project on the page, its photographs as scope positions. */
  const placed = React.useMemo<Placed[]>(() => {
    const on = new Set(present.split(" "));
    return rows.flatMap((row) => {
      const entries = data?.[row.slug];
      if (!entries?.length || !on.has(row.slug)) return [];
      const shots = entries.map(([src, width, height, color, dominant, ...pts], i) => {
        const xy: number[] = [];
        for (let k = 0; k < pts.length; k += 3) {
          const [cb, cr] = cbcr(pts[k], pts[k + 1], pts[k + 2]);
          xy.push(cb, cr);
        }
        return {
          src,
          width,
          height,
          color,
          dominant,
          alt: `${row.name}, frame ${i + 1}`,
          pts,
          xy,
        };
      });
      return [{ slug: row.slug, name: row.name, href: row.href, shots }];
    });
  }, [rows, data, present]);

  const neutral = !settled || Math.hypot(settled[0], settled[1]) < NEUTRAL;
  const sets = React.useMemo<ColourSet[]>(() => {
    if (neutral || !settled) return [];
    return placed
      .map((p) => {
        const scored = p.shots
          .map((s) => ({ s, k: inHue(s.xy, settled) }))
          .filter((x) => x.k >= KEEP)
          .sort((a, b) => b.k - a.k);
        return {
          p,
          shots: scored.map((x) => x.s),
          score: scored.reduce((n, x) => n + x.k, 0),
        };
      })
      .filter((s) => s.shots.length)
      .sort((a, b) => b.shots.length - a.shots.length || b.score - a.score);
  }, [placed, settled, neutral]);

  /* One tile a project, shown by its photograph nearest the colour, the
     rest of its photographs in the colour stacked under it, strongest
     first; with no colour chosen, its cover and the rest of the set. */
  const items = React.useMemo<Item[]>(
    () =>
      neutral
        ? placed.map((p) => ({
            p,
            shot: p.shots[0],
            stack: p.shots.slice(1),
            count: 0,
            colours: swatches(p.shots.slice(0, 8)),
          }))
        : sets.map((s) => ({
            p: s.p,
            shot: s.shots[0],
            stack: s.shots.slice(1),
            count: s.shots.length,
            colours: swatches(s.shots),
          })),
    [neutral, placed, sets],
  );

  /* Escape puts it away. */
  React.useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, onClose]);

  /* The rack steps away while the colour is up. */
  React.useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.dataset.scopeOpen = "";
    return () => {
      delete root.dataset.scopeOpen;
    };
  }, [open]);

  /* Between the chip row and the footer, so the head and the chips stay
     in reach while it is out. */
  const [room, setRoom] = React.useState<{ top: number; bottom: number } | null>(
    null,
  );
  React.useEffect(() => {
    if (!open) return;
    const fit = () => {
      const chips = document.querySelector('nav[aria-label="Categories"]');
      const foot = document.querySelector("footer");
      const top = chips ? chips.getBoundingClientRect().bottom + 12 : 0;
      const end = foot ? foot.getBoundingClientRect().top : window.innerHeight;
      setRoom({ top, bottom: Math.max(0, window.innerHeight - end) });
    };
    const frame = requestAnimationFrame(fit);
    window.addEventListener("resize", fit);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", fit);
    };
  }, [open]);

  const point = held;
  /** Whose dots are lit on the scope: the hovered set's. */
  const focus = over;
  const litSlugs = React.useMemo(
    () => (neutral ? null : new Set(sets.map((s) => s.p.slug))),
    [neutral, sets],
  );

  /* ── the scope ── */
  const canvas = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const paint = () => {
      const size = el.clientWidth;
      if (!size) return;
      const dpr = window.devicePixelRatio || 1;
      if (el.width !== Math.round(size * dpr)) {
        el.width = el.height = Math.round(size * dpr);
      }
      const ctx = el.getContext("2d");
      if (!ctx) return;
      const fg = getComputedStyle(el).getPropertyValue("--foreground").trim() || "#eee";
      // Dark is the default; light is chosen on the root.
      const dark = !document.documentElement.matches('[data-theme="light"]');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const c = size / 2;
      const r = c - 1;
      const k = r / RIM;

      /* Graticule. */
      ctx.save();
      ctx.fillStyle = fg;
      ctx.globalAlpha = 0.05;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.fill();
      /* The hue the point is reading, as the wedge it counts. */
      if (point && Math.hypot(point[0], point[1]) >= NEUTRAL) {
        const a = Math.atan2(point[1], point[0]);
        ctx.globalAlpha = 0.08;
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.arc(c, c, r, -a - REACH, -a + REACH);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1;
      for (const f of [1, 0.66, 0.33]) {
        ctx.beginPath();
        ctx.arc(c, c, r * f, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(c - r, c);
      ctx.lineTo(c + r, c);
      ctx.moveTo(c, c - r);
      ctx.lineTo(c, c + r);
      ctx.stroke();
      /* The skin tone line, which runs through the upper left quadrant. */
      const skin = cbcr(224, 172, 140);
      const sa = Math.atan2(skin[1], skin[0]);
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(c + Math.cos(sa) * r, c - Math.sin(sa) * r);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.45;
      ctx.font = `600 ${Math.max(8, size / 42)}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const [name, rgb] of TARGETS) {
        const [cb, cr] = cbcr(rgb[0], rgb[1], rgb[2]);
        const a = Math.atan2(cr, cb);
        ctx.fillText(name, c + Math.cos(a) * r * 0.86, c - Math.sin(a) * r * 0.86);
      }
      ctx.restore();

      /* Dots. Additive on a dark ground so dense colour glows the way a
         scope trace does; plain alpha on a light one. */
      ctx.save();
      ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
      const dot1 = Math.max(1.2, size / 260);
      const quiet = dark ? 0.3 : 0.45;
      for (const p of placed) {
        const on = focus ? p.slug === focus : !litSlugs || litSlugs.has(p.slug);
        ctx.globalAlpha = focus ? (on ? 0.95 : 0.04) : on ? quiet : 0.05;
        for (const s of p.shots) {
          for (let i = 0, j = 0; i < s.xy.length; i += 2, j += 3) {
            const [x, y] = rim([s.xy[i], s.xy[i + 1]]);
            ctx.fillStyle = `rgb(${s.pts[j]},${s.pts[j + 1]},${s.pts[j + 2]})`;
            ctx.fillRect(c + x * k - dot1 / 2, c - y * k - dot1 / 2, dot1, dot1);
          }
        }
      }
      ctx.restore();
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(el);
    const mo = new MutationObserver(paint);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [placed, point, focus, litSlugs]);

  /* The pointer, in chroma units and held to the disc. */
  const at = (e: React.MouseEvent<HTMLDivElement>): [number, number] => {
    const box = e.currentTarget.getBoundingClientRect();
    const half = box.width / 2;
    return rim([
      ((e.clientX - box.left - half) / half) * RIM,
      -((e.clientY - box.top - half) / half) * RIM,
    ]);
  };
  const match = () => {
    const m = /^#?([0-9a-f]{6})$/i.exec(brand.trim());
    if (!m) return;
    const n = parseInt(m[1], 16);
    const [cb, cr] = cbcr((n >> 16) & 255, (n >> 8) & 255, n & 255);
    // A brand colour can be past the scale; it lands on the rim in its hue.
    setHeld(rim([cb, cr]));
  };

  const swatch = point ? colourAt(point[0], point[1]) : null;
  const { h, s } = hsl(swatch ?? [128, 128, 128]);
  const pct = (v: number) => `${50 + (v / RIM) * 50}%`;
  const count = items.length;
  const named = focus ? rows.find((r) => r.slug === focus)?.name : null;

  if (!ever) return null;

  return createPortal(
    <>
      <aside
        id="work-scope"
        data-scope-panel
        aria-label="Colour"
        inert={!open}
        style={{
          width: PANEL,
          ...(room ? { top: room.top, bottom: room.bottom } : null),
        }}
        className={cn(
          "fixed left-0 z-40 flex flex-col gap-4 overflow-y-auto border-r border-border bg-background px-6 py-5 max-sm:hidden sm:pl-10",
          /* In from the left. `starting:` is the first frame after it is
             put on the page, which the open used to skip: it mounted
             already in place and simply appeared. The drawer curve and
             half a second, so the travel is seen: on the site's strong
             ease-out it was home within 120ms and read as a pop. */
          "transition-[translate] duration-[520ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          open ? "translate-x-0 starting:-translate-x-full" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <p className="label">Colour</p>
          <button
            type="button"
            onClick={onClose}
            data-ring="Close"
            className="label text-muted-foreground transition-colors hoverable:hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div
          className="relative aspect-square w-full shrink-0 cursor-crosshair touch-none select-none"
          onClick={(e) => {
            const p = at(e);
            // A click on the held point lets it go; anywhere else moves it.
            const release = held && Math.hypot(held[0] - p[0], held[1] - p[1]) < 4;
            setHeld(release ? null : p);
          }}
          role="slider"
          tabIndex={0}
          aria-label="Colour"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(h)}
          aria-valuetext={
            point
              ? `Hue ${Math.round(h)} degrees, saturation ${Math.round(s * 100)} percent`
              : "No colour chosen"
          }
          onKeyDown={(e) => {
            const step = e.shiftKey ? 8 : 2;
            const d: Record<string, [number, number]> = {
              ArrowLeft: [-step, 0],
              ArrowRight: [step, 0],
              ArrowUp: [0, step],
              ArrowDown: [0, -step],
            };
            if (!d[e.key]) return;
            e.preventDefault();
            setHeld((h) => rim([(h?.[0] ?? 0) + d[e.key][0], (h?.[1] ?? 0) + d[e.key][1]]));
          }}
        >
          <canvas ref={canvas} className="size-full" />
          {held ? (
            /* The held point: a ring in the colour it stands on. */
            <span
              aria-hidden
              className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground shadow-[0_0_0_1px_var(--background)]"
              style={{
                left: pct(held[0]),
                top: pct(-held[1]),
                backgroundColor: hex(colourAt(held[0], held[1])),
              }}
            />
          ) : null}
        </div>

        <p className="label min-h-[1lh] truncate tabular-nums" aria-live="polite">
          {data === null ? (
            <span className="text-muted-foreground">Reading the colours</span>
          ) : neutral ? (
            <span className="text-muted-foreground">All the work</span>
          ) : (
            `${count} ${count === 1 ? "project" : "projects"} in this colour`
          )}
        </p>
        <p
          className={cn(
            "label -mt-3 flex gap-5 tabular-nums text-muted-foreground",
            !point && "invisible",
          )}
        >
          <span>
            Hue{" "}
            <span className="text-foreground">
              {String(Math.round(h)).padStart(3, "0")}°
            </span>
          </span>
          <span>
            Sat{" "}
            <span className="text-foreground">
              {String(Math.round(s * 100)).padStart(2, "0")}%
            </span>
          </span>
        </p>
        {/* Whose dots are lit: the set under the pointer. */}
        <p className="label -mt-2 min-h-[1lh] truncate">{named}</p>

        <form
          className="flex items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            match();
          }}
        >
          <label htmlFor="scope-brand" className="label text-muted-foreground">
            Brand colour
          </label>
          <span
            aria-hidden
            className="size-3 shrink-0 rounded-full border border-border"
            style={{
              backgroundColor: /^#?[0-9a-f]{6}$/i.test(brand.trim())
                ? `#${brand.trim().replace("#", "")}`
                : swatch
                  ? hex(swatch)
                  : "transparent",
            }}
          />
          <input
            id="scope-brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="#a77262"
            spellCheck={false}
            className="w-20 border-b border-border bg-transparent py-1 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground"
          />
          <button
            type="submit"
            className="label text-muted-foreground transition-colors hoverable:hover:text-foreground"
          >
            Match
          </button>
        </form>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Click the scope to find a colour in the work. Click the point again to let it go.
        </p>
      </aside>

      {/* The page, in colour: where the rack was, beside the panel. */}
      {open ? (
        <section
          data-scope-panel
          data-scroll
          aria-label="The work in this colour"
          style={{
            left: PANEL,
            ...(room ? { top: room.top, bottom: room.bottom } : null),
          }}
          className="fixed right-0 z-30 overflow-y-auto overscroll-contain bg-background px-6 pb-10 pt-1 max-sm:hidden sm:px-10 transition-opacity duration-300 starting:opacity-0"
        >
          {data === null ? null : items.length ? (
            <ColourGrid items={items} onOver={setOver} />
          ) : (
            <p className="label text-muted-foreground">Nothing in this colour yet</p>
          )}
        </section>
      ) : null}
    </>,
    document.body,
  );
}

/* ── the grid ─────────────────────────────────────────────────────
 * Laid out by CSS, moved by FLIP: after each change every tile that was
 * already on the page is put back where it was and let go, so it glides to
 * its new place instead of jumping, and a new one rises in. Offsets, not
 * rects, so a scrolled grid measures the same.
 * ─────────────────────────────────────────────────────────────── */
const ColourGrid = React.memo(function ColourGrid({
  items,
  onOver,
}: {
  items: Item[];
  onOver: (slug: string | null) => void;
}) {
  const grid = React.useRef<HTMLUListElement>(null);
  /** The set whose fan is open. Julian: the rest step back so it is the
      one in focus. */
  const [focus, setFocus] = React.useState<string | null>(null);
  const was = React.useRef(new Map<string, { x: number; y: number }>());
  const order = items.map((i) => i.p.slug).join(" ");
  React.useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const now = new Map<string, { x: number; y: number }>();
    let fresh = 0;
    for (const li of Array.from(el.children) as HTMLElement[]) {
      const slug = li.dataset.slug ?? "";
      const at = { x: li.offsetLeft, y: li.offsetTop };
      now.set(slug, at);
      if (still) continue;
      const from = was.current.get(slug);
      if (from) {
        const dx = from.x - at.x;
        const dy = from.y - at.y;
        if (dx || dy)
          li.animate(
            [{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }],
            { duration: 520, easing: SETTLE },
          );
      } else {
        li.animate(
          [
            { opacity: 0, translate: "0 10px", scale: "0.97" },
            { opacity: 1, translate: "0 0", scale: "1" },
          ],
          {
            duration: 420,
            easing: SETTLE,
            delay: Math.min(fresh++, 14) * 22,
            fill: "backwards",
          },
        );
      }
    }
    was.current = now;
  }, [order]);

  return (
    <ul
      ref={grid}
      className="relative grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-x-4 gap-y-6"
    >
      {items.map((item) => (
        <li
          key={item.p.slug}
          data-slug={item.p.slug}
          onPointerEnter={() => onOver(item.p.slug)}
          onPointerLeave={() => onOver(null)}
          className="transition-opacity duration-300 ease-[var(--ease-out-strong)]"
          style={{ opacity: focus && focus !== item.p.slug ? 0.2 : 1 }}
        >
          <ColourTile item={item} onFocus={setFocus} />
        </li>
      ))}
    </ul>
  );
});

/** Between the photographs in the fan, and inside its panel. */
const FAN_GAP = 8;

const photoHref = (href: string, s: Shot) =>
  `${href}#photo-${s.src.split("/").pop()?.replace(/\.jpg$/i, "")}`;

/* A project, shown by its photograph nearest the colour. The rest of its
   photographs in the colour sit under it as a stack, two edges peeking
   out; the pointer resting on it fans them out beside it, over the grid,
   and the other sets step back (`ColourGrid`), each photograph a way
   straight to itself in the project (`cellFor` in strip.tsx). Julian asked
   for a quick look at the rest rather than every photograph in the set at
   once. Laid out the moment the pointer arrives, so the photographs are
   already loading during the beat before it opens; in two rows as tall as
   the tile, towards whichever side has the room, with what does not fit
   counted on a last card that opens the project. Touch has no hover and
   simply opens the project. */
const ColourTile = React.memo(function ColourTile({
  item,
  onFocus,
}: {
  item: Item;
  onFocus: (slug: string | null) => void;
}) {
  const { p, shot, stack, count, colours } = item;
  const box = React.useRef<HTMLSpanElement>(null);
  const wait = React.useRef(0);
  const [open, setOpen] = React.useState(false);
  const [laid, setFan] = React.useState<{
    stack: Shot[];
    left: boolean;
    h: number;
    rows: number[][];
    more: number;
  } | null>(null);
  // Laid out for another colour's stack is not laid out for this one.
  const fan = laid?.stack === stack ? laid : null;

  const enter = () => {
    if (!stack.length || !window.matchMedia("(hover: hover)").matches) return;
    window.clearTimeout(wait.current);
    {
      const el = box.current;
      const section = el?.closest("section");
      if (!el || !section) return;
      const r = el.getBoundingClientRect();
      const s = section.getBoundingClientRect();
      const cs = getComputedStyle(section);
      // Two rows and the panel's padding come to the cover's height.
      const h = (r.height - FAN_GAP * 3) / 2;
      const right = s.right - parseFloat(cs.paddingRight) - r.right;
      const leftRoom = r.left - s.left - parseFloat(cs.paddingLeft);
      const left = leftRoom > right;
      const room = Math.max(right, leftRoom) - 16 - FAN_GAP * 2;
      const all = stack.map((f) => (h * f.width) / f.height);
      const card = h * 0.45;
      // In order, row by row; the last row keeps room for the count.
      const rows: number[][] = [[], []];
      let i = 0;
      for (const [n, row] of rows.entries()) {
        let used = 0;
        while (i < all.length) {
          const reserve = n === 1 && i < all.length - 1 ? FAN_GAP + card : 0;
          if (used + all[i] + reserve > room) break;
          row.push(all[i]);
          used += all[i] + FAN_GAP;
          i++;
        }
      }
      setFan({ stack, left, h, rows, more: all.length - i });
    }
    // A beat, so a pointer crossing the grid does not open every stack.
    wait.current = window.setTimeout(() => {
      setOpen(true);
      onFocus(p.slug);
    }, 90);
  };
  const leave = () => {
    window.clearTimeout(wait.current);
    setOpen(false);
    onFocus(null);
  };
  React.useEffect(() => () => window.clearTimeout(wait.current), []);

  const still =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      className="relative"
      style={{ zIndex: open ? 30 : undefined }}
      onPointerEnter={enter}
      onPointerLeave={leave}
    >
      <Link
        href={p.href}
        prefetch={false}
        data-ring="View project"
        className="group block"
      >
        <span className="relative isolate block">
          {/* The stack under the cover: two edges, in the set's own colours. */}
          {stack.slice(0, 2).map((f, i) => (
            <span
              key={f.src}
              aria-hidden
              className="absolute inset-0 transition-[opacity,translate] duration-300 ease-[var(--ease-out-strong)]"
              style={{
                backgroundColor: f.color,
                translate: open ? "0 0" : `${(i + 1) * 6}px 0`,
                scale: `1 ${1 - (i + 1) * 0.04}`,
                opacity: open ? 0 : 1 - i * 0.35,
                zIndex: -1 - i,
              }}
            />
          ))}
          <span
            ref={box}
            className="relative block aspect-[4/5] overflow-hidden"
            style={{ backgroundColor: shot.color }}
          >
            <Image
              src={shot.src}
              alt={shot.alt}
              fill
              sizes="(min-width: 96rem) 24vw, (min-width: 64rem) 30vw, 60vw"
              data-fade=""
              className="object-cover transition-[scale] duration-500 ease-[var(--ease-out-strong)] hoverable:group-hover:scale-[1.028]"
            />
            {/* The set's dominant colours, on a white plate at the top left. */}
            {colours.length ? (
              <span
                aria-hidden
                className="absolute left-0 top-0 z-10 flex gap-1 bg-white p-[3px]"
              >
                {colours.map((c, i) => (
                  <span key={i} className="size-3" style={{ backgroundColor: c }} />
                ))}
              </span>
            ) : null}
          </span>
        </span>
        <span className="mt-2 flex items-baseline justify-between gap-3">
          <span className="label truncate transition-colors group-hover:text-muted-foreground">
            {p.name}
          </span>
          {count ? (
            <span className="label shrink-0 tabular-nums text-muted-foreground">
              {count}
            </span>
          ) : null}
        </span>
      </Link>

      {fan ? (
        /* The padding on the cover's side bridges the gap between the
           tiles, so the pointer can cross to the fan without leaving. */
        <div
          data-fan
          className="absolute"
          style={{
            top: 0,
            [fan.left ? "right" : "left"]: "100%",
            [fan.left ? "paddingRight" : "paddingLeft"]: 16,
            pointerEvents: open ? "auto" : "none",
          }}
        >
          <div
            className={cn(
              "flex flex-col gap-2 bg-background p-2 shadow-[0_12px_32px_rgb(0_0_0/0.22)]",
              fan.left ? "items-end" : "items-start",
              !still && "transition-[opacity,scale,translate] ease-[var(--ease-out-strong)]",
            )}
            /* Opacity and transform only, from the tile's side, so the
               compositor carries it: the clip that used to wipe it open
               was repainted on every frame. */
            style={{
              transformOrigin: fan.left ? "right center" : "left center",
              scale: open ? "1" : "0.96",
              translate: open ? "0 0" : `${fan.left ? 12 : -12}px 0`,
              opacity: open ? 1 : 0,
              transitionDuration: open ? "320ms" : "160ms",
            }}
          >
            {fan.rows.map((row, r) =>
              row.length || (r === 1 && fan.more) ? (
                <div key={r} className={cn("flex gap-2", fan.left && "flex-row-reverse")}>
                  {row.map((w, n) => {
                    // Its place in the stack, for the photograph and the stagger.
                    const i = r === 0 ? n : fan.rows[0].length + n;
                    const f = stack[i];
                    return (
                      <Link
                        key={f.src}
                        href={photoHref(p.href, f)}
                        prefetch={false}
                        tabIndex={open ? undefined : -1}
                        data-ring="View photo"
                        className="relative block shrink-0 overflow-hidden"
                        style={{
                          width: w,
                          height: fan.h,
                          backgroundColor: f.color,
                          translate: open ? "0 0" : `${fan.left ? 12 : -12}px 0`,
                          opacity: open ? 1 : 0,
                          transition: still
                            ? undefined
                            : `translate 340ms ${SETTLE} ${open ? i * 18 : 0}ms, opacity 240ms ${SETTLE} ${open ? i * 18 : 0}ms`,
                        }}
                      >
                        <Image
                          src={f.src}
                          alt={f.alt}
                          fill
                          sizes={`${Math.ceil(w)}px`}
                          data-fade=""
                          className="object-cover"
                        />
                      </Link>
                    );
                  })}
                  {r === 1 && fan.more ? (
                    <Link
                      href={p.href}
                      prefetch={false}
                      tabIndex={open ? undefined : -1}
                      data-ring="View project"
                      className="label flex shrink-0 items-center justify-center bg-foreground/[0.06] text-muted-foreground"
                      style={{ width: fan.h * 0.45, height: fan.h }}
                    >
                      +{fan.more}
                    </Link>
                  ) : null}
                </div>
              ) : null,
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
});
