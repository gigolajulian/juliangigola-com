"use client";

import * as React from "react";
import { flushSync } from "react-dom";

/* ── the proof gate as a wall, behind ?proofwall=1 ─────────────────
 * Julian's mock (2026-11-10): https://claude.ai/artifact/GnCbm6mRNTFY6LRuq7L3VP
 * The wall is the proof grid itself: the first screen or two of it (whole
 * rows), repeated so it can drift, tilted under perspective with each photo
 * at its own depth, under a dim overlay that carries the blur. The card asks
 * for a name and an email. A pointer on Open proofs, or a name and an email
 * that already reads as complete, starts the settle and runs it INTENT_AT of
 * the way; letting go runs it back. On accept it carries on from where it
 * stands: the drift hands over at its own speed and is steered to land with
 * frame 001 at the top-left as the wall flattens, each photo comes forward
 * to its cell, the overlay lifts. No image changes opacity. The real grid is
 * underneath at the same place with the same files, and takes over once the
 * wall has landed on it. The frames are the watermarked ones throughout.
 * ─────────────────────────────────────────────────────────────── */

/** The dials, as named in the mock. */
const W = {
  TILT: 16, // deg
  TURN: -14, // deg
  PERSPECTIVE: 1200, // px
  DEPTH: 220, // px, the whole grid pushed back
  SPREAD: 200, // px, each photo's own depth either side of that
  SPEED: 14, // px/s, the drift
  TINT: 0.35, // the overlay's share of the page colour
  BLUR: 4, // px, the overlay's backdrop blur
  FLAT_MS: 1100, // the wall from 3D to 2D, and the drift into its stop
  EASE: "cubic-bezier(.4,0,.2,1)",
  PHOTO_MS: 1300, // each photo forward to its cell
  PHOTO_EASE: "cubic-bezier(.45,0,.2,1)",
  PHOTO_START: 0.1, // of FLAT_MS
  STAGGER: 45, // ms between photos
  INTENT_AT: 0.3, // how far the settle runs before the click
  CARD_OUT_MS: 240,
  SCREENS: 1.5, // how much of the grid the wall carries, in screen heights
};

type Frame = { src: string; w: number; h: number };
type Api = { lean: (on: boolean) => void; accept: (delta: number) => void };

const depth = (i: number) => -W.DEPTH + (((i * 0.618034 + 0.35) % 1) * 2 - 1) * W.SPREAD;

