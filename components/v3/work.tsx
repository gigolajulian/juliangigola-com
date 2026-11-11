"use client";

import * as React from "react";
import Image, { getImageProps } from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import type { Flip as FlipT } from "gsap/Flip";
import { V3Foot } from "@/components/v3/chrome";
import DISC from "@/lib/discipline-order.json";
import { mplan, GSAP_OUT } from "@/lib/mplan";
// The `?canvas=1` prototype loads only when it opens, not with every /portfolio visit.
const V3Canvas = dynamic(() => import("@/components/v3/canvas").then((m) => m.V3Canvas), { ssr: false });
import { launchSpeed, stepSpring, springSettled, frameDt } from "@/lib/motion/spring";

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

/* Galleries that live on their booking page (next.config.ts pageRedirects):
   linked straight there, so a tap skips the redirect and its RSC 404 (audit 2026-11-11). */
const MOVED: Record<string, string> = { headshots: "/headshots#work", graduation: "/graduation-photos#work" };
const hrefOf = (s: string) => MOVED[s] ?? `/portfolio/${s}`;
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
      {/* --n: a long name sets smaller to stay near two lines (Julian, 2026-11-04); --w: its longest word still fits the cover's width. */}
      <b style={{ "--n": p.n.length, "--w": Math.max(...p.n.split(/\s+/).map((x) => x.length)) } as React.CSSProperties}>{p.n}</b>
      {/* The space keeps "THRESHOLD Editorial" two words for screen readers and label-in-name; between blocks it draws nothing. */}
      {d.toLowerCase() !== p.n.toLowerCase() ? <>{" "}<span className="lbl">{d}</span></> : null}
    </span>
  );
}

