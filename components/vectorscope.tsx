"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ListRow } from "@/components/work-list";

/* ── the work by colour ───────────────────────────────────────────
 * A vectorscope of every project's palette: each dot is a patch of a
 * frame, placed where a colourist's scope would put it (Cb across, Cr
 * up), drawn in its own colour. Drag the point to a hue, or paste a
 * brand colour, and the grid keeps the projects that sit near it.
 * Hover a project and its own dots light up while the rest dim.
 *
 * A view on the work index, beside the list, the grid and the strip: it
 * is handed the same rows the list is and sorts them by colour.
 *
 * The samples are `public/scope.json`, written by `npm run scope`
 * (`scripts/make-scope.mts`), and fetched the first time the view opens,
 * so a visitor who never chooses it never downloads them. Only RGB is
 * stored; position is derived here, so the scale can change without a
 * rebuild. A project added since the file was written is simply absent
 * from the scope until it is run again.
 * ─────────────────────────────────────────────────────────────── */

/** Fetched once per visit and shared by every filter. */
let samples: Promise<Record<string, number[]>> | null = null;
const loadSamples = () =>
  (samples ??= fetch("/scope.json")
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))) as Promise<Record<string, number[]>>;

/** Chroma units from the middle to the rim. Footage rarely goes past half
    of the full ±128, so the scope is drawn at the gain a colourist would
    use to read it. */
const RIM = 70;
/** How far round the scope a dot may be from the point and still count. */
const REACH = (16 * Math.PI) / 180;
/** And how far out it must reach, as a share of the point's own chroma: a
    dot near the middle is close to every hue and says nothing of this one. */
const DEPTH = 0.35;
/** The share of a project's dots that must be in reach for it to stay. */
const KEEP = 0.05;
/** Inside this, the point is on neutral and everything shows. */
const NEUTRAL = 5;

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

/* The six targets a scope marks, where 75% bars land. */
const TARGETS: [string, number[]][] = [
  ["R", [191, 0, 0]],
  ["MG", [191, 0, 191]],
  ["B", [0, 0, 191]],
  ["CY", [0, 191, 191]],
  ["G", [0, 191, 0]],
  ["YL", [191, 191, 0]],
];

