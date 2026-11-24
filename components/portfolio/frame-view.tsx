"use client";

import { loadGsap } from "@/lib/motion/gsap-lazy";
import * as React from "react";
import Image from "next/image";
import { pad } from "@/lib/utils";
import { launchSpeed, stepSpring, springSettled, frameDt } from "@/lib/motion/spring";
import { GRID_SIZES } from "@/components/portfolio/work-tiles";

/** The motion plan's `out` curve for GSAP: power4.out is cubic-bezier(.23, 1, .32, 1). */
const GSAP_OUT = "power4.out";

/** One frame in a chip's grid. `s` is its project's slug and `sq` whether it is square: short because the RSC payload carries them once per frame. */
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

export function FrameTile({ f, first, onOpen }: { f: FrameItem; first?: boolean; onOpen: () => void }) {
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
    void loadGsap().then((g) => (G.current = g));
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
        <span>{pad(at + 1)} / {pad(n)}</span>
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
