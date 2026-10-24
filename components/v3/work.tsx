"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { V3Foot } from "@/components/v3/chrome";
import DISC from "@/lib/discipline-order.json";

/* JG V3 Portfolio (master v39, /work): search, discipline chips, and the
   Grid, Strip and Color views. Best first (lib's order: the vectorscope's
   DOPE list, then the site's running order). */

export type WorkItem = {
  s: string;
  n: string;
  d: string[];
  c: string;
  cover: string;
};
type Scope = Record<string, { w: string[]; p: number[] }>;

const plural = (n: number) => `${n} ${n === 1 ? "project" : "projects"}`;
/* Vectorscope: Cb across, Cr up, as a broadcast scope draws it. */
const R = 128;
const ang = (u: number, v: number) => Math.atan2(v, u);
const dAng = (a: number, b: number) =>
  Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const rgb = (u: number, v: number) =>
  [140 + 1.402 * v, 140 - 0.344 * u - 0.714 * v, 140 + 1.772 * u].map((x) =>
    Math.max(0, Math.min(255, x | 0)),
  );
const TARGETS = (
  [
    ["R", 255, 0, 0],
    ["MG", 255, 0, 255],
    ["B", 0, 0, 255],
    ["CY", 0, 255, 255],
    ["G", 0, 255, 0],
    ["YL", 255, 255, 0],
  ] as const
).map(
  ([k, r, g, b]) =>
    [
      k,
      -0.1687 * r - 0.3313 * g + 0.5 * b,
      0.5 * r - 0.4187 * g - 0.0813 * b,
    ] as const,
);
type PickAt = { a: number; c: number };

gsap.registerPlugin(Flip);

/** The covers on screen, for the view change below. */
const seen = () =>
  [...document.querySelectorAll<HTMLElement>("#p-work [data-flip-id]")].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  });

