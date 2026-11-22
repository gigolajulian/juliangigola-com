"use client";

import * as React from "react";
import { projectHref } from "@/lib/project-href";
import Image, { getImageProps } from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import type { Flip as FlipT } from "gsap/Flip";
import { PageFoot } from "@/components/site/chrome";
import DISC from "@/lib/discipline-order.json";
import { V4Drift } from "@/components/portfolio/drift";
// The canvas view loads only when it opens, not with every /portfolio visit.
const V3Canvas = dynamic(() => import("@/components/portfolio/canvas").then((m) => m.V3Canvas), { ssr: false });
import { launchSpeed, stepSpring, springSettled, frameDt } from "@/lib/motion/spring";

/** The motion plan's `out` curve for GSAP: power4.out is cubic-bezier(.23, 1, .32, 1). */
const GSAP_OUT = "power4.out";

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

/** A gallery's cover says its own name in the caption: the image stays silent so it is not read twice. */
const altOf = (p: WorkItem) => (p.d.join(", ").toLowerCase() === p.n.toLowerCase() ? "" : p.n);

/** A cover link's name: the words its caption shows, so voice control and axe label-in-name match. */
const named = (p: WorkItem) => {
  const d = p.d.join(", ");
  return d.toLowerCase() !== p.n.toLowerCase() ? `${p.n} ${d}` : p.n;
};

/** A cover's caption, on the photo: the name, then its discipline. A gallery is named for its discipline, so the label would say it twice. */
function Cap({ p, cls }: { p: WorkItem; cls: string }) {
  const d = p.d.join(", ");
  return (
    <span className={cls}>
      {/* --n: a long name sets smaller to stay near two lines; --w: its longest word still fits the cover's width. */}
      <b style={{ "--n": p.n.length, "--w": Math.max(...p.n.split(/\s+/).map((x) => x.length)) } as React.CSSProperties}>{p.n}</b>
      {/* The space keeps "THRESHOLD Editorial" two words for screen readers and label-in-name; between blocks it draws nothing. */}
      {d.toLowerCase() !== p.n.toLowerCase() ? <>{" "}<span className="lbl">{d}</span></> : null}
    </span>
  );
}

function Tile({ p, swatch, first }: { p: WorkItem; swatch?: string[]; first?: boolean }) {
  return (
    <figure className="wt">
      <Link href={projectHref(p.s)} aria-label={named(p)}>
        <div className="ph" data-flip-id={p.s}>
          <Image
            src={p.cover}
            alt={altOf(p)}
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
          <Cap p={p} cls="wt-n" />
        </div>
      </Link>
    </figure>
  );
}

export type FrameItem = { s: string; src: string; alt: string; wide: boolean; sq: boolean; back?: { src: string; alt: string } };

/* A two-sided sleeve's Front / Back switch, on the cell and in the viewer. */
function Sides({ back, onFlip }: { back: boolean; onFlip: () => void }) {
  return (
    <button type="button" className="sides lbl" aria-pressed={back} aria-label={back ? "Show front" : "Show back"} onClick={onFlip}>
      <span>Front</span> / <span>Back</span>
    </button>
  );
}
const WIDE_SIZES = "(max-width: 700px) 100vw, (max-width: 1000px) 66vw, 50vw";

/* The Front / Back label sits under the art, hidden until
   a sideways swipe flips the sleeve, or a pointer or focus stays 8 seconds. */
function useSleeve(flip: () => void) {
  const [on, setOn] = React.useState(false);
  const t = React.useRef(0);
  const from = React.useRef<{ x: number; y: number } | null>(null);
  const swiped = React.useRef(false);
  React.useEffect(() => () => clearTimeout(t.current), []);
  const wait = () => {
    clearTimeout(t.current);
    t.current = window.setTimeout(() => setOn(true), 8000);
  };
  const stop = () => {
    clearTimeout(t.current);
    setOn(false);
  };
  const end = () => {
    from.current = null;
  };
  return {
    on,
    props: {
      onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && wait(),
      onPointerLeave: (e: React.PointerEvent) => e.pointerType === "mouse" && stop(),
      onFocus: wait,
      onBlur: (e: React.FocusEvent) => !e.currentTarget.contains(e.relatedTarget) && stop(),
      onPointerDown: (e: React.PointerEvent) => {
        // A swipe fires no click, so the guard would eat the next real tap.
        swiped.current = false;
        if (e.pointerType !== "mouse") from.current = { x: e.clientX, y: e.clientY };
      },
      onPointerMove: (e: React.PointerEvent) => {
        const s = from.current;
        if (!s) return;
        const dx = e.clientX - s.x;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(e.clientY - s.y) * 1.5) return;
        from.current = null;
        swiped.current = true;
        flip();
        clearTimeout(t.current);
        setOn(true);
        t.current = window.setTimeout(() => setOn(false), 2500);
      },
      onPointerUp: end,
      onPointerCancel: end,
      // A swipe that flipped the sleeve does not also open the viewer.
      onClickCapture: (e: React.MouseEvent) => {
        if (!swiped.current) return;
        swiped.current = false;
        e.preventDefault();
        e.stopPropagation();
      },
    },
  };
}

function FrameTile({ f, first, onOpen }: { f: FrameItem; first?: boolean; onOpen: () => void }) {
  const [back, setBack] = React.useState(false);
  const sleeve = useSleeve(() => setBack((b) => !b));
  return (
    <figure className={f.wide ? "wt wide" : "wt"} data-back={back || undefined} data-sides={(f.back && sleeve.on) || undefined} {...(f.back ? sleeve.props : null)}>
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
          {f.back ? <Image className="bk" src={f.back.src} alt={back ? f.back.alt : ""} fill sizes={GRID_SIZES} loading="lazy" /> : null}
        </div>
      </a>
      {f.back ? <Sides back={back} onFlip={() => setBack(!back)} /> : null}
    </figure>
  );
}