export function Vectorscope({
  rows,
  className,
}: {
  rows: ListRow[];
  className?: string;
}) {
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const [data, setData] = React.useState<Record<string, number[]> | null>(
    null,
  );
  React.useEffect(() => {
    let live = true;
    loadSamples().then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, []);
  /* Where the point is, in chroma units. */
  const [at, setAt] = React.useState<[number, number]>([0, 0]);
  const [hover, setHover] = React.useState<string | null>(null);
  const [brand, setBrand] = React.useState("");

  /* Each project's dots as scope positions, worked out once. */
  const placed = React.useMemo(
    () =>
      rows.flatMap((row) => {
        const pts = data?.[row.slug];
        if (!pts?.length) return [];
        const xy: number[] = [];
        for (let i = 0; i < pts.length; i += 3) {
          const [cb, cr] = cbcr(pts[i], pts[i + 1], pts[i + 2]);
          xy.push(cb, cr);
        }
        return [{ ...row, pts, xy }];
      }),
    [rows, data],
  );

  const neutral = Math.hypot(at[0], at[1]) < NEUTRAL;
  const shown = React.useMemo(() => {
    if (neutral) return placed;
    return placed
      .map((p) => {
        /* By hue rather than by distance: a brand colour is usually more
           saturated than anything in a photograph, and a distance test
           found nothing out there. */
        const aim = Math.atan2(at[1], at[0]);
        const floor = Math.hypot(at[0], at[1]) * DEPTH;
        let near = 0;
        for (let i = 0; i < p.xy.length; i += 2) {
          if (Math.hypot(p.xy[i], p.xy[i + 1]) < floor) continue;
          let d = Math.abs(Math.atan2(p.xy[i + 1], p.xy[i]) - aim);
          if (d > Math.PI) d = 2 * Math.PI - d;
          if (d < REACH) near++;
        }
        return { p, score: near / (p.xy.length / 2 || 1) };
      })
      .filter((s) => s.score >= KEEP)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.p);
  }, [placed, at, neutral]);

  const swatch = colourAt(at[0], at[1]);
  const { h, s } = hsl(swatch);

  /* Draw. Everything is repainted: 19k dots is a few milliseconds. */
  React.useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const paint = () => {
      const size = el.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      if (el.width !== Math.round(size * dpr)) {
        el.width = el.height = Math.round(size * dpr);
      }
      const ctx = el.getContext("2d");
      if (!ctx) return;
      const css = getComputedStyle(el);
      const fg = css.getPropertyValue("--foreground").trim() || "#eee";
      // Dark is the default; light is chosen on the root.
      const dark = !document.documentElement.matches('[data-theme="light"]');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const c = size / 2;
      const r = c - 1;
      const k = r / RIM;
      /* Held to the rim radially, so a colour past the scale sits on the
         circle in its own direction rather than in a corner. */
      const rimmed = (cb: number, cr: number) => {
        const m = Math.hypot(cb, cr);
        return m > RIM ? RIM / m : 1;
      };

      /* Graticule. */
      ctx.save();
      ctx.fillStyle = fg;
      ctx.globalAlpha = 0.05;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.fill();
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
      const dot = Math.max(1.2, size / 260);
      for (const p of placed) {
        const lit = hover === null || hover === p.slug;
        ctx.globalAlpha = hover === null ? (dark ? 0.3 : 0.45) : lit ? 0.95 : 0.04;
        for (let i = 0, j = 0; i < p.xy.length; i += 2, j += 3) {
          const s = rimmed(p.xy[i], p.xy[i + 1]);
          ctx.fillStyle = `rgb(${p.pts[j]},${p.pts[j + 1]},${p.pts[j + 2]})`;
          ctx.fillRect(
            c + p.xy[i] * s * k - dot / 2,
            c - p.xy[i + 1] * s * k - dot / 2,
            dot,
            dot,
          );
        }
      }
      ctx.restore();
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(el);
    const mo = new MutationObserver(paint);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [placed, hover]);

  /* The point follows the pointer from the first press, anywhere on the
     disc, and is held to it. */
  const fromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const half = box.width / 2;
    let cb = ((e.clientX - box.left - half) / half) * RIM;
    let cr = -((e.clientY - box.top - half) / half) * RIM;
    const m = Math.hypot(cb, cr);
    if (m > RIM) {
      cb *= RIM / m;
      cr *= RIM / m;
    }
    setAt([cb, cr]);
  };

  const match = () => {
    const m = /^#?([0-9a-f]{6})$/i.exec(brand.trim());
    if (!m) return;
    const n = parseInt(m[1], 16);
    const [cb, cr] = cbcr((n >> 16) & 255, (n >> 8) & 255, n & 255);
    // A brand colour can be past the scale; it lands on the rim in its hue.
    const len = Math.hypot(cb, cr);
    const s = len > RIM ? RIM / len : 1;
    setAt([cb * s, cr * s]);
  };

  const pct = (v: number) => `${50 + (v / RIM) * 50}%`;

  return (
    <div
      className={cn(
        /* The band under the chips, the width the strip's own row is. */
        "mx-auto mt-4 grid min-h-0 w-full max-w-[100rem] flex-1 gap-8 px-6 pb-4 sm:grid-cols-[minmax(16rem,30rem)_1fr] sm:gap-12 sm:px-10 short:mt-2",
        className,
      )}
    >
      <aside className="flex flex-col items-center gap-5 sm:justify-center">
        <div
          className="relative aspect-square w-full max-w-[26rem] touch-none select-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            fromPointer(e);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e);
          }}
          role="slider"
          tabIndex={0}
          aria-label="Colour"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(h)}
          aria-valuetext={`Hue ${Math.round(h)} degrees, saturation ${Math.round(s * 100)} percent`}
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
            setAt(([a, b]) => [a + d[e.key][0], b + d[e.key][1]]);
          }}
        >
          <canvas ref={canvas} className="size-full" />
          {/* The point: a ring in the colour it stands on. */}
          <span
            aria-hidden
            className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground shadow-[0_0_0_1px_var(--background)]"
            style={{
              left: pct(at[0]),
              top: pct(-at[1]),
              backgroundColor: hex(swatch),
            }}
          />
        </div>

        <p className="label flex gap-5 tabular-nums text-muted-foreground">
          <span>
            Hue <span className="text-foreground">{String(Math.round(h)).padStart(3, "0")}&deg;</span>
          </span>
          <span>
            Sat <span className="text-foreground">{String(Math.round(s * 100)).padStart(2, "0")}%</span>
          </span>
        </p>

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
            style={{ backgroundColor: /^#?[0-9a-f]{6}$/i.test(brand.trim()) ? `#${brand.trim().replace("#", "")}` : hex(swatch) }}
          />
          <input
            id="scope-brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder={hex(swatch)}
            spellCheck={false}
            className="w-20 border-b border-border bg-transparent py-1 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground"
          />
          <button type="submit" className="label text-muted-foreground transition-colors hoverable:hover:text-foreground">
            Match
          </button>
        </form>

        <p className="max-w-[18rem] text-center text-xs leading-relaxed text-muted-foreground">
          Drag the point, or paste a brand colour, to see the work that sits in
          it. Hover a project for its palette.
        </p>
      </aside>

      <div data-scroll className="min-h-0 overflow-y-auto pr-1">
        <p className="label mb-4 text-muted-foreground tabular-nums">
          {data === null
            ? "Reading the colours"
            : neutral
              ? "All"
              : `${shown.length} ${shown.length === 1 ? "match" : "matches"}`}
        </p>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {shown.map((p) => (
            <li key={p.slug}>
              <Link
                href={p.href}
                prefetch={false}
                className="group block"
                onPointerEnter={() => setHover(p.slug)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(p.slug)}
                onBlur={() => setHover(null)}
              >
                <span
                  className="relative block aspect-[4/5] overflow-hidden"
                  style={{ backgroundColor: p.cover.color ?? "transparent" }}
                >
                  <Image
                    src={p.cover.src}
                    alt=""
                    fill
                    sizes="(min-width: 80rem) 16vw, (min-width: 48rem) 22vw, 45vw"
                    className="object-cover transition-opacity duration-200 group-hover:opacity-90"
                  />
                </span>
                <span className="label mt-2 block truncate">{p.name}</span>
                <span className="label block truncate text-muted-foreground">{p.discipline}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
