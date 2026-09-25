"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/* ── the work by colour ───────────────────────────────────────────
 * A vectorscope of the palettes of the work on the page: each dot is a
 * patch of a frame, placed where a colourist's scope would put it (Cb
 * across, Cr up), drawn in its own colour.
 *
 * Julian: not a view but a button that brings it in, on the left, and it
 * answers to the hover. So it is a panel beside whatever the page is
 * showing, and the work steps over to make room (`data-scope-open` in
 * globals.css); the head opens it on the grid (`work-shell.tsx`) — the
 * strip, the grid or the list — and the page answers it: the pointer over
 * the scope picks a hue and the work outside that hue dims, a dot under
 * the pointer names its project and lights that project's dots, a cell
 * under the pointer does the same. A click holds the hue.
 *
 * The page is read, not handed down: the panel finds the cells by the
 * links in them, so the strip, the rack and the list need to know
 * nothing about it. `[data-scope="dim"]` in globals.css does the dimming.
 *
 * The samples are `public/scope.json`, written by `npm run scope`
 * (`scripts/make-scope.mts`), and fetched the first time the panel
 * opens. Only RGB is stored; position is derived here. A project added
 * since the file was written is simply absent until it is run again.
 * ─────────────────────────────────────────────────────────────── */

export type ScopeRow = { slug: string; href: string; name: string };

/** Fetched once per visit. */
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
/** How near a dot the pointer must be to name it, in CSS px. */
const NEAR_PX = 7;

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