/** A gallery's frames full size over the page: arrows step, Escape or Back closes. */
export function FrameView({ list, at, onGo, onClose }: { list: FrameItem[]; at: number | null; onGo: (n: number) => void; onClose: () => void }) {
  const ref = React.useRef<HTMLDialogElement>(null);
  /* The frame and its two neighbours sit side by side on one track, the
     neighbours loading quietly behind it, so a step is the track gliding
     over, never a swap. GSAP moves it; it loads when the viewer opens. */
  const track = React.useRef<HTMLDivElement>(null);
  const G = React.useRef<typeof import("gsap").gsap | null>(null);
  // The touch in progress: where it went down, the track's x then, its axis once locked, and its speed.
  const drag = React.useRef<{ x: number; y: number; ox: number; axis: "x" | "y" | null; lx: number; lt: number; v: number; ly: number; vy: number } | null>(null);
  /* Motion plan item 10 (docs/decisions.md): a lift hands the finger's speed
     to the strip's own spring (lib/motion/spring.ts), critically damped. */
  const run = React.useRef(0);
  const stop = () => void (cancelAnimationFrame(run.current), (run.current = 0));
  const spring = (axis: "x" | "y", to: number, fv: number, done: () => void) => {
    const el = track.current!, g = G.current!;
    stop();
    let s = { x: Number(g.getProperty(el, axis)), v: 0 };
    s.v = launchSpeed(fv, to - s.x, 1);
    let prev = 0;
    const tick = (now: number) => {
      s = stepSpring(s, to, 1, frameDt(now, prev));
      prev = now;
      if (springSettled(s, to)) return void (g.set(el, { [axis]: to }), (run.current = 0), done());
      g.set(el, { [axis]: s.x });
      run.current = requestAnimationFrame(tick);
    };
    run.current = requestAnimationFrame(tick);
  };
  const swiped = React.useRef(false); // a drag's click must not close
  const queued = React.useRef(0); // a step pressed while the track was still moving
  /* Motion plan item 8 (docs/decisions.md): a second press mid-glide takes the
     track on from where it is, never waits for the first to finish. */
  const going = React.useRef(0); // the frame the glide in flight is heading to, as a step
  const carry = React.useRef<number | null>(null); // the track's x, read against the new frame
  const open = at !== null;
  React.useEffect(() => {
    const d = ref.current;
    if (!open || !d) return;
    d.showModal();
    // Into the dialog however it opened (a tap or click left focus on the page).
    d.querySelector<HTMLButtonElement>(".fv-bar button")?.focus();
    history.pushState({ frame: 1 }, "");
    const pop = () => onClose();
    addEventListener("popstate", pop);
    void import("gsap").then((g) => (G.current = g.gsap));
    return () => {
      removeEventListener("popstate", pop);
      if (d.open) d.close();
      if (history.state?.frame) history.back();
    };
  }, [open, onClose]);
  const n = list.length;
  const wrap = (i: number) => (i + n) % n;
  // The frame showing its back, by src.
  const [bk, setBk] = React.useState<string | null>(null);
  // Any step lands on a front, a step back to a flipped sleeve included.
  const [bkAt, setBkAt] = React.useState(at);
  if (bkAt !== at) {
    setBkAt(at);
    setBk(null);
  }
  const cur = at === null ? undefined : list[at];
  const showBack = !!cur?.back && bk === cur.src;
  const still = () => !G.current || matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* From frame `from`, glide the track to the frame `by` away (0 = back to it), then make that the frame. */
  const glide = (from: number, by: number) => {
    const el = track.current!;
    const g = G.current;
    const done = () => (by ? onGo(wrap(from + by)) : undefined);
    if (still() || !g) {
      el.style.transform = "";
      return done();
    }
    g.killTweensOf(el);
    stop();
    going.current = by;
    g.to(el, { x: -by * el.offsetWidth, y: 0, duration: 0.6, ease: "power3.inOut", onComplete: done });
  };
  /* A new frame: the photos keep their elements (keyed by photo), so the
     track goes back to 0 in the same paint and nothing reloads or jumps.
     Then any step pressed mid-glide runs. */
  React.useLayoutEffect(() => {
    const el = track.current;
    if (at === null || !el) return;
    if (G.current) G.current.set(el, { x: carry.current ?? 0, y: 0 });
    else el.style.transform = "";
    carry.current = null;
    const by = queued.current;
    queued.current = 0;
    if (by) glide(at, by);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);
  if (at === null) return null;
  const f = list[at];
  const settle = (by: number) => glide(at, by);
  const step = (by: number) => {
    const g = G.current;
    if (g && track.current && g.isTweening(track.current)) {
      queued.current = by;
      if (going.current) {
        // Land the frame now, keep the pose: the next layout puts the track where it is and glides on.
        const el = track.current;
        g.killTweensOf(el);
        carry.current = Number(g.getProperty(el, "x")) + going.current * el.offsetWidth;
        onGo(wrap(at + going.current));
      }
      return;
    }
    settle(by);
  };
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
      /* Touch: the track follows the finger. Let go sideways and it glides
         on at the finger's speed to the next frame, or back; up or down past
         90px the frame slides off over the page, which shows the moment the drag turns vertical, and the viewer closes. The axis locks
         after 10px. Grabbing a glide in flight takes it from where it is. */
      onPointerDown={(e) => {
        swiped.current = false;
        if (e.pointerType === "mouse" || (e.target as Element).closest("button")) return void (drag.current = null);
        const el = track.current!;
        G.current?.killTweensOf(el);
        stop();
        const ox = G.current ? Number(G.current.getProperty(el, "x")) : 0;
        drag.current = { x: e.clientX, y: e.clientY, ox, axis: null, lx: e.clientX, lt: e.timeStamp, v: 0, ly: e.clientY, vy: 0 };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!d.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 10) d.axis = Math.abs(dx) > Math.abs(dy) && n > 1 ? "x" : "y";
        const dt = e.timeStamp - d.lt;
        if (dt > 0) d.v = 0.8 * ((e.clientX - d.lx) / dt) + 0.2 * d.v;
        if (dt > 0) d.vy = 0.8 * ((e.clientY - d.ly) / dt) + 0.2 * d.vy;
        d.lx = e.clientX;
        d.ly = e.clientY;
        d.lt = e.timeStamp;
        const g = G.current;
        if (still() || !g) return;
        if (d.axis === "x") g.set(track.current, { x: d.ox + dx });
        if (d.axis === "y") {
          ref.current!.dataset.drop = "";
          g.set(track.current, { y: dy });
        }
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        const el = track.current!;
        if (!d.axis) {
          // A tap that caught a glide in flight: let it finish.
          if (d.ox) settle(Math.round(-d.ox / el.offsetWidth));
          return;
        }
        swiped.current = true;
        const g = G.current;
        /* Item 10: a flick past 0.11px per ms pages or closes whatever the
           distance; a slow drag still needs half a frame, or 90px down. The
           frame leaves at the finger's speed on `out`, never easing in. */
        if (g && !still()) {
          const FLING = 0.11;
          if (d.axis === "y") {
            const dy = e.clientY - d.y;
            const back = () => delete ref.current!.dataset.drop;
            if (Math.abs(dy) < 90 && !(Math.abs(d.vy) > FLING && Math.sign(d.vy) === Math.sign(dy))) return spring("y", 0, d.vy, back);
            const left = innerHeight - Math.abs(dy);
            // power4.out sets off at 4x its average speed: match that to the finger.
            const dur = Math.min(0.4, Math.max(0.2, (4 * left) / Math.max(1, Math.abs(d.vy) * 1000)));
            return void g.to(el, { y: Math.sign(dy || d.vy) * innerHeight, duration: dur, ease: "power4.out", onComplete: onClose });
          }
          const W = el.offsetWidth;
          const x = d.ox + e.clientX - d.x;
          const by = Math.abs(d.v) > FLING ? -Math.sign(d.v) : Math.max(-1, Math.min(1, Math.round(-x / W)));
          return spring("x", -by * W, d.v, () => (by ? onGo(wrap(at + by)) : undefined));
        }
        if (d.axis === "y") {
          const dy = e.clientY - d.y;
          const back = () => delete ref.current!.dataset.drop;
          if (Math.abs(dy) < 90) return void (g ? g.to(el, { y: 0, duration: 0.45, ease: "expo.out", onComplete: back }) : back());
          if (still() || !g) return onClose();
          return void g.to(el, { y: Math.sign(dy) * innerHeight, duration: 0.3, ease: GSAP_OUT, onComplete: onClose }); // Motion plan item 4 (docs/decisions.md): exits leave on `out`
        }
        // Where the throw would carry the track a fifth of a second on; the nearest frame there wins.
        const x = d.ox + e.clientX - d.x + d.v * 200;
        const by = Math.max(-1, Math.min(1, Math.round(-x / el.offsetWidth)));
        settle(by);
      }}
      onPointerCancel={() => {
        if (!drag.current) return;
        drag.current = null;
        delete ref.current!.dataset.drop;
        G.current?.to(track.current, { x: 0, y: 0, duration: 0.45, ease: "expo.out" });
      }}
      onClick={(e) => {
        if (swiped.current) return void (swiped.current = false);
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* The frame centred, its neighbours a screen to each side, fetched at low priority so the frame comes first. */}
      <div className="fv-track" ref={track}>
        {(n > 2 ? [-1, 0, 1] : n === 2 ? [0, 1] : [0]).map((k) => {
          const g = list[wrap(at + k)];
          // With two frames the other one is both before and after: put it on the side it was left.
          const side = n === 2 && k === 1 ? (at === 0 ? 1 : -1) : k;
          return (
            <div className="fv-ph" key={g.src} style={{ translate: `${side * 100}% 0` }} aria-hidden={k !== 0}>
              <Image src={!k && showBack ? g.back!.src : g.src} alt={k ? "" : showBack ? g.back!.alt : g.alt} fill sizes="100vw" loading="eager" fetchPriority={k ? "low" : "high"} />
            </div>
          );
        })}
      </div>
      <div className="fv-bar lbl">
        <span>{String(at + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</span>
        {cur?.back ? <Sides back={showBack} onFlip={() => setBk(showBack ? null : cur.src)} /> : null}
        <button type="button" onClick={onClose}>Close</button>
      </div>
      {n > 1 ? (
        <>
          <button type="button" className="fv-step prev lbl" aria-label="Previous frame" onClick={() => step(-1)}><svg width="36" height="20" viewBox="0 0 36 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M35 10H2M10 2L2 10l8 8" /></svg></button>
          <button type="button" className="fv-step next lbl" aria-label="Next frame" onClick={() => step(1)}><svg width="36" height="20" viewBox="0 0 36 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M1 10h33M26 2l8 8-8 8" /></svg></button>
        </>
      ) : null}
    </dialog>
  );
}

/** Writes or clears `?view=canvas` on the address in place, with no new history entry. */
const viewUrl = (canvas: boolean) => {
  const u = new URL(location.href);
  if (canvas) u.searchParams.set("view", "canvas");
  else u.searchParams.delete("view");
  if (u.href !== location.href) history.replaceState(null, "", u);
};

/** Writes or clears `?d=<slug>` in place: Back from a project, or a reload, lands on the same filter. */
const filterUrl = (slug?: string) => {
  const u = new URL(location.href);
  if (slug) u.searchParams.set("d", slug);
  else u.searchParams.delete("d");
  if (u.href !== location.href) history.replaceState(history.state, "", u);
};

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
  const [back, setBack] = React.useState<"grid" | "strip">("grid");
  /* The canvas lies over whichever view is on, under the page's own title and
     toolbar, which stay where they are: leaving it lands
     where you were. `?view=canvas` opens on it. The address carries it while
     the canvas is on, so Back from a project it opened lands on the canvas again.
     `leaving` keeps it up for its fade out; `cvTop` is the toolbar's lower edge,
     where the canvas starts. */
  const [canvas, setCanvas] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const [cvTop, setCvTop] = React.useState(0);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (new URLSearchParams(location.search).get("view") === "canvas") setCanvas(true);
  }, []);
  const closeCanvas = React.useCallback(() => {
    viewUrl(false);
    setCanvas(false);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setLeaving(true);
  }, []);
  // An effect, so unmounting mid-fade clears the timer.
  React.useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(false), 260);
    return () => clearTimeout(t);
  }, [leaving]);
  /* The toolbar only sits in its usual place at the top of the page, so the
     canvas opens there, and starts under the toolbar's last row. */
  React.useEffect(() => {
    if (!canvas) return;
    scrollTo(0, 0);
    const measure = () => {
      const bar = document.querySelector("#p-work .whead")?.getBoundingClientRect();
      const row = document.querySelector("#p-work .chips")?.getBoundingClientRect();
      // `.whead` is a box on desktop and `display:contents` elsewhere, where the chips are the last row.
      setCvTop(Math.round(bar?.height ? bar.bottom : (row?.bottom ?? 0) + 12));
    };
    measure();
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, [canvas, filter]);
  // Open project: the canvas comes down, the address keeps `?view=canvas` for Back.
  const leaveCanvas = React.useCallback(() => setCanvas(false), []);
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
  const go = (v: typeof view | "canvas") => {
    if (v === "canvas") {
      viewUrl(true);
      setCanvas(true);
    } else if (canvas) {
      closeCanvas();
      setView(v);
    } else flipped(() => setView(v));
  };
  // The field keeps what is typed, spaces too; only the match trims (live ate the space in "brand campaigns").
  const [raw, setRaw] = React.useState("");
  const q = raw.trim().toLowerCase();
  // Touch: the field owns the row while it has focus (views step aside, the close x slides in).
  const [rowOn, setRowOn] = React.useState(false);
  // Phone: Grid, Strip and Canvas fold into the one that is on; a tap on it unfolds them.
  const [unfold, setUnfold] = React.useState(false);
  /* Option 2: once the search row scrolls under the
     header, a magnifier and the view buttons ride in the header instead of a
     second sticky bar. data-pft tells v3.css to keep them pinned when the
     header tucks on touch screens. */
  // State, not a ref: the row can remount (desktop did), and the observer must follow it.
  const [tools, setTools] = React.useState<HTMLDivElement | null>(null);
  const [pin, setPin] = React.useState(false);
  const [hs, setHs] = React.useState(false);
  // Esc or the X hands focus back to the magnifier it opened from (audit 2, WCAG 2.4.3).
  const refocus = React.useRef(false);
  const close = () => {
    refocus.current = true;
    // The header x clears, as the row's x does and as the approved mock did (MAC, 7b1a0f5d).
    setRaw("");
    setHs(false);
    // With the row back on screen the header tools must go too, not wait for the next scroll.
    dispatchEvent(new Event("scroll"));
  };
  React.useEffect(() => {
    if (!tools) return;
    // On the header slot, not <html>: a root custom property changing per frame restyles the whole grid.
    const root = document.getElementById("hdr-tools") ?? document.documentElement;
    let raf = 0;
    /* The header tools join 1:1 with the scroll: --pp runs 0 to 1 while the row slides
       under the 60px header, and v3.css rises and fades them on it. No timer, so a
       stop half way leaves them half way and scrolling back reverses them. */
    const sync = () => {
      raf = 0;
      const r = tools.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (60 - r.top) / (r.height || 1)));
      root.style.setProperty("--pp", p.toFixed(3));
      const on = p > 0;
      // iOS scrolls the page as the keyboard rises: with nothing typed yet, the open header bar stays (QA, 2026-11-04).
      const f = document.activeElement as HTMLInputElement | null;
      if (!on && f?.closest(".htools") && !f.value) return;
      // Typing in the row and scrolling it away hands the field to the header, so it stays on screen
      // with the keyboard up (MAC, iPhone, 2026-11-22); the reverse hand-back is below.
      if (p >= 1 && f?.tagName === "INPUT" && tools.contains(f)) setHs(true);
      setPin(on);
      if (on) return;
      // A short result list brings the row back: typing carries on in its field.
      if (f?.closest(".htools")) tools.querySelector("input")?.focus({ preventScroll: true });
      setHs(false);
    };
    const tick = () => void (raf ||= requestAnimationFrame(sync));
    sync();
    addEventListener("scroll", tick, { passive: true });
    addEventListener("resize", tick);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", tick);
      removeEventListener("resize", tick);
      root.style.removeProperty("--pp");
    };
  }, [tools]);
  /* / or Ctrl/Cmd+K jumps to search, never while typing somewhere else; with the row
     scrolled away it opens the header field. */
  React.useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"))) return;
      if (e.altKey || e.isComposing || !tools || canvas || at !== null) return;
      if ((e.target as HTMLElement | null)?.closest?.("input,textarea,select,[contenteditable],dialog")) return;
      e.preventDefault();
      if (!pin) tools.querySelector("input")?.focus();
      else if (hs) document.querySelector<HTMLInputElement>(".htools input")?.focus();
      else setHs(true);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [pin, hs, tools, canvas, at]);
  // An unfolded view set folds again on any tap outside it.
  React.useEffect(() => {
    if (!unfold) return;
    const away = (e: PointerEvent) => !(e.target as HTMLElement).closest?.(".vset") && setUnfold(false);
    addEventListener("pointerdown", away);
    return () => removeEventListener("pointerdown", away);
  }, [unfold]);
  // iOS pans the visual viewport as the keyboard rises, carrying a top:0 fixed bar off screen: follow the pan (QA, 2026-11-04).
  React.useEffect(() => {
    const vv = window.visualViewport;
    const el = document.querySelector<HTMLElement>(".htools");
    if (!hs || !pin || !vv || !el) return;
    const set = () => {
      // Vars, not inline translate/padding: v3.css applies them only while the header is tucked, so a
      // rotation that untucks it drops them at once (MAC, Duo, 2026-11-22).
      el.style.setProperty("--vvy", `${vv.offsetTop}px`);
      // Panned by the keyboard, the visual viewport already starts below the browser bar: no safe-area pad on top of it.
      el.style.setProperty("--vvpad", vv.offsetTop > 0 ? "0px" : "");
    };
    set();
    vv.addEventListener("scroll", set);
    vv.addEventListener("resize", set);
    return () => {
      vv.removeEventListener("scroll", set);
      vv.removeEventListener("resize", set);
      el.style.removeProperty("--vvy");
      el.style.removeProperty("--vvpad");
    };
  }, [hs, pin]);
  React.useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-pft", pin);
    return () => root.removeAttribute("data-pft");
  }, [pin]);
  const [pick, setPick] = React.useState<PickAt | null>(null);
  const [scope, setScope] = React.useState<Scope | null>(null);
  const page = React.useRef<HTMLElement>(null);
  const strip = React.useRef<HTMLDivElement>(null);
  const lastView = React.useRef(view);
  React.useLayoutEffect(() => {
    const st = flip.current, F = Flip.current;
    const swap = lastView.current !== view;
    lastView.current = view;
    if (!st || !F) return;
    flip.current = null;
    const w = strip.current;
    if (w) w.style.overflow = "visible"; // the strip would clip covers flying up into it
    /* Motion plan item 9 (docs/decisions.md): grid and strip trade places as
       one move, photo 600 on `move`, no stagger, new covers fade in 250, in
       both directions; a chip slides the tiles to their new places, page 400
       on `move`. */
    const tl = F.from(st, {
      targets: seen(),
      duration: swap ? 0.6 : 0.4,
      ease: "power3.inOut",
      scale: true,
      // The vectorscope (Color view) opens 40ms apart, the seventh on together.
      stagger: swap && view === "color" ? (i: number) => Math.min(i, 5) * 0.04 : 0,
      onEnter: (els) => els.forEach((e) => e.animate({ opacity: [0, 1] }, { duration: 250, easing: "cubic-bezier(.23,1,.32,1)" })),
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
  /* The canvas always shows every frame: a chip or a
     search sorts its projects to the front, the rest follow. */
  const field = React.useMemo(() => [...list, ...work.filter((p) => !list.includes(p))], [list, work]);
  /* A gallery chip with no search shows its frames, not its one cover. */
  const shown = !q ? frames[filter] : undefined;
  /* The strip runs a gallery out too: its chip shows every frame, and under
     All a gallery's project opens into its frames where it sits, its caption
     on the first. Cover Art stays one cell under All. */
  const cells = React.useMemo(
    (): { f?: FrameItem; p?: WorkItem }[] =>
      shown
        ? shown.map((f) => ({ f }))
        : list.flatMap((p): { f?: FrameItem; p?: WorkItem }[] => {
            const g = p.d.find((d) => d !== "Cover Art" && frames[d]);
            const own = g ? frames[g].filter((f) => f.s === p.s) : [];
            return own.length ? own.map((f, i) => ({ f, p: i ? undefined : p })) : [{ p }];
          }),
    [shown, list, frames],
  );
  const stripFrames = React.useMemo(() => cells.flatMap((c) => (c.f ? [c.f] : [])), [cells]);
  /* The strip asks for larger files than the grid, so on a phone its covers
     flew in empty and the photos popped in after (Julian, iPhone and iPad).
     The other view's first frames are fetched and decoded while this one is
     up, both ways: back to the grid showed one grey frame too. */
  /* A phone at DPR 3 paid ~760 KB for eight strip covers it might never
     open (audit v3.0.92): the timer now warms the first three, the rest
     wait for a hand on the strip button, and Save-Data skips it all. */
  const warm = React.useCallback(
    (n: number) => {
      const net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      if (view === "color" || net?.saveData || /2g|3g/.test(net?.effectiveType ?? "")) return;
      for (const p of list.slice(0, n)) {
        const { props } = getImageProps({ src: p.cover, alt: "", fill: true, sizes: view === "strip" ? GRID_SIZES : STRIP_SIZES });
        const im = new window.Image();
        if (props.sizes) im.sizes = props.sizes;
        if (props.srcSet) im.srcset = props.srcSet;
        im.src = props.src;
        im.decode().catch(() => {});
      }
    },
    [list, view],
  );
  React.useEffect(() => {
    const t = setTimeout(() => warm(view === "strip" ? 12 : 3), 1200);
    return () => clearTimeout(t);
  }, [warm, view]);

  /* On for everyone (Julian, 2026-11-22: "push to live"), ?preload=0 turns it off for a test: the lazy photos
     within 1.5 screens ahead of the scroll are asked for in reading order,
     LOOK_CAP at a time, so covers land in order and never as a burst. It
     promotes the real <img>, so each file is fetched once at its own width. */
  React.useEffect(() => {
    const net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (/[?&]preload=0/.test(location.search) || view === "color" || net?.saveData || /2g|3g/.test(net?.effectiveType ?? "")) return;
    const LOOK_CAP = 3;
    let busy = 0;
    let raf = 0;
    let first = true;
    const html = document.documentElement;
    html.dataset.preload = "";
    /* A cover fades in once its photo has landed and it is on screen, so it
       never shows as an empty card that fills later. A
       photo already there when the view mounts (cached, back from the
       strip) is shown at once, so the grid/strip flip finds it in place. */
    const reveal = () => {
      let n = 0;
      for (const f of document.querySelectorAll<HTMLElement>("#p-work :is(.wgrid .wt, .wstrip .sc):not([data-up])")) {
        const im = f.querySelector<HTMLImageElement>("img:not(.bk)");
        if (!im?.complete) continue;
        const r = f.getBoundingClientRect();
        const shown = (Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / r.height) * (Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) / r.width);
        if (first ? !shown : shown < 1 / 3) continue; // fades in once a third of it is on screen
        if (first) f.dataset.up = "0";
        else {
          f.style.setProperty("--up-d", `${Math.min(n++, 5) * 70}ms`);
          f.dataset.up = "1";
        }
      }
      first = false;
    };
    const pump = () => {
      raf = 0;
      reveal();
      const s = strip.current;
      const side = !!s && s.scrollWidth > s.clientWidth; // a phone stacks the strip: it scrolls down, like the grid
      for (const im of document.querySelectorAll<HTMLImageElement>("#p-work :is(.wgrid, .wstrip) img[loading=lazy]:not(.bk)")) {
        if (busy >= LOOK_CAP) return;
        const r = im.getBoundingClientRect();
        if (side ? r.right < 0 : r.bottom < 0) continue; // scrolled past: native lazy has it if it comes back
        if (side ? r.left > innerWidth * 2.5 : r.top > innerHeight * 2.5) return; // reading order: the rest are further still
        im.loading = "eager";
        if (im.complete) continue;
        busy++;
        const done = () => {
          busy--;
          schedule();
        };
        im.addEventListener("load", done, { once: true });
        im.addEventListener("error", done, { once: true });
      }
    };
    const schedule = () => {
      raf ||= requestAnimationFrame(pump);
    };
    schedule();
    addEventListener("scroll", schedule, { capture: true, passive: true });
    addEventListener("load", schedule, true); // a photo landing, by native lazy or this queue
    addEventListener("error", schedule, true); // a dead photo still shows its card
    return () => {
      busy = Infinity; // a load still in flight wakes nothing after this
      cancelAnimationFrame(raf);
      removeEventListener("scroll", schedule, { capture: true });
      removeEventListener("load", schedule, true);
      removeEventListener("error", schedule, true);
      delete html.dataset.preload;
    };
  }, [view, cells, list, shown]);

  /* The scope's points arrive with the Color view, not with the page. A
     failed load leaves it unset, so the next visit to Color asks again. */
  React.useEffect(() => {
    if (view !== "color" || scope) return;
    void fetch("/v3/work-scope.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`scope ${r.status}`))))
      .then(setScope)
      .catch(() => {});
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
      // The picked wedge in the theme's ink, faint: white on the dark ground, near black on the light one.
      x.fillStyle = css.getPropertyValue("--ink");
      x.globalAlpha = 0.07;
      x.beginPath();
      x.moveTo(m, m);
      x.arc(m, m, w / 2 - 6, -pick.a - 0.38, -pick.a + 0.38);
      x.closePath();
      x.fill();
      x.globalAlpha = 1;
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
    b.style.transform = `scaleX(${m > 0 ? s.scrollLeft / m : 1})`; // a scale, not a width: no layout per scroll frame
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
      if (!wide.matches || e.ctrlKey) return; // Ctrl+wheel and pinch are zoom (WCAG 1.4.4)
      e.preventDefault();
      s.scrollLeft +=
        Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    };
    /* A finger from 768px up moves the row one to one, so on lift it has
       to carry on the way iOS's own scroll does: the speed of the last
       tenth of a second, run down at iOS's normal rate (0.998 a ms).
       Without it a flick stopped dead on lift, a cover's width for a fast
       swipe (MAC, iPhone Duo open and iPad, 2026-11-08). A finger back on
       the glass catches it. */
    let ty: [number, number] | null = null;
    let moves: { t: number; d: number }[] = [];
    let glide = 0;
    // A tap that stopped a glide only stops it, as on iOS: no cover opens.
    let caught = false;
    const halt = () => {
      cancelAnimationFrame(glide);
      glide = 0;
    };
    const start = (e: TouchEvent) => {
      caught = glide !== 0;
      halt();
      moves = [];
      ty = [e.touches[0].clientX, e.touches[0].clientY];
    };
    const click = (e: MouseEvent) => {
      if (!caught) return;
      caught = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const move = (e: TouchEvent) => {
      if (!wide.matches || !ty) return;
      e.preventDefault();
      const t = e.touches[0],
        dx = ty[0] - t.clientX,
        dy = ty[1] - t.clientY;
      ty = [t.clientX, t.clientY];
      const d = Math.abs(dy) > Math.abs(dx) ? dy : dx;
      s.scrollLeft += d;
      moves.push({ t: e.timeStamp, d });
      moves = moves.filter((m) => e.timeStamp - m.t <= 100);
    };
    const end = (e: TouchEvent) => {
      ty = null;
      // A swipe that began on a glide is not a tap; let the next click through.
      if (moves.length > 1) caught = false;
      if (!wide.matches || e.touches.length || moves.length < 2) return;
      const last = moves[moves.length - 1];
      // Held still before lifting: no throw.
      if (e.timeStamp - last.t > 80) return;
      const span = Math.max(16, last.t - moves[0].t);
      let v = moves.slice(1).reduce((a, m) => a + m.d, 0) / span;
      v = Math.max(-6, Math.min(6, v));
      if (Math.abs(v) < 0.2) return;
      let at = 0;
      const step = (now: number) => {
        const dt = at ? Math.min(32, now - at) : 16;
        at = now;
        const before = s.scrollLeft;
        s.scrollLeft += v * dt;
        v *= Math.pow(0.998, dt);
        // Run out, or stopped by an end.
        if (Math.abs(v) < 0.02 || s.scrollLeft === before) {
          glide = 0;
          return;
        }
        glide = requestAnimationFrame(step);
      };
      glide = requestAnimationFrame(step);
    };
    addEventListener("wheel", wheel, { passive: false });
    s.addEventListener("touchstart", start, { passive: true });
    s.addEventListener("touchmove", move, { passive: false });
    s.addEventListener("touchend", end, { passive: true });
    s.addEventListener("touchcancel", halt, { passive: true });
    s.addEventListener("click", click, true);
    return () => {
      halt();
      removeEventListener("wheel", wheel);
      s.removeEventListener("touchstart", start);
      s.removeEventListener("touchmove", move);
      s.removeEventListener("touchend", end);
      s.removeEventListener("touchcancel", halt);
      s.removeEventListener("click", click, true);
    };
  }, [view, cells, stripBar]);

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

  const LOUPE = (
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
  );
  const rep = canvas ? "canvas" : view === "color" ? back : view;
  const fold = (act: () => void) => {
    if (!unfold && matchMedia("(max-width: 700px)").matches) return setUnfold(true);
    act();
    setUnfold(false);
  };
  const CROSS = (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
  /* One field for the row and the header: "Search" fits a 390 phone, the label says
     the rest. Esc clears, a second Esc leaves. */
  const searchField = (head: boolean) => (
    <label className={head ? "hsearch" : "wsearch"} data-has={raw ? "" : undefined}>
      {LOUPE}
      <input
        type="search"
        ref={head ? (el) => el?.focus({ preventScroll: true }) : undefined}
        placeholder="Search"
        aria-label="Search the work by name, discipline or credit"
        autoComplete="off"
        enterKeyHint="search"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onFocus={head ? undefined : () => setRowOn(true)}
        onBlur={head ? undefined : () => setRowOn(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key !== "Escape") return;
          e.preventDefault();
          if (raw) setRaw("");
          else if (head) close();
          else e.currentTarget.blur();
        }}
      />
      {head ? null : <kbd className="wkey" aria-hidden="true">/</kbd>}
      <button
        type="button"
        className="wclr"
        aria-label="Clear search"
        inert={!raw}
        onPointerDown={(e) => e.preventDefault()}
        onClick={(e) => {
          setRaw("");
          e.currentTarget.parentElement?.querySelector("input")?.focus();
        }}
      >
        <i>
          <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
            <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </i>
      </button>
    </label>
  );
  const views = (
    <div className="wviews" role="group" aria-label="View">
      {/* The vectorscope is a mode of its own: on, then off back to
          the view it came from. Then Strip, and Grid in the corner. */}
      <button
        type="button"
        className="wcolor"
        aria-pressed={!canvas && view === "color"}
        aria-label={VIEWS[2][1]}
        title={VIEWS[2][1]}
        onClick={() => {
          // Under the canvas the button is not pressed: it lands on Color, also when Color is the view lying there.
          if (view === "color" && !canvas) go(back);
          else {
            if (view !== "color") setBack(view);
            go("color");
          }
        }}
      >
        {VIEWS[2][2]}
      </button>
      {/* Grid, Strip and Canvas: one set. On a phone it folds to the view that is on
          (data-rep), and the first tap unfolds it (Julian, 2026-11-22). */}
      <div className={unfold ? "vset open" : "vset"}>
      <button type="button" aria-pressed={canvas} aria-label="Canvas view" title="Canvas view" data-rep={rep === "canvas" ? "" : undefined} onClick={() => fold(() => go("canvas"))}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            {/* Two columns out of step, their ends faded: the field runs past the edge (Julian's pick, 2026-11-14). */}
            <rect x="1.5" y="1" width="5.5" height="6.5" />
            <rect x="1.5" y="9" width="5.5" height="6" opacity=".55" />
            <rect x="9" y="1" width="5.5" height="1" opacity=".55" />
            <rect x="9" y="3.5" width="5.5" height="6.5" />
            <rect x="9" y="11.5" width="5.5" height="3.5" opacity=".55" />
          </svg>
      </button>
      {[VIEWS[1], VIEWS[0]].map(([v, label, icon]) => (
        <button
          key={v}
          type="button"
          aria-pressed={!canvas && view === v}
          aria-label={label}
          title={label}
          data-rep={rep === v ? "" : undefined}
          onPointerDown={v === "strip" ? () => warm(8) : undefined}
          onPointerEnter={v === "strip" ? () => warm(8) : undefined}
          onFocus={v === "strip" ? () => warm(8) : undefined}
          onClick={() => fold(() => go(v))}
        >
          {icon}
        </button>
      ))}
      </div>
    </div>
  );

  return (
    <div className="v3 contents">
      <V4Drift k={`${view}|${filter}|${q}|${list.length}`} />
      <section
        ref={page}
        className={
          (view === "strip" ? "v3page strip-on" : view === "color" ? "v3page color-on" : "v3page") +
          // Canvas on: everything under the toolbar hides once the canvas has faded in over it.
          (canvas ? " cv-on" : "")
        }
        id="p-work"
      >
        <div className="pg-head">
          <h1 className="pg-t">{filter === "All" ? "Portfolio" : filter}</h1>
        </div>
        {/* One sticky glass bar on desktop; display:contents elsewhere. */}
        <div className="whead">
          <div className={rowOn ? "wtools lbl on" : "wtools lbl"} ref={setTools}>
            {searchField(false)}
            {views}
            {/* Touch only (v3.css): closes the search, as Cancel does on iOS. */}
            <button
              type="button"
              className="wclose"
              aria-label="Close search"
              tabIndex={rowOn ? 0 : -1}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                setRaw("");
                (document.activeElement as HTMLElement | null)?.blur();
                setRowOn(false);
              }}
            >
              {CROSS}
            </button>
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
                onClick={() => {
                  flipped(() => setFilter(d));
                  filterUrl(Object.keys(chip).find((k) => chip[k] === d));
                }}
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
        {q && !list.length ? <p className="wnone mute">Nothing matches that search yet.</p> : null}
        {view === "grid" && shown ? (
          <div className={shown.every((f) => f.sq) ? "wgrid wframes square" : "wgrid wframes"}>
            {shown.map((f, n) => (
              <FrameTile key={f.src} f={f} first={n < 12} onOpen={() => setAt(n)} />
            ))}
          </div>
        ) : null}
        {view === "strip" ? (
          <FrameView list={stripFrames} at={at} onGo={setAt} onClose={closeView} />
        ) : shown ? (
          <FrameView list={shown} at={at} onGo={setAt} onClose={closeView} />
        ) : null}
        {view === "grid" && !shown ? (
          <div className="wgrid">
            {list.map((p, n) => (
              <Tile key={p.s} p={p} first={n < 12} />
            ))}
          </div>
        ) : null}
        {view === "strip" ? (
          <>
            {/* A new chip starts its own strip at the start: the frames it shares with All kept the old scroll. */}
            <div className="wstrip" key={filter} ref={strip} onScroll={stripBar}>
              {cells.map(({ f, p }, n) => {
                /* Name, then discipline, both on the photo, as in the grid. */
                const cap = p ? <Cap p={p} cls="sc-n" /> : null;
                if (!f)
                  return (
                    <figure key={p!.s} className="sc" data-flip-id={p!.s}>
                      <Link href={projectHref(p!.s)} aria-label={named(p!)}>
                        <Image src={p!.cover} alt={altOf(p!)} fill sizes={STRIP_SIZES} decoding="sync" loading={n < 4 ? "eager" : "lazy"} />
                        {cap}
                      </Link>
                    </figure>
                  );
                const i = stripFrames.indexOf(f);
                return (
                  <figure key={f.src} className={f.wide ? "sc wide" : f.sq ? "sc sq" : "sc"} data-flip-id={f.src}>
                    {/* Opens full size, as in the grid. */}
                    <a
                      href={f.src}
                      onClick={(e) => {
                        e.preventDefault();
                        setAt(i);
                      }}
                    >
                      <Image src={f.src} alt={f.alt} fill sizes={STRIP_SIZES} loading={n < 4 ? "eager" : "lazy"} />
                      {/* Hover shows the back. The strip swipes sideways, so no label
                          here: the viewer's bar has the switch. */}
                      {f.back ? <Image className="bk" src={f.back.src} alt="" fill sizes={STRIP_SIZES} loading="lazy" /> : null}
                      {cap}
                    </a>
                  </figure>
                );
              })}
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
        {pin &&
          document.getElementById("hdr-tools") &&
          createPortal(
            <div className={hs ? "htools lbl open" : "htools lbl"}>
              {hs ? (
                <>
                  {searchField(true)}
                  <button type="button" className="hbtn" aria-label="Close search" onClick={close}>
                    {CROSS}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="hbtn"
                  ref={(el) => {
                    if (el && refocus.current) {
                      refocus.current = false;
                      el.focus();
                    }
                  }}
                  aria-expanded={false}
                  data-on={q ? "" : undefined}
                  aria-label={q ? `Search the work, showing matches for ${q}` : "Search the work"}
                  title="Search the work"
                  onClick={() => setHs(true)}
                >
                  {LOUPE}
                </button>
              )}
              {views}
            </div>,
            document.getElementById("hdr-tools")!,
          )}
        {canvas || leaving
          ? createPortal(
              <div className="v3">
                <V3Canvas
                  list={field}
                  onClose={closeCanvas}
                  onLeave={leaveCanvas}
                  out={leaving}
                  top={cvTop}
                />
              </div>,
              document.body,
            )
          : null}
        <PageFoot />
      </section>
    </div>
  );
}
