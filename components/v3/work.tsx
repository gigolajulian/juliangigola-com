"use client";

import * as React from "react";
import Image, { getImageProps } from "next/image";
import Link from "next/link";
import type { Flip as FlipT } from "gsap/Flip";
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

const STRIP_SIZES = "(max-width: 767px) 82vw, 50vh";
const GRID_SIZES = "(max-width: 700px) 50vw, (max-width: 1000px) 33vw, 25vw";

/** The covers on screen, for the view change below. */
const seen = () =>
  [...document.querySelectorAll<HTMLElement>("#p-work [data-flip-id]")].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  });

function Tile({ p, swatch, first }: { p: WorkItem; swatch?: string[]; first?: boolean }) {
  return (
    <figure className="wt">
      <Link href={`/portfolio/${p.s}`} aria-label={p.n}>
        <div className="ph" data-flip-id={p.s}>
          <Image
            src={p.cover}
            alt={p.n}
            fill
            sizes={GRID_SIZES}
            decoding="sync"
            /* The first rows load at once: back from the strip, lazy covers
               waited a beat and landed as empty cards. */
            loading={first ? "eager" : "lazy"}
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

export type FrameItem = { s: string; src: string; alt: string; wide: boolean; sq: boolean };
const WIDE_SIZES = "(max-width: 700px) 100vw, (max-width: 1000px) 66vw, 50vw";

function FrameTile({ f, first, onOpen }: { f: FrameItem; first?: boolean; onOpen: () => void }) {
  return (
    <figure className={f.wide ? "wt wide" : "wt"}>
      {/* A gallery's frame opens full size here, not its project: Graduation
          and Headshots have none, and their address leads to the booking page.
          Ctrl and cmd click open the viewer too (Julian); a middle click opens
          the photo itself. */}
      <a
        href={f.src}
        onClick={(e) => {
          e.preventDefault();
          onOpen();
        }}
      >
        <div className="ph">
          <Image src={f.src} alt={f.alt} fill sizes={f.wide ? WIDE_SIZES : GRID_SIZES} loading={first ? "eager" : "lazy"} />
        </div>
      </a>
    </figure>
  );
}

/** A gallery's frames full size over the page: arrows step, Escape or Back closes. */
function FrameView({ list, at, onGo, onClose }: { list: FrameItem[]; at: number | null; onGo: (n: number) => void; onClose: () => void }) {
  const ref = React.useRef<HTMLDialogElement>(null);
  // Where a touch went down, and whether it ended as a swipe (its click must not close).
  const down = React.useRef<{ x: number; y: number; axis: "x" | "y" | null } | null>(null);
  const swiped = React.useRef(false);
  // The photo's layer, and the side the last step went to (the next photo slides in from it).
  const ph = React.useRef<HTMLDivElement>(null);
  const dir = React.useRef(0);
  const open = at !== null;
  React.useLayoutEffect(() => {
    const el = ph.current;
    const by = dir.current;
    dir.current = 0;
    if (!el || !by) return;
    el.getAnimations().forEach((a) => a.cancel());
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate([{ transform: `translateX(${by * 24}%)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" });
  }, [at]);
  React.useEffect(() => {
    const d = ref.current;
    if (!open || !d) return;
    d.showModal();
    history.pushState({ frame: 1 }, "");
    const pop = () => onClose();
    addEventListener("popstate", pop);
    return () => {
      removeEventListener("popstate", pop);
      if (d.open) d.close();
      if (history.state?.frame) history.back();
    };
  }, [open, onClose]);
  if (at === null) return null;
  const f = list[at];
  const step = (by: number) => {
    dir.current = by;
    onGo((at + by + list.length) % list.length);
  };
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <dialog
      ref={ref}
      className="v3 fv"
      aria-label={f.alt}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") step(1);
        if (e.key === "ArrowLeft") step(-1);
      }}
      /* Touch: the photo follows the finger. Sideways it slides out that
         way and the next one slides in behind it; up or down it fades and
         the viewer closes. The axis locks after 10px. A new touch finishes
         a slide still running. */
      onPointerDown={(e) => {
        swiped.current = false;
        ph.current?.getAnimations().forEach((a) => a.finish());
        down.current = e.pointerType === "mouse" || (e.target as Element).closest("button") ? null : { x: e.clientX, y: e.clientY, axis: null };
      }}
      onPointerMove={(e) => {
        const d = down.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!d.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 10) d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (still()) return;
        const el = ph.current!;
        if (d.axis === "x" && list.length > 1) el.style.transform = `translateX(${dx}px)`;
        if (d.axis === "y") {
          el.style.transform = `translateY(${dy}px)`;
          el.style.opacity = String(Math.max(0.3, 1 - Math.abs(dy) / 400));
        }
      }}
      onPointerUp={(e) => {
        const d = down.current;
        down.current = null;
        const el = ph.current!;
        if (!d?.axis) return;
        const y = d.axis === "y";
        const delta = y ? e.clientY - d.y : e.clientX - d.x;
        const from = { transform: `translate${y ? "Y" : "X"}(${delta}px)`, opacity: el.style.opacity || 1 };
        el.style.transform = el.style.opacity = "";
        if (Math.abs(delta) < (y ? 90 : 40) || (!y && list.length < 2)) {
          if (!still()) el.animate([from, { transform: "none", opacity: 1 }], { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" });
          return;
        }
        swiped.current = true;
        const by = delta < 0 ? 1 : -1;
        const done = () => (y ? onClose() : step(by));
        if (still()) return done();
        const to = y ? `translateY(${-by * 30}%)` : `translateX(${-by * 40}%)`;
        el.animate([from, { transform: to, opacity: 0 }], { duration: y ? 200 : 160, easing: "ease-in", fill: "forwards" }).onfinish = done;
      }}
      onPointerCancel={() => {
        down.current = null;
        if (ph.current) ph.current.style.transform = ph.current.style.opacity = "";
      }}
      onClick={(e) => {
        if (swiped.current) return void (swiped.current = false);
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fv-ph" ref={ph}>
        <Image key={f.src} src={f.src} alt={f.alt} fill sizes="100vw" />
      </div>
      <div className="fv-bar lbl">
        <span>{String(at + 1).padStart(2, "0")} / {String(list.length).padStart(2, "0")}</span>
        <button type="button" onClick={onClose}>Close</button>
      </div>
      {list.length > 1 ? (
        <>
          <button type="button" className="fv-step prev lbl" aria-label="Previous frame" onClick={() => step(-1)}>&larr;</button>
          <button type="button" className="fv-step next lbl" aria-label="Next frame" onClick={() => step(1)}>&rarr;</button>
        </>
      ) : null}
    </dialog>
  );
}

export function V3Work({
  work,
  chip = {},
  frames = {},
}: {
  work: WorkItem[];
  chip?: Record<string, string>;
  frames?: Record<string, FrameItem[]>;
}) {
  const [filter, setFilter] = React.useState("All");
  const [at, setAt] = React.useState<number | null>(null);
  const closeView = React.useCallback(() => setAt(null), []);
  /* `?d=<slug>`: the retired discipline pages and the site's links land here
     with that chip on. Read after mount, so the page itself stays static. */
  React.useEffect(() => {
    const d = chip[new URLSearchParams(location.search).get("d") ?? ""];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (d) setFilter(d);
  }, [chip]);
  const [view, setView] = React.useState<"grid" | "strip" | "color">("grid");
  const back = React.useRef<"grid" | "strip">("grid");
  /* Grid, strip and color views, and the discipline chips: the covers on
     screen fly from where they were to where they land, new ones fade in
     (GSAP Flip). Only with ?v3motion. */
  const flip = React.useRef<ReturnType<typeof FlipT.getState> | null>(null);
  const Flip = React.useRef<typeof FlipT | null>(null);
  React.useEffect(() => {
    if (!document.documentElement.hasAttribute("data-v3motion")) return;
    void Promise.all([import("gsap"), import("gsap/Flip")]).then(([g, f]) => { g.gsap.registerPlugin(f.Flip); Flip.current = f.Flip; });
  }, []);
  const flipped = (set: () => void) => {
    if (Flip.current && !matchMedia("(prefers-reduced-motion: reduce)").matches)
      flip.current = Flip.current.getState(seen());
    set();
  };
  const go = (v: typeof view) => flipped(() => setView(v));
  const [q, setQ] = React.useState("");
  const [pick, setPick] = React.useState<PickAt | null>(null);
  const [scope, setScope] = React.useState<Scope | null>(null);
  const page = React.useRef<HTMLElement>(null);
  const strip = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const st = flip.current, F = Flip.current;
    if (!st || !F) return;
    flip.current = null;
    const w = strip.current;
    if (w) w.style.overflow = "visible"; // the strip would clip covers flying up into it
    const tl = F.from(st, {
      targets: seen(),
      duration: 0.6,
      ease: "expo.out",
      scale: true,
      stagger: 0.015,
      onEnter: (els) => els.forEach((e) => e.animate({ opacity: [0, 1] }, 300)),
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
  /* A gallery chip with no search shows its frames, not its one cover. */
  const shown = !q ? frames[filter] : undefined;
  /* The strip asks for larger files than the grid, so on a phone its covers
     flew in empty and the photos popped in after (Julian, iPhone and iPad).
     The other view's first frames are fetched and decoded while this one is
     up, both ways: back to the grid showed one grey frame too. */
  React.useEffect(() => {
    if (view === "color") return;
    const go = () => {
      for (const p of list.slice(0, view === "strip" ? 12 : 8)) {
        const { props } = getImageProps({ src: p.cover, alt: "", fill: true, sizes: view === "strip" ? GRID_SIZES : STRIP_SIZES });
        const im = new window.Image();
        if (props.sizes) im.sizes = props.sizes;
        if (props.srcSet) im.srcset = props.srcSet;
        im.src = props.src;
        im.decode().catch(() => {});
      }
    };
    const t = setTimeout(go, 1200);
    return () => clearTimeout(t);
  }, [list, view]);

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
          <h1 className="pg-t">{filter === "All" ? "Portfolio" : filter}</h1>
        </div>
        {/* One sticky glass bar on desktop; display:contents elsewhere. */}
        <div className="whead">
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
                {/* The count only on the chip that is on (Julian). */}
                {d === filter && (d === "All" || counts[d] > 1) ? (
                  <span>{d === "All" ? work.length : counts[d]}</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="chips-bar" ref={chipsBar}>
            <i />
          </div>
        </div>
        <p className="wnote lbl mute" aria-live="polite">
          {q ? `${plural(list.length)} matching “${q}”` : shown ? `${shown.length} frames` : plural(list.length)}
        </p>
        {view === "grid" && shown ? (
          <div className={shown.every((f) => f.sq) ? "wgrid wframes square" : "wgrid wframes"}>
            {shown.map((f, n) => (
              <FrameTile key={f.src} f={f} first={n < 12} onOpen={() => setAt(n)} />
            ))}
          </div>
        ) : null}
        {shown ? <FrameView list={shown} at={at} onGo={setAt} onClose={closeView} /> : null}
        {view === "grid" && !shown ? (
          <div className="wgrid">
            {list.map((p, n) => (
              <Tile key={p.s} p={p} first={n < 12} />
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
                      sizes={STRIP_SIZES}
                      decoding="sync"
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