export function ProofWall({
  frames,
  grid,
  isEmail,
  onAccept,
  onDone,
}: {
  frames: Frame[];
  grid: React.RefObject<HTMLDivElement | null>;
  isEmail: (v: string) => boolean;
  onAccept: (name: string, email: string) => void;
  onDone: () => void;
}) {
  const layer = React.useRef<HTMLDivElement>(null);
  const dim = React.useRef<HTMLDivElement>(null);
  const card = React.useRef<HTMLFormElement>(null);
  const api = React.useRef<Api | null>(null);
  const [n, setN] = React.useState(0);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [bad, setBad] = React.useState<string | null>(null);
  const over = React.useRef(false);
  const done = React.useRef(onDone);
  React.useEffect(() => {
    done.current = onDone;
  });

  // Whole rows of the real grid, about SCREENS screens of them: the wall never loads the whole gallery.
  React.useLayoutEffect(() => {
    const raf = requestAnimationFrame(() => {
      const g = grid.current;
      if (!g) return;
      const cells = [...g.children] as HTMLElement[];
      const cols = Math.max(1, getComputedStyle(g).gridTemplateColumns.split(" ").length);
      let k = cols;
      while (k < cells.length && cells[k].offsetTop - cells[0].offsetTop < innerHeight * W.SCREENS) k += cols;
      setN(Math.min(k, cells.length));
    });
    return () => cancelAnimationFrame(raf);
  }, [grid]);

  // No scrolling the page under the wall.
  React.useEffect(() => {
    const el = document.documentElement;
    const was = el.style.overflow;
    el.style.overflow = "hidden";
    return () => {
      el.style.overflow = was;
    };
  }, []);

  React.useEffect(() => {
    const L = layer.current, g = grid.current, D = dim.current;
    if (!n || !L || !g || !D) return;
    const sheet = L.firstElementChild as HTMLElement;
    const tilt = sheet.firstElementChild as HTMLElement;
    const blocks = [...tilt.children] as HTMLElement[];
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const flat = `perspective(${W.PERSPECTIVE}px) rotateX(0deg) rotateY(0deg) scale(1)`;
    const tilted = `perspective(${W.PERSPECTIVE}px) rotateX(${W.TILT}deg) rotateY(${W.TURN}deg) scale(1.18)`;
    const H = () => blocks[1].offsetTop - blocks[0].offsetTop; // one copy and its gap
    const place = () => {
      L.style.top = `${g.offsetTop}px`;
      // pivot on the middle of the screen, as the grid lies at rest
      const top = document.querySelector<HTMLElement>(".proof-top")?.offsetHeight ?? 0;
      tilt.style.transformOrigin = `50% ${top + (innerHeight - top) / 2 - g.getBoundingClientRect().top}px`;
      D.style.top = `${top}px`;
    };
    place();
    if (reduced) {
      tilt.style.transform = flat;
      tilt.querySelectorAll<HTMLElement>(".proof-cell").forEach((c) => c.style.setProperty("--dz", "0px"));
    } else tilt.style.transform = tilted;

    // the drift: down, so it comes to rest moving the way it was going
    let y = reduced ? 0 : -H() * 0.6;
    let drifting = !reduced;
    let raf = 0;
    const put = () => (sheet.style.transform = `translate3d(0, ${y}px, 0)`);
    const drift = () => {
      let last = 0;
      const tick = (ts: number) => {
        if (!drifting) return;
        const dt = last ? Math.min(0.05, (ts - last) / 1000) : 1 / 60;
        last = ts;
        y += W.SPEED * dt;
        if (y >= 0) y -= H(); // the same picture one copy up
        put();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    put();
    if (drifting) drift();

    // the settle as one timeline, run by hand forward or back
    type Ctl = { anims: Animation[]; total: number; t: number; target: number; raf: number };
    let ctl: Ctl | null = null;
    let accepted = false;
    let finished = false;
    const build = (): Ctl => {
      const o: KeyframeAnimationOptions = { duration: W.FLAT_MS, easing: W.EASE, fill: "both" };
      const anims = [tilt.animate([{ transform: tilted }, { transform: flat }], o)];
      const ps: KeyframeAnimationOptions = { duration: W.PHOTO_MS, easing: W.PHOTO_EASE, fill: "both" };
      blocks.forEach((b, k) =>
        b.querySelectorAll<HTMLElement>(".proof-cell").forEach((c, i) =>
          anims.push(
            c.animate([{ transform: `translateZ(${c.style.getPropertyValue("--dz")})` }, { transform: "translateZ(0px)" }], {
              ...ps,
              delay: W.FLAT_MS * W.PHOTO_START + (k ? 0 : W.STAGGER * i),
            }),
          ),
        ),
      );
      anims.forEach((a) => a.pause());
      return { anims, total: Math.max(...anims.map((a) => Number(a.effect?.getComputedTiming().endTime ?? 0))), t: 0, target: 0, raf: 0 };
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      done.current();
    };
    const drive = (p: number) => {
      const c = (ctl ??= build());
      c.target = p * c.total;
      if (c.raf) return;
      let last = 0;
      const step = (ts: number) => {
        const dt = last ? ts - last : 16;
        last = ts;
        c.t = c.t < c.target ? Math.min(c.target, c.t + dt) : Math.max(c.target, c.t - dt);
        c.anims.forEach((a) => (a.currentTime = c.t));
        if (c.t !== c.target) return void (c.raf = requestAnimationFrame(step));
        c.raf = 0;
        if (c.t >= c.total) finish();
        else if (c.t === 0 && !accepted) {
          c.anims.forEach((a) => a.cancel()); // let go all the way; the drift never stopped
          ctl = null;
        }
      };
      c.raf = requestAnimationFrame(step);
    };
    const land = () => {
      sheet.getAnimations().forEach((a) => a.finish());
      D.getAnimations().forEach((a) => a.finish());
      if (ctl) {
        if (ctl.raf) cancelAnimationFrame(ctl.raf);
        ctl.t = ctl.target = ctl.total;
        ctl.anims.forEach((a) => (a.currentTime = ctl!.total));
      }
      finish();
    };
    const evs = ["pointerdown", "wheel", "touchstart", "keydown"] as const;
    api.current = {
      lean: (on) => {
        if (reduced || accepted) return;
        if (on) drive(W.INTENT_AT);
        else if (ctl) drive(0);
      },
      accept: (delta) => {
        accepted = true;
        // a longer header pushed the grid down by delta: follow it, and take it out of the drift so nothing jumps
        y -= delta;
        place();
        put();
        card.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: W.CARD_OUT_MS, easing: "ease-out", fill: "forwards" });
        if (reduced) {
          D.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: "forwards" }).finished.then(finish, finish);
          return;
        }
        const c = (ctl ??= build());
        const T = Math.max(300, c.total - c.t);
        let from = y, d = -from;
        // too close to its stop to land gently: once more round (the same picture one copy up)
        if ((W.SPEED * T) / 1000 / d > 3) {
          from -= H();
          d += H();
        }
        drifting = false;
        cancelAnimationFrame(raf);
        // starts at the drift's own speed (y1 / x1 is that speed in the curve's units), so there is no jump
        const s0 = (W.SPEED * T) / 1000 / d;
        sheet.animate([{ transform: `translate3d(0, ${from}px, 0)` }, { transform: "translate3d(0, 0, 0)" }], {
          duration: T,
          easing: `cubic-bezier(0.3, ${Math.min(1, 0.3 * s0).toFixed(3)}, 0.35, 1)`,
          fill: "forwards",
        });
        D.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T, easing: W.EASE, fill: "forwards" });
        drive(1);
        // a click, a scroll or a key lands it at once
        setTimeout(() => evs.forEach((ev) => addEventListener(ev, land, { once: true, passive: true })));
      },
    };
    return () => {
      drifting = false;
      cancelAnimationFrame(raf);
      if (ctl?.raf) cancelAnimationFrame(ctl.raf);
      evs.forEach((ev) => removeEventListener(ev, land));
      api.current = null;
    };
  }, [n, grid]);

  const intent = (nm: string, em: string) => over.current || (!!nm.trim() && isEmail(em));
  const hover = (on: boolean) => {
    over.current = on;
    api.current?.lean(intent(name, email));
  };

  return (
    <>
      <div ref={layer} className="pw-layer" aria-hidden="true">
        <div className="pw-sheet">
          <div className="pw-tilt">
            {n
              ? [0, 1, 2].map((k) => (
                  <div key={k} className="proof-grid pw-block">
                    {frames.slice(0, n).map((f, i) => (
                      <div key={i} className="proof-cell" style={{ "--dz": `${depth(i)}px` } as React.CSSProperties}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- the grid's own watermarked frames, same files */}
                        <img src={f.src} alt="" width={f.w || undefined} height={f.h || undefined} draggable={false} />
                      </div>
                    ))}
                  </div>
                ))
              : null}
          </div>
        </div>
      </div>
      <div ref={dim} className="pw-dim" style={{ "--pw-tint": `${W.TINT * 100}%`, "--pw-blur": `${W.BLUR}px` } as React.CSSProperties} />
      <form
        ref={card}
        className="proof-card pw-card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const msg = !name.trim() ? "Add your name." : !isEmail(email) ? "That email does not look right." : null;
          setBad(msg);
          if (msg) return;
          const g = grid.current;
          const t0 = g?.getBoundingClientRect().top ?? 0;
          flushSync(() => onAccept(name.trim(), email.trim()));
          api.current?.accept((g?.getBoundingClientRect().top ?? 0) - t0);
        }}
      >
        <div>
          <p className="proof-lab">Proofs · {frames.length} frames</p>
          <h1>Pick your proofs.</h1>
        </div>
        <label>
          <span className="proof-lab">Your name</span>
          <input
            name="name"
            autoComplete="name"
            required
            value={name}
            placeholder="First and last"
            aria-invalid={bad === "Add your name." || undefined}
            onChange={(e) => {
              setName(e.target.value);
              setBad(null);
              api.current?.lean(intent(e.target.value, email));
            }}
          />
        </label>
        <label>
          <span className="proof-lab">Your email</span>
          <input
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            placeholder="you@email.com"
            aria-invalid={(!!bad && bad !== "Add your name.") || undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              setBad(null);
              api.current?.lean(intent(name, e.target.value));
            }}
          />
        </label>
        {bad ? (
          <p className="proof-err" role="alert">
            {bad}
          </p>
        ) : null}
        <button type="submit" className="proof-btn" onPointerEnter={() => hover(true)} onPointerLeave={() => hover(false)} onFocus={() => hover(true)} onBlur={() => hover(false)}>
          Open proofs
        </button>
        <p className="proof-mu">Any email opens it. Your picks are logged under this address, and they are still here when you come back.</p>
      </form>
    </>
  );
}
