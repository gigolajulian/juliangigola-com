"use client";

import * as React from "react";

/* ── the pointer's mark ───────────────────────────────────────────
 * The system arrow, replaced by the theme switch's circle
 * (`theme-toggle.tsx`), solid, at the pointer with no lag. Over anything
 * that does something it grows a little, and a click squeezes it and
 * leaves a ring. See `.pointer-mark` in `globals.css`.
 *
 * Only on a fine pointer; a phone never mounts the listeners. The system
 * cursor is hidden only once the mark has a position to be drawn at
 * (`data-mark` on the root), so a page whose script never runs keeps its
 * arrow. Over a text field the mark steps aside for the native caret.
 * ─────────────────────────────────────────────────────────────── */

// The caret's places. Button-like inputs stay with the mark.
const TEXT =
  "input:not([type=button],[type=submit],[type=reset],[type=checkbox],[type=radio],[type=range],[type=color],[type=file]), textarea, select, [contenteditable]:not([contenteditable=false])";
/* What a press does something to. `data-ring` names what a press does on
   things that are not links or buttons (a cover that opens, a frame that
   zooms); an empty one says the thing itself is not pressed. */
const PRESS =
  ":is(a[href], button, [role=button], label, summary, .cursor-pointer, [data-ring]:not([data-ring=''])):not(:disabled, [aria-disabled=true])";