function Tile({ p, swatch }: { p: WorkItem; swatch?: string[] }) {
  return (
    <figure className="wt">
      <Link href={`/portfolio/${p.s}`} aria-label={p.n}>
        <div className="ph" data-flip-id={p.s}>
          <Image
            src={p.cover}
            alt={p.n}
            fill
            sizes="(max-width: 700px) 50vw, (max-width: 1000px) 33vw, 25vw"
          />
          {swatch ? (
            <span className="sw">
              {swatch.map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
            </span>
          ) : null}
        </div>
      </Link>
      <figcaption className="lbl">
        <span>{p.n.toUpperCase()}</span>
        <span className="mute">{p.d.join(", ")}</span>
      </figcaption>
    </figure>
  );
}

export function V3Work({ work }: { work: WorkItem[] }) {
  const [filter, setFilter] = React.useState("All");
  const [view, setView] = React.useState<"grid" | "strip" | "color">("grid");
  const back = React.useRef<"grid" | "strip">("grid");
  /* Grid, strip and color views, and the discipline chips: the covers on
     screen fly from where they were to where they land, new ones fade in
     (GSAP Flip). Only with ?v3motion. */
  const flip = React.useRef<Flip.FlipState | null>(null);
  const flipped = (set: () => void) => {
    if (document.documentElement.hasAttribute("data-v3motion") && !matchMedia("(prefers-reduced-motion: reduce)").matches)
      flip.current = Flip.getState(seen());
    set();
  };
  const go = (v: typeof view) => flipped(() => setView(v));
  const [q, setQ] = React.useState("");
  const [pick, setPick] = React.useState<PickAt | null>(null);
  const [scope, setScope] = React.useState<Scope | null>(null);
  const page = React.useRef<HTMLElement>(null);
  const strip = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const st = flip.current;
    if (!st) return;
    flip.current = null;
    const w = strip.current;
    if (w) w.style.overflow = "visible"; // the strip would clip covers flying up into it
    const tl = Flip.from(st, {
      targets: seen(),
      duration: 0.6,
      ease: "expo.out",
      scale: true,
      stagger: 0.015,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: 0.3 }),
      onComplete: () => void (w && (w.style.overflow = "")),
    });
    return () => void tl.progress(1);
  }, [view, filter]);
  const bar = React.useRef<HTMLDivElement>(null);
  const chips = React.useRef<HTMLDivElement>(null);
  const chipsBar = React.useRef<HTMLDivElement>(null);
  const cv = React.useRef<HTMLCanvasElement>(null);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of work) for (const d of p.d) c[d] = (c[d] ?? 0) + 1;
    return c;
  }, [work]);
  const order = React.useMemo(
    /* Julian's order from the Work Order page, then any new discipline by count. */
    () => {
      const rank = (d: string) => (DISC.indexOf(d) + 1 || DISC.length + 1);
      return Object.keys(counts).sort((a, b) => rank(a) - rank(b) || counts[b] - counts[a]);
    },
    [counts],
  );
  const list = React.useMemo(
    () =>
      work.filter(
        (p) =>
          (filter === "All" || p.d.includes(filter)) &&
          (!q || `${p.n} ${p.d.join(" ")} ${p.c}`.toLowerCase().includes(q)),
      ),
    [work, filter, q],
  );

  /* The scope's points arrive with the Color view, not with the page. */
  React.useEffect(() => {
    if (view !== "color" || scope) return;
    void fetch("/v3/work-scope.json")
      .then((r) => r.json())
      .then(setScope)
      .catch(() => setScope({}));
  }, [view, scope]);

  const scoreSet = React.useCallback(
    (s: string) => {
      const pts = scope?.[s]?.p ?? [];
      if (!pick) return 0;
      let hit = 0;
      const n = pts.length / 2 || 1;
      const minC = Math.max(10, pick.c * 0.45);
      for (let i = 0; i < pts.length; i += 2) {
        const u = pts[i],
          v = pts[i + 1];
        if (Math.hypot(u, v) > minC && dAng(ang(u, v), pick.a) < 0.38) hit++;
      }
      return hit / n;
    },
    [scope, pick],
  );
  const res =
    view === "color" && pick
      ? list
          .map((p) => [p, scoreSet(p.s)] as const)
          .filter(([, sc]) => sc > 0.12)
          .sort((a, b) => b[1] - a[1])
          .map(([p]) => p)
      : list;

  /* Draws the scope: rings, axes, targets, every cover's points, the pick. */
  const draw = React.useCallback(() => {
    const c = cv.current;
    if (!c || !c.clientWidth) return;
    const w = c.clientWidth,
      dpr = devicePixelRatio || 1;
    c.width = w * dpr;
    c.height = w * dpr;
    const x = c.getContext("2d")!,
      css = getComputedStyle(document.documentElement),
      m = w / 2,
      k = (w / 2 - 6) / R;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.strokeStyle = css.getPropertyValue("--line");
    x.lineWidth = 1;
    [1, 0.66, 0.33].forEach((f) => {
      x.beginPath();
      x.arc(m, m, (w / 2 - 6) * f, 0, 7);
      x.stroke();
    });
    x.beginPath();
    x.moveTo(6, m);
    x.lineTo(w - 6, m);
    x.moveTo(m, 6);
    x.lineTo(m, w - 6);
    x.stroke();
    x.fillStyle = css.getPropertyValue("--mute");
    x.font = "9px IBM Plex Mono, monospace";
    x.textAlign = "center";
    TARGETS.forEach(([t, u, v]) =>
      x.fillText(t, m + u * k * 0.82, m - v * k * 0.82 + 3),
    );
    for (const p of list) {
      const pts = scope?.[p.s]?.p ?? [];
      for (let i = 0; i < pts.length; i += 2) {
        const [r, g, b] = rgb(pts[i], pts[i + 1]);
        x.fillStyle = `rgba(${r},${g},${b},.75)`;
        x.fillRect(m + pts[i] * k - 1, m - pts[i + 1] * k - 1, 2, 2);
      }
    }
    if (pick) {
      const px = m + Math.cos(pick.a) * pick.c * k,
        py = m - Math.sin(pick.a) * pick.c * k;
      x.fillStyle = "rgba(255,255,255,.07)";
      x.beginPath();
      x.moveTo(m, m);
      x.arc(m, m, w / 2 - 6, -pick.a - 0.38, -pick.a + 0.38);
      x.closePath();
      x.fill();
      const [r, g, b] = rgb(
        Math.cos(pick.a) * pick.c,
        Math.sin(pick.a) * pick.c,
      );
      x.fillStyle = `rgb(${r},${g},${b})`;
      x.strokeStyle = css.getPropertyValue("--ink");
      x.lineWidth = 2;
      x.beginPath();
      x.arc(px, py, 8, 0, 7);
      x.fill();
      x.stroke();
    }
  }, [list, scope, pick]);
  React.useEffect(() => {
    if (view !== "color") return;
    draw();
    addEventListener("resize", draw);
    const watch = new MutationObserver(draw);
    watch.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
    });
    return () => {
      removeEventListener("resize", draw);
      watch.disconnect();
    };
  }, [view, draw]);
  const pickAt = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect(),
      k = (r.width / 2 - 6) / R;
    const u = (e.clientX - r.left - r.width / 2) / k,
      v = -(e.clientY - r.top - r.width / 2) / k;
    const again =
      pick &&
      Math.hypot(u - Math.cos(pick.a) * pick.c, v - Math.sin(pick.a) * pick.c) <
        10 / k;
    setPick(again ? null : { a: ang(u, v), c: Math.min(R, Math.hypot(u, v)) });
  };

  /* Strip: the progress bar follows the rail. */
  const stripBar = React.useCallback(() => {
    const s = strip.current,
      b = bar.current?.firstElementChild as HTMLElement | null;
    if (!s || !b) return;
    const m = s.scrollWidth - s.clientWidth;
    b.style.width = `${m > 0 ? (s.scrollLeft / m) * 100 : 100}%`;
  }, []);
  React.useEffect(() => {
    if (view !== "strip") return;
    const s = strip.current!;
    s.scrollLeft = 0;
    requestAnimationFrame(stripBar);
    /* From 768px up a vertical scroll (wheel, trackpad or finger) moves the
       row and the page stays still; below it, a native swipe with snap. */
    const wide = matchMedia("(min-width: 768px)");
    const wheel = (e: WheelEvent) => {
      if (!wide.matches) return;
      e.preventDefault();
      s.scrollLeft +=
        Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    };
    let ty: [number, number] | null = null;
    const start = (e: TouchEvent) =>
      (ty = [e.touches[0].clientX, e.touches[0].clientY]);
    const move = (e: TouchEvent) => {
      if (!wide.matches || !ty) return;
      e.preventDefault();
      const t = e.touches[0],
        dx = ty[0] - t.clientX,
        dy = ty[1] - t.clientY;
      ty = [t.clientX, t.clientY];
      s.scrollLeft += Math.abs(dy) > Math.abs(dx) ? dy : dx;
    };
    addEventListener("wheel", wheel, { passive: false });
    s.addEventListener("touchstart", start, { passive: true });
    s.addEventListener("touchmove", move, { passive: false });
    return () => {
      removeEventListener("wheel", wheel);
      s.removeEventListener("touchstart", start);
      s.removeEventListener("touchmove", move);
    };
  }, [view, list, stripBar]);

  /* Chips: one row at every width, a fade on the cut chip, and a progress
     line up to tablets. */
  const syncChips = React.useCallback(() => {
    const c = chips.current,
      i = chipsBar.current?.firstElementChild as HTMLElement | null;
    if (!c || !i) return;
    const m = c.scrollWidth - c.clientWidth,
      f = m > 0 ? c.scrollLeft / m : 1,
      vis = m > 0 ? c.clientWidth / c.scrollWidth : 1;
    i.style.width = `${vis * 100}%`;
    i.style.marginLeft = `${f * (1 - vis) * 100}%`;
    c.classList.toggle("at-end", f > 0.98);
  }, []);
  React.useEffect(() => {
    syncChips();
    addEventListener("resize", syncChips);
    /* A mouse wheel has no sideways motion: over the row it scrolls the
       chips until they run out, then the page again. */
    const c = chips.current;
    const wheel = (e: WheelEvent) => {
      if (!c || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const m = c.scrollWidth - c.clientWidth;
      if (e.deltaY > 0 ? c.scrollLeft >= m - 1 : c.scrollLeft <= 0) return;
      e.preventDefault();
      c.scrollLeft += e.deltaY;
    };
    c?.addEventListener("wheel", wheel, { passive: false });
    return () => {
      removeEventListener("resize", syncChips);
      c?.removeEventListener("wheel", wheel);
    };
  }, [syncChips]);

  const VIEWS = [
    [
      "grid",
      "Grid view",
      <svg
        key="g"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        aria-hidden="true"
      >
        <rect x="1.5" y="1.5" width="5.5" height="5.5" />
        <rect x="9" y="1.5" width="5.5" height="5.5" />
        <rect x="1.5" y="9" width="5.5" height="5.5" />
        <rect x="9" y="9" width="5.5" height="5.5" />
      </svg>,
    ],
    [
      "strip",
      "Strip view",
      <svg
        key="s"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        aria-hidden="true"
      >
        <rect x="1.5" y="2" width="3.5" height="12" />
        <rect x="6.25" y="2" width="3.5" height="12" />
        <rect x="11" y="2" width="3.5" height="12" />
      </svg>,
    ],
    [
      "color",
      "Color view",
      <svg
        key="c"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        aria-hidden="true"
      >
        <g transform="rotate(45 8 8)">
          <rect x="6.4" y=".6" width="3.2" height="4.4" rx="1.4" />
          <rect x="5.2" y="5" width="5.6" height="1.5" rx=".5" />
          <path d="M7 6.5h2l-.35 6.4L8 14.6l-.65-1.7Z" opacity=".8" />
        </g>
      </svg>,
    ],
  ] as const;

  return (
    <div className="v3 contents">
      <section
        ref={page}
        className={
          view === "strip"
            ? "v3page strip-on"
            : view === "color"
              ? "v3page color-on"
              : "v3page"
        }
        id="p-work"
      >
        <div className="pg-head">
          <h1 className="pg-t">Portfolio</h1>
        </div>
        <div className="wtools lbl">
          <label className="wsearch">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <circle
                cx="6"
                cy="6"
                r="4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="M9.4 9.4L13 13"
                stroke="currentColor"
                strokeWidth="1.3"
              />
            </svg>
            <input
              type="search"
              placeholder="Search the work"
              aria-label="Search the work by name, discipline or credit"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value.trim().toLowerCase())}
            />
          </label>
          <div className="wviews" role="group" aria-label="View">
            {/* The vectorscope is a mode of its own: on, then off back to
                the view it came from. Then Strip, and Grid in the corner. */}
            <button
              type="button"
              className="wcolor"
              aria-pressed={view === "color"}
              aria-label={VIEWS[2][1]}
              title={VIEWS[2][1]}
              onClick={() => {
                if (view === "color") go(back.current);
                else {
                  back.current = view;
                  go("color");
                }
              }}
            >
              {VIEWS[2][2]}
            </button>
            {[VIEWS[1], VIEWS[0]].map(([v, label, icon]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                aria-label={label}
                title={label}
                onClick={() => go(v)}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
        <div
          className="chips lbl"
          ref={chips}
          role="group"
          aria-label="Filter by discipline"
          onScroll={syncChips}
        >
          {["All", ...order].map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={d === filter}
              onClick={() => flipped(() => setFilter(d))}
            >
              {d}
              {d === "All" || counts[d] > 1 ? (
                <span>{d === "All" ? work.length : counts[d]}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="chips-bar" ref={chipsBar}>
          <i />
        </div>
        <p className="wnote lbl mute" aria-live="polite">
          {q ? `${plural(list.length)} matching “${q}”` : plural(list.length)}
        </p>
        {view === "grid" ? (
          <div className="wgrid">
            {list.map((p) => (
              <Tile key={p.s} p={p} />
            ))}
          </div>
        ) : null}
        {view === "strip" ? (
          <>
            <div className="wstrip" ref={strip} onScroll={stripBar}>
              {list.map((p, n) => (
                <figure key={p.s} className="sc" data-flip-id={p.s}>
                  <Link href={`/portfolio/${p.s}`} aria-label={p.n}>
                    <Image
                      src={p.cover}
                      alt={p.n}
                      fill
                      sizes="(max-width: 767px) 82vw, 50vh"
                      loading={n < 4 ? "eager" : "lazy"}
                    />
                    <figcaption>
                      <span className="lbl">{p.d.join(", ")}</span>
                      <b>{p.n}</b>
                    </figcaption>
                  </Link>
                </figure>
              ))}
            </div>
            <div className="wbar" ref={bar}>
              <i />
            </div>
          </>
        ) : null}
        {view === "color" ? (
          <div className="wscope">
            <div className="sc-panel">
              <div className="sc-head lbl">
                <span>Color</span>
                <button
                  type="button"
                  className="sc-x mute"
                  hidden={!pick}
                  onClick={() => setPick(null)}
                >
                  All the work
                </button>
              </div>
              <canvas
                ref={cv}
                aria-label="Vectorscope of every cover. Click a color to find it in the work."
                onClick={pickAt}
              />
              <p className="lbl mute">
                {pick
                  ? `${plural(res.length)} in this color`
                  : "All the work, strongest light first"}
              </p>
              <p className="sc-tip">
                Click the scope to find a color in the work. Click the point
                again to let it go.
              </p>
            </div>
            <div className="sc-res">
              {res.slice(0, 8).map((p) => (
                <Tile key={p.s} p={p} swatch={scope?.[p.s]?.w} />
              ))}
              {!res.length ? (
                <p className="mute">Nothing in this color yet.</p>
              ) : null}
            </div>
          </div>
        ) : null}
        <V3Foot />
      </section>
    </div>
  );
}
