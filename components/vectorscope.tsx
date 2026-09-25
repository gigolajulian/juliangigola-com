"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Lightbox, useLightbox } from "@/components/lightbox";
import type { Frame } from "@/lib/work-types";

/* ── the work by colour ───────────────────────────────────────────
 * A vectorscope of the palettes of the work on the page: each dot is a
 * patch of a photograph, placed where a colourist's scope would put it
 * (Cb across, Cr up), drawn in its own colour.
 *
 * Julian: a button that brings it in from the left, and with it the page
 * turns to colour. The discipline rack steps away (`data-scope-open` in
 * globals.css) and in its place every photograph in the hue the scope is
 * reading, in sets by project, the strongest first, each with its
 * dominant colours at the top left. The pointer over the scope picks the
 * hue, and the page follows once it rests; a click holds it. A photograph
 * opens in the viewer.
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
/** How near a dot the pointer must be to name it, in CSS px. */
const NEAR_PX = 7;
/** How long the pointer rests on a hue before the page follows it. */
const REST_MS = 220;
/** The panel's width; the results start where it ends. */
const PANEL = "22rem";

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

/** Up to three dominant colours of a set, the near-duplicates folded. */
const swatches = (shots: Shot[]) => {
  const out: number[][] = [];
  for (const s of shots) {
    const n = parseInt(s.dominant.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    if (out.every((o) => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) > 40))
      out.push(c);
    if (out.length === 3) break;
  }
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

  /** Where the pointer is on the scope, and where a click left the point. */
  const [aim, setAim] = React.useState<[number, number] | null>(null);
  const [held, setHeld] = React.useState<[number, number] | null>(null);
  /** The hue the page is showing: the pointer's once it rests, else held. */
  const [settled, setSettled] = React.useState<[number, number] | null>(null);
  React.useEffect(() => {
    const id = window.setTimeout(() => setSettled(aim ?? held), aim ? REST_MS : 0);
    return () => window.clearTimeout(id);
  }, [aim, held]);
  /** The project of the dot under the pointer, and of the set under it. */
  const [dot, setDot] = React.useState<string | null>(null);
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

  /* What the viewer pages through: the photographs as they are laid out. */
  const shown = React.useMemo<Shot[]>(
    () => (neutral ? placed.map((p) => p.shots[0]) : sets.flatMap((s) => s.shots)),
    [neutral, placed, sets],
  );
  const lightbox = useLightbox(shown);
  const indexOf = React.useMemo(
    () => new Map(shown.map((s, i) => [s.src, i])),
    [shown],
  );

  /* Escape puts it away; the viewer takes its own. */
  React.useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[data-zoom-box]"))
        onClose();
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

  const point = aim ?? held;
  /** Whose dots are lit on the scope: a named dot's or a hovered set's. */
  const focus = over ?? dot;
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
  const nearest = (p: [number, number], width: number) => {
    const reach = (NEAR_PX / (width / 2)) * RIM;
    let best: string | null = null;
    let bd = reach;
    for (const q of placed) {
      for (const s of q.shots) {
        for (let i = 0; i < s.xy.length; i += 2) {
          const [x, y] = rim([s.xy[i], s.xy[i + 1]]);
          const d = Math.hypot(x - p[0], y - p[1]);
          if (d < bd) {
            bd = d;
            best = q.slug;
          }
        }
      }
    }
    return best;
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
  const count = shown.length;
  const named = focus ? rows.find((r) => r.slug === focus)?.name : null;
  /** Changes whenever the page's answer does, so it arrives afresh. */
  const answer = neutral || !settled ? "all" : settled.map((v) => v.toFixed(1)).join();

  if (!ever) return null;

  const tile = (shot: Shot, delay: number) => (
    <button
      key={shot.src}
      type="button"
      data-ring="Zoom in"
      onClick={(e) =>
        lightbox.show(
          indexOf.get(shot.src) ?? 0,
          e.currentTarget.querySelector("img"),
        )
      }
      className="scope-in relative block aspect-[4/5] w-full overflow-hidden"
      style={{ backgroundColor: shot.color, animationDelay: `${delay}ms` }}
    >
      <Image
        src={shot.src}
        alt={shot.alt}
        fill
        sizes="(min-width: 96rem) 12vw, (min-width: 64rem) 16vw, 24vw"
        data-fade=""
        data-frame={shot.src}
        className="object-cover transition-[scale] duration-500 ease-[var(--ease-out-strong)] hoverable:hover:scale-[1.028]"
      />
    </button>
  );

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
          onPointerMove={(e) => {
            const p = at(e);
            setAim(p);
            const d = nearest(p, e.currentTarget.getBoundingClientRect().width);
            setDot((x) => (x === d ? x : d));
          }}
          onPointerLeave={() => {
            setAim(null);
            setDot(null);
          }}
          onClick={(e) => {
            const p = at(e);
            // A click on the held point lets it go; anywhere else moves it.
            const release = held && Math.hypot(held[0] - p[0], held[1] - p[1]) < 4;
            setHeld(release ? null : p);
            setSettled(release ? null : p);
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
            `${count} ${count === 1 ? "frame" : "frames"} in ${sets.length} ${sets.length === 1 ? "project" : "projects"}`
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
        {/* Whose dots are lit: the dot under the pointer, or the set. */}
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
          Hover the scope to find a colour in the work. Click to hold it.
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
          <div key={answer}>
            {data === null ? null : neutral ? (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
                {placed.map((p, i) => (
                  <li
                    key={p.slug}
                    onPointerEnter={() => setOver(p.slug)}
                    onPointerLeave={() => setOver(null)}
                  >
                    {tile(p.shots[0], Math.min(i, 12) * 20)}
                    <Link
                      href={p.href}
                      prefetch={false}
                      className="label mt-2 block truncate transition-colors hoverable:hover:text-muted-foreground"
                    >
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : sets.length ? (
              <div className="flex flex-col gap-10">
                {sets.map((set, i) => (
                  <section
                    key={set.p.slug}
                    onPointerEnter={() => setOver(set.p.slug)}
                    onPointerLeave={() => setOver(null)}
                    className="scope-in"
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  >
                    {/* The set's dominant colours at its top left, then
                        whose it is and how much of it is in the colour. */}
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex gap-1" aria-hidden>
                        {swatches(set.shots).map((c) => (
                          <span key={c} className="size-3" style={{ backgroundColor: c }} />
                        ))}
                      </span>
                      <Link
                        href={set.p.href}
                        prefetch={false}
                        className="label transition-colors hoverable:hover:text-muted-foreground"
                      >
                        {set.p.name}
                      </Link>
                      <span className="label tabular-nums text-muted-foreground">
                        {set.shots.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
                      {set.shots.map((shot, j) =>
                        tile(shot, Math.min(i, 8) * 40 + Math.min(j, 10) * 25),
                      )}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <p className="label text-muted-foreground">Nothing in this colour yet</p>
            )}
          </div>
        </section>
      ) : null}

      <Lightbox frames={shown} name="Colour" {...lightbox} />
    </>,
    document.body,
  );
}