function Tile({ p, swatch, first }: { p: WorkItem; swatch?: string[]; first?: boolean }) {
  return (
    <figure className="wt">
      <Link href={hrefOf(p.s)} aria-label={named(p)}>
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

/* A two-sided sleeve's Front / Back switch, on the cell and in the viewer (Julian, 2026-11-05). */
function Sides({ back, onFlip }: { back: boolean; onFlip: () => void }) {
  return (
    <button type="button" className="sides lbl" aria-pressed={back} aria-label={back ? "Show front" : "Show back"} onClick={onFlip}>
      <span>Front</span> / <span>Back</span>
    </button>
  );
}
const WIDE_SIZES = "(max-width: 700px) 100vw, (max-width: 1000px) 66vw, 50vw";

/* Julian (2026-11-05): the Front / Back label sits under the art, hidden until
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
function FrameView({ list, at, onGo, onClose }: { list: FrameItem[]; at: number | null; onGo: (n: number) => void; onClose: () => void }) {
  const ref = React.useRef<HTMLDialogElement>(null);
  /* The frame and its two neighbours sit side by side on one track, the
     neighbours loading quietly behind it, so a step is the track gliding
     over, never a swap. GSAP moves it; it loads when the viewer opens. */
  const track = React.useRef<HTMLDivElement>(null);
  const G = React.useRef<typeof import("gsap").gsap | null>(null);
  // The touch in progress: where it went down, the track's x then, its axis once locked, and its speed.
  const drag = React.useRef<{ x: number; y: number; ox: number; axis: "x" | "y" | null; lx: number; lt: number; v: number; ly: number; vy: number } | null>(null);
  /* MOTION-PLAN.md item 10 (`?mplan=touch`): a lift hands the finger's speed
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
  /* MOTION-PLAN.md item 8 (`?mplan=keys`): a second press mid-glide takes the
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
  const glide = (from: number, by: number, dur = 0.55) => {
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
    const keys = mplan("keys");
    g.to(el, { x: -by * el.offsetWidth, y: 0, duration: keys ? 0.6 : dur, ease: keys ? "power3.inOut" : "expo.out", onComplete: done });
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
  const settle = (by: number, dur?: number) => glide(at, by, dur);
  const step = (by: number) => {
    const g = G.current;
    if (g && track.current && g.isTweening(track.current)) {
      queued.current = by;
      if (mplan("keys") && going.current) {
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
        if (mplan("touch") && g && !still()) {
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
          return void g.to(el, { y: Math.sign(dy) * innerHeight, duration: 0.3, ease: mplan("exits") ? GSAP_OUT : "power2.in", onComplete: onClose }); // item 4, `?mplan=exits`
        }
        // Where the throw would carry the track a fifth of a second on; the nearest frame there wins.
        const x = d.ox + e.clientX - d.x + d.v * 200;
        const by = Math.max(-1, Math.min(1, Math.round(-x / el.offsetWidth)));
        settle(by, Math.abs(d.v) > 0.5 ? 0.45 : 0.6);
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
  /* `?canvas=1` prototype: a fourth view button opens the drag canvas. */
  const [canvasOk, setCanvasOk] = React.useState(false);
  const [canvas, setCanvas] = React.useState(false);
  const closeCanvas = React.useCallback(() => setCanvas(false), []);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanvasOk(new URLSearchParams(location.search).get("canvas") === "1");
  }, []);
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
  /* Option 2 (Julian, 2026-11-04): once the search row scrolls under the
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
    setHs(false);
  };
  React.useEffect(() => {
    if (!tools) return;
    const io = new IntersectionObserver(
      ([e]) => {
        const on = !e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 60);
        // iOS scrolls the page as the keyboard rises: with nothing typed yet, the open header bar stays (QA, 2026-11-04).
        const f = document.activeElement as HTMLInputElement | null;
        if (!on && f?.closest(".htools") && !f.value) return;
        setPin(on);
        if (on) return;
        // A short result list brings the row back: typing carries on in its field.
        if ((document.activeElement as HTMLElement | null)?.closest(".htools"))
          tools.querySelector("input")?.focus({ preventScroll: true });
        setHs(false);
      },
      { rootMargin: "-60px 0px 0px 0px" },
    );
    io.observe(tools);
    return () => io.disconnect();
  }, [tools]);
  // iOS pans the visual viewport as the keyboard rises, carrying a top:0 fixed bar off screen: follow the pan (QA, 2026-11-04).
  React.useEffect(() => {
    const vv = window.visualViewport;
    const el = document.querySelector<HTMLElement>(".htools");
    if (!hs || !pin || !vv || !el) return;
    const set = () => el.style.setProperty("translate", `0 ${vv.offsetTop}px`);
    set();
    vv.addEventListener("scroll", set);
    vv.addEventListener("resize", set);
    return () => {
      vv.removeEventListener("scroll", set);
      vv.removeEventListener("resize", set);
      el.style.removeProperty("translate");
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
    /* MOTION-PLAN.md item 9 (`?mplan=still`): grid and strip trade places as
       one move, photo 600 on `move`, no stagger, new covers fade in 250, in
       both directions; a chip slides the tiles to their new places, page 400
       on `move`. */
    const plan = mplan("still");
    const tl = F.from(st, {
      targets: seen(),
      duration: plan ? (swap ? 0.6 : 0.4) : 0.6,
      ease: plan ? "power3.inOut" : "expo.out",
      scale: true,
      // The vectorscope (Color view) opens 40ms apart, the seventh on together.
      stagger: plan ? (swap && view === "color" ? (i: number) => Math.min(i, 5) * 0.04 : 0) : 0.015,
      onEnter: (els) => els.forEach((e) => e.animate({ opacity: [0, 1] }, plan ? { duration: 250, easing: "cubic-bezier(.23,1,.32,1)" } : 300)),
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
  const views = (
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
      {canvasOk ? (
        <button type="button" aria-pressed={canvas} aria-label="Canvas view" title="Canvas view" onClick={() => setCanvas(true)}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="1.5" y="3" width="4" height="5" />
            <rect x="6.5" y="1" width="4" height="5" />
            <rect x="11.5" y="4" width="3" height="5" />
            <rect x="1.5" y="9.5" width="4" height="5" />
            <rect x="6.5" y="7.5" width="4" height="5" />
            <rect x="11.5" y="10.5" width="3" height="4" />
          </svg>
        </button>
      ) : null}
      {[VIEWS[1], VIEWS[0]].map(([v, label, icon]) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          aria-label={label}
          title={label}
          onPointerDown={v === "strip" ? () => warm(8) : undefined}
          onPointerEnter={v === "strip" ? () => warm(8) : undefined}
          onFocus={v === "strip" ? () => warm(8) : undefined}
          onClick={() => go(v)}
        >
          {icon}
        </button>
      ))}
    </div>
  );

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
          <div className="wtools lbl" ref={setTools}>
            <label className="wsearch">
              {LOUPE}
              <input
                type="search"
                placeholder="Search the work"
                aria-label="Search the work by name, discipline or credit"
                autoComplete="off"
                value={q}
                onChange={(e) => setQ(e.target.value.trim().toLowerCase())}
              />
            </label>
            {views}
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
                /* Name, then discipline, both on the photo, as in the grid (Julian, 2026-11-04). */
                const cap = p ? <Cap p={p} cls="sc-n" /> : null;
                if (!f)
                  return (
                    <figure key={p!.s} className="sc" data-flip-id={p!.s}>
                      <Link href={hrefOf(p!.s)} aria-label={named(p!)}>
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
                          here: the viewer's bar has the switch (Julian, 2026-11-05). */}
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
                  <label className="hsearch">
                    {LOUPE}
                    <input
                      type="search"
                      ref={(el) => el?.focus({ preventScroll: true })}
                      placeholder="Search the work"
                      aria-label="Search the work by name, discipline or credit"
                      autoComplete="off"
                      value={q}
                      onChange={(e) => setQ(e.target.value.trim().toLowerCase())}
                      onKeyDown={(e) => e.key === "Escape" && close()}
                    />
                  </label>
                  <button type="button" className="hbtn" aria-label="Close search" onClick={close}>
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.3" />
                    </svg>
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
        {canvas ? createPortal(<div className="v3"><V3Canvas list={list} onClose={closeCanvas} /></div>, document.body) : null}
        <V3Foot />
      </section>
    </div>
  );
}