/** The links that are the work, not the chrome around it. */
const cellsOnPage = () => {
  const main = document.querySelector("main");
  if (!main) return [];
  return Array.from(main.querySelectorAll<HTMLAnchorElement>("a[href]")).filter(
    (a) => !a.closest("nav, header, footer, #work-filter, [data-scope-panel]"),
  );
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

  const [data, setData] = React.useState<Record<string, number[]> | null>(null);
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
  const bySlug = React.useMemo(
    () => new Map(rows.map((r) => [r.slug, r])),
    [rows],
  );

  /** Which projects the page is showing now, as one comparable string. */
  const [present, setPresent] = React.useState("");
  /** Where the pointer is on the scope, and where a click left the point. */
  const [aim, setAim] = React.useState<[number, number] | null>(null);
  const [held, setHeld] = React.useState<[number, number] | null>(null);
  /** The project of the dot under the pointer, and of the cell under it. */
  const [dot, setDot] = React.useState<string | null>(null);
  const [cell, setCell] = React.useState<string | null>(null);
  const [brand, setBrand] = React.useState("");

  /* Each project on the page as scope positions. */
  const placed = React.useMemo(() => {
    const on = new Set(present.split(" "));
    return rows.flatMap((row) => {
      const pts = data?.[row.slug];
      if (!pts?.length || !on.has(row.slug)) return [];
      const xy: number[] = [];
      for (let i = 0; i < pts.length; i += 3) {
        const [cb, cr] = cbcr(pts[i], pts[i + 1], pts[i + 2]);
        xy.push(cb, cr);
      }
      return [{ slug: row.slug, pts, xy }];
    });
  }, [rows, data, present]);

  const point = aim ?? held;
  const hueHits = React.useMemo(() => {
    if (!point || Math.hypot(point[0], point[1]) < NEUTRAL) return null;
    /* By hue rather than by distance: a brand colour is usually more
       saturated than anything in a photograph, and a distance test found
       nothing out there. */
    const aimAt = Math.atan2(point[1], point[0]);
    const floor = Math.hypot(point[0], point[1]) * DEPTH;
    const hits = new Set<string>();
    for (const p of placed) {
      let near = 0;
      for (let i = 0; i < p.xy.length; i += 2) {
        if (Math.hypot(p.xy[i], p.xy[i + 1]) < floor) continue;
        let d = Math.abs(Math.atan2(p.xy[i + 1], p.xy[i]) - aimAt);
        if (d > Math.PI) d = 2 * Math.PI - d;
        if (d < REACH) near++;
      }
      if (near / (p.xy.length / 2 || 1) >= KEEP) hits.add(p.slug);
    }
    return hits;
  }, [placed, point]);

  /* The page follows the hue, never the dot: the dots are dense enough
     that the pointer is nearly always beside one, and the page narrowing
     to a single project under every move hid the hue altogether. */
  const lit = hueHits;
  /** Whose dots the scope shows lit. */
  const focus = cell ?? dot;

  /* ── the page answers ── */
  const litRef = React.useRef(lit);
  React.useEffect(() => {
    litRef.current = lit;
  });
  const mark = React.useCallback(() => {
    const on = litRef.current;
    const seen = new Set<string>();
    for (const a of cellsOnPage()) {
      const row = byHref.get(a.getAttribute("href") ?? "");
      if (!row) continue;
      seen.add(row.slug);
      const box = a.closest<HTMLElement>("[data-tick]") ?? a;
      box.dataset.scope = on && !on.has(row.slug) ? "dim" : "on";
      box.dataset.scopeSlug = row.slug;
    }
    const key = [...seen].sort().join(" ");
    setPresent((k) => (k === key ? k : key));
  }, [byHref]);

  const litKey = lit ? [...lit].sort().join(" ") : "";
  React.useEffect(() => {
    if (!open) return;
    // A frame on, like every other pass: the cells are the page's own.
    const frame = requestAnimationFrame(mark);
    return () => cancelAnimationFrame(frame);
  }, [open, mark, litKey]);

  /* A filter, a view or a search puts different cells on the page. */
  React.useEffect(() => {
    if (!open) return;
    const main = document.querySelector("main");
    if (!main) return;
    let frame = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(mark);
    });
    mo.observe(main, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      cancelAnimationFrame(frame);
      for (const el of document.querySelectorAll<HTMLElement>("[data-scope]")) {
        delete el.dataset.scope;
        delete el.dataset.scopeSlug;
      }
    };
  }, [open, mark]);

  /* A cell under the pointer lights its own dots; Escape puts it away. */
  React.useEffect(() => {
    if (!open) return;
    const over = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(
        "[data-scope-slug]",
      );
      const slug = el?.dataset.scopeSlug ?? null;
      setCell((c) => (c === slug ? c : slug));
    };
    const key = (e: KeyboardEvent) => {
      // The viewer takes its own Escape.
      if (e.key === "Escape" && !document.querySelector("[data-zoom-box]"))
        onClose();
    };
    document.addEventListener("pointerover", over, { passive: true });
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerover", over);
      window.removeEventListener("keydown", key);
      setCell(null);
    };
  }, [open, onClose]);

  /* The work makes room for it rather than sliding under it. */
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
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [open]);

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
      const size1 = Math.max(1.2, size / 260);
      const quiet = dark ? 0.3 : 0.45;
      for (const p of placed) {
        const on = focus ? p.slug === focus : !lit || lit.has(p.slug);
        ctx.globalAlpha = focus ? (on ? 0.95 : 0.04) : on ? quiet : 0.05;
        for (let i = 0, j = 0; i < p.xy.length; i += 2, j += 3) {
          const [x, y] = rim([p.xy[i], p.xy[i + 1]]);
          ctx.fillStyle = `rgb(${p.pts[j]},${p.pts[j + 1]},${p.pts[j + 2]})`;
          ctx.fillRect(c + x * k - size1 / 2, c - y * k - size1 / 2, size1, size1);
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
  }, [placed, point, focus, lit]);

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
      for (let i = 0; i < q.xy.length; i += 2) {
        const [x, y] = rim([q.xy[i], q.xy[i + 1]]);
        const d = Math.hypot(x - p[0], y - p[1]);
        if (d < bd) {
          bd = d;
          best = q.slug;
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
  const count = lit ? [...lit].length : 0;
  const named = focus ? bySlug.get(focus)?.name : null;

  if (!ever) return null;

  return createPortal(
    <aside
      id="work-scope"
      data-scope-panel
      aria-label="Colour"
      inert={!open}
      style={room ? { top: room.top, bottom: room.bottom } : undefined}
      className={cn(
        "fixed left-0 z-40 flex w-[22rem] flex-col gap-4 overflow-y-auto border-r border-border bg-background px-6 py-5 max-sm:hidden sm:pl-10",
        "transition-[translate] duration-300 ease-[var(--ease-out-strong)] motion-reduce:transition-none",
        open ? "translate-x-0" : "-translate-x-full",
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
          setHeld((h) =>
            h && Math.hypot(h[0] - p[0], h[1] - p[1]) < 4 ? null : p,
          );
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
        ) : lit ? (
          `${count} ${count === 1 ? "match" : "matches"}`
        ) : (
          <span className="text-muted-foreground">All the work</span>
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

      {/* Whose dots are lit: the dot under the pointer, or the cell. */}
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
    </aside>,
    document.body,
  );
}