export function PointerMark() {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let x = 0;
    let y = 0;
    let raf = 0;
    let down = false;

    /* Julian: stuck to the portfolio's view icons and filter chips, the
       theme switch, the lightbox's controls and the contact marks
       (`data-stick`). Over
       one the dot leaves the hand for the icon's centre, leaning a little
       back toward it, and holds there past the icon's edge until the hand
       is a good way off; the dot and a drop left at the hand are run
       together as liquid (`#mark-goo`), so pulling away draws a neck that
       snaps. The icon grows and leans the other way (`globals.css`). */
    let stuck: HTMLElement | null = null;
    // px from the icon's centre. Julian: more resistance, then a touch
    // less (34 and 0.75 at first, then 46 and 0.85).
    const RELEASE = 40;
    const HOLD = 0.8;
    const unstick = () => {
      if (!stuck) return;
      stuck.removeAttribute("data-stuck");
      stuck.style.removeProperty("--lean-x");
      stuck.style.removeProperty("--lean-y");
      stuck = null;
      el.removeAttribute("data-stuck");
      el.style.removeProperty("--sx");
      el.style.removeProperty("--sy");
      for (const v of ["--neck-l", "--neck-t", "--neck-a"]) el.style.removeProperty(v);
    };
    const pull = () => {
      if (!stuck) return;
      /* Held to the nearest point of the target's spine: its centre on a
         square icon, and along its length on a wide one (a filter chip),
         so the dot slides along a chip with the hand and only the pull
         off it meets the resistance. */
      const r = stuck.getBoundingClientRect();
      const half = Math.min(r.width, r.height) / 2;
      const dx = x - Math.min(Math.max(x, r.left + half), r.right - half);
      const dy = y - Math.min(Math.max(y, r.top + half), r.bottom - half);
      const d = Math.hypot(dx, dy);
      if (d > RELEASE) return unstick();
      el.style.setProperty("--sx", `${(-dx * HOLD).toFixed(1)}px`);
      el.style.setProperty("--sy", `${(-dy * HOLD).toFixed(1)}px`);
      /* The neck from the hand to the dot, thinning as it is drawn out,
         so the two stay one liquid however far the resistance lets the
         hand get (the drop alone came away as a loose dot). */
      el.style.setProperty("--neck-l", `${(d * HOLD).toFixed(1)}px`);
      el.style.setProperty("--neck-t", `${Math.max(2.5, 8 - d * 0.12).toFixed(1)}px`);
      el.style.setProperty("--neck-a", `${Math.atan2(-dy, -dx).toFixed(3)}rad`);
      stuck.style.setProperty("--lean-x", `${(dx * 0.1).toFixed(1)}px`);
      stuck.style.setProperty("--lean-y", `${(dy * 0.1).toFixed(1)}px`);
    };

    /* Momentum, not lag (Julian, 2026-10-02). The dot rides the hand
       exactly while it moves; when the hand slows or stops, the dot keeps
       going a little the way it was headed and springs back onto it. It is
       a weight on a spring whose only push is the hand braking: the part
       of its acceleration against its direction of travel. A hand at any
       steady speed puts nothing into it, so the dot never trails, and
       speeding up puts nothing in either, so it never falls behind. */
    const K = (2 * Math.PI * 3.6) ** 2; // spring, about 3.6 Hz
    const C = 2 * 0.42 * Math.sqrt(K); // damping: one soft overshoot back
    const GAIN = 0.6; // how much of the braking the dot carries
    const REACH = 18; // px, the farthest it runs past the hand
    /* The hand's velocity, from the pointer events and their own clocks,
       not from frame to frame: a 60 Hz mouse on a 120 Hz screen leaves
       every other frame without a move, and read per frame each of those
       looked like a stop and kicked the dot forward. */
    let ex = 0, ey = 0, et = 0; // the last event
    let evx = 0, evy = 0; // velocity from events, px/s
    let vx = 0, vy = 0; // the velocity the spring sees this frame
    let ox = 0, oy = 0, ux = 0, uy = 0; // the dot's offset and its velocity
    let last = 0;
    const sense = (e: PointerEvent) => {
      const dt = (e.timeStamp - et) / 1000;
      // `pointerover` brings the same event again; it adds nothing.
      if (dt === 0) return;
      if (et && dt < 0.1) {
        evx += ((e.clientX - ex) / dt - evx) * 0.5;
        evy += ((e.clientY - ey) / dt - evy) * 0.5;
      } else {
        evx = evy = 0;
      }
      ex = e.clientX;
      ey = e.clientY;
      et = e.timeStamp;
    };
    const draw = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
      last = now;
      const px = vx, py = vy;
      // No move for a beat is a hand at rest: its speed falls away fast.
      const fresh = now - et < 45;
      vx = fresh ? evx : vx * Math.exp(-dt / 0.025);
      vy = fresh ? evy : vy * Math.exp(-dt / 0.025);
      let fx = 0, fy = 0;
      const speed = Math.hypot(px, py);
      if (!stuck && !still.matches && speed > 1) {
        const ax = (vx - px) / dt, ay = (vy - py) / dt;
        const along = (ax * px + ay * py) / speed; // < 0 while braking
        if (along < 0) {
          fx = (-along * px) / speed * GAIN;
          fy = (-along * py) / speed * GAIN;
        }
      }
      ux += (fx - K * ox - C * ux) * dt;
      uy += (fy - K * oy - C * uy) * dt;
      ox += ux * dt;
      oy += uy * dt;
      // Softly held to its reach rather than stopped dead at it.
      const d = Math.hypot(ox, oy);
      const k = d > 0 ? (REACH * Math.tanh(d / REACH)) / d : 0;
      el.style.transform = `translate3d(${x + ox * k}px, ${y + oy * k}px, 0)`;
      // Runs while the hand or the dot is moving, and sleeps after.
      if (Math.hypot(vx, vy) > 2 || d > 0.05 || Math.hypot(ux, uy) > 1) {
        raf = requestAnimationFrame(draw);
      } else {
        last = 0;
      }
    };
    /* A touchscreen laptop matches a fine pointer too; a finger on it must
       not drag the mark to wherever it landed. */
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      x = e.clientX;
      y = e.clientY;
      sense(e);
      pull();
      if (!raf) raf = requestAnimationFrame(draw);
      if (!el.hasAttribute("data-on")) {
        el.setAttribute("data-on", "");
        root.setAttribute("data-mark", "");
      }
    };
    /* What it is over, read when that changes rather than on every move:
       `pointerover` also fires when the page moves under a still hand. */
    const over = (e: PointerEvent) => {
      move(e);
      const t = e.target as Element | null;
      const stick = still.matches ? null : t?.closest?.<HTMLElement>("[data-stick]");
      if (stick && stick !== stuck) {
        unstick();
        stuck = stick;
        stick.setAttribute("data-stuck", "");
        el.setAttribute("data-stuck", "");
        pull();
      }
      const state = t?.closest?.(TEXT)
        ? "text"
        : t?.closest?.(PRESS)
          ? "press"
          : "";
      if (state) el.setAttribute("data-state", state);
      else el.removeAttribute("data-state");
    };
    // Out of the window (`relatedTarget` null), or the window losing focus.
    const away = () => {
      el.removeAttribute("data-on");
      unstick();
      cancel();
    };
    const left = (e: PointerEvent) => {
      if (e.relatedTarget === null) away();
    };
    const press = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.button !== 0) return;
      down = true;
      el.setAttribute("data-down", "");
    };
    // A press the browser took over (a native drag) is not a click.
    const cancel = () => {
      down = false;
      el.removeAttribute("data-down");
    };
    /* Let go: it springs back and a ring runs out from where
       it was pressed. One short-lived element per click, gone when its
       animation ends. */
    const release = (e: PointerEvent) => {
      if (!down) return;
      down = false;
      el.removeAttribute("data-down");
      if (still.matches) return;
      const ripple = document.createElement("div");
      ripple.className = "pointer-ripple";
      ripple.setAttribute("aria-hidden", "");
      ripple.style.translate = `${e.clientX}px ${e.clientY}px`;
      ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
      document.body.append(ripple);
    };

    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerover", over, { passive: true });
    document.addEventListener("pointerout", left, { passive: true });
    document.addEventListener("pointerdown", press, { passive: true });
    document.addEventListener("pointerup", release, { passive: true });
    document.addEventListener("pointercancel", cancel, { passive: true });
    window.addEventListener("blur", away);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", left);
      document.removeEventListener("pointerdown", press);
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", away);
      cancelAnimationFrame(raf);
      unstick();
      root.removeAttribute("data-mark");
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="pointer-mark">
      {/* The switch's circle, solid; and the drop it leaves at the hand
          while it is stuck to an icon, run together as liquid. */}
      <div className="mark-goo">
        <div className="mark-dot" />
        <div className="mark-drop" />
        <div className="mark-neck" />
      </div>
      <svg aria-hidden width="0" height="0" className="absolute">
        <filter id="mark-goo">
          <feGaussianBlur stdDeviation="3.5" />
          <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" />
        </filter>
      </svg>
    </div>
  );
}
