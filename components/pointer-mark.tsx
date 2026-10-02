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

    const draw = () => {
      raf = 0;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    /* A touchscreen laptop matches a fine pointer too; a finger on it must
       not drag the mark to wherever it landed. */
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      x = e.clientX;
      y = e.clientY;
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
      root.removeAttribute("data-mark");
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="pointer-mark">
      {/* The switch's circle, solid. */}
      <div className="mark-dot" />
    </div>
  );
}
