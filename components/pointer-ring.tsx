"use client";

import * as React from "react";
import { createPortal } from "react-dom";

/* ── the pointer's ring ───────────────────────────────────────────
 * Julian, after selectedbase.com: over something that opens, a circle
 * comes up beside the system arrow holding one word for what a press will
 * do: VIEW, DRAG, ZOOM, SCROLL. See `.cursor-ring` in `globals.css`.
 *
 * There used to be a glass drop here and the arrow was hidden under it.
 * Julian asked for the arrow back, and it is the right call twice over: a
 * backdrop-filtered element that follows the pointer repaints the region
 * behind it on every move, which is the most expensive thing a page can
 * do, and the browser's own cursor is the one thing on a page that never
 * drops a frame.
 *
 * Only where there is a pointer to follow: `hoverable` gates it, so a phone
 * never mounts the listeners. Anything that should carry a word says so
 * with `data-ring`; an empty value, or a control that was given no word,
 * cancels it.
 *
 * Portalled to `<body>`, and this is a bug fixed. `position: fixed` is
 * relative to the viewport only while no ancestor has a transform — and
 * `<main>` has one: `rise` leaves `translateY(0)` on it at rest, which is
 * identity but still a transform, so the label was fixed to `<main>`
 * instead and sat `scrollY` pixels off the pointer once the page scrolled.
 * ─────────────────────────────────────────────────────────────── */

/* Julian: selectedbase.com/artists to the letter, their numbers from
   their source. The circle trails the pointer on a rope `ROPE` times its
   own width long, eased toward the rope's end by `EASE` a 60fps frame,
   and shrinks as it lags. Faint at 32px until something with a word is
   under it, then 48px at full strength, and the word rises in after
   100ms (`.cursor-ring` in `globals.css`). */
const ROPE = 1.5625;
const EASE = 0.12;
// The least it grows to around a word, theirs; a word longer than theirs
// gets a circle that holds it rather than clipping it.
const LEAST = 48;
// It comes up this long after the pointer first moves (ms).
const READY = 500;
/* Julian: over a button the circle merges with it. It leaves the rope,
   takes the button's shape on its edge, and fades into the button's own
   outline as it arrives (Julian: no second outline), drawn `PULL` of the
   way toward the pointer. The site's buttons,
   as `glass-light.tsx` lists them. */
const BUTTON = ".action, .action-quiet, .cover-cta, [data-ring-hug]";
const OUTSET = 0;
const PULL = 0.12;
// Faster onto a button than after the pointer, so the merge reads as one
// movement rather than a slow drift into place.
const HUG_EASE = 0.3;

// `document` does not exist on the server, so the portal target is known
// only on the client. `useSyncExternalStore` with a false server snapshot is
// the sanctioned way to say "false until hydrated" without a set-state in an
// effect.
const subscribeNever = () => () => {};
const useMounted = () =>
  React.useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

export function PointerRing() {
  const ref = React.useRef<HTMLDivElement>(null);
  const word = React.useRef<HTMLSpanElement>(null);
  const mounted = useMounted();

  React.useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }
    const el = ref.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");

    /* What the pointer is over, not whether it is over something: moving
       from a frame straight into the picture it opened kept the first
       word, because only the boolean had changed and the word was written
       on that change. */
    let over: Element | null = null;
    // The pointer, the rope's end, and the circle.
    let mx = 0;
    let my = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let seen = false;
    let raf = 0;
    let last = 0;
    let ready = 0;
    let rope = 32 * ROPE;
    // The button it has merged with, and the size it last wrote for it.
    let hug: HTMLElement | null = null;
    let hugSize = "";
    const sizes = new ResizeObserver(() => (rope = el.offsetWidth * ROPE));
    sizes.observe(el);

    const tick = (t: number) => {
      // Their ticker: 1 a 60fps frame, capped at 100ms.
      const d = last ? Math.min(t - last, 100) * 0.06 : 1;
      last = t;
      if (hug) {
        const b = hug.getBoundingClientRect();
        const size = `${b.width + OUTSET * 2}|${b.height + OUTSET * 2}`;
        if (size !== hugSize) {
          hugSize = size;
          el.style.setProperty("--mw", `${b.width + OUTSET * 2}px`);
          el.style.setProperty("--mh", `${b.height + OUTSET * 2}px`);
        }
        tx = b.left + b.width / 2 + (mx - b.left - b.width / 2) * PULL;
        ty = b.top + b.height / 2 + (my - b.top - b.height / 2) * PULL;
      }
      const lag = Math.max(Math.abs(tx - cx), Math.abs(ty - cy)) * 0.001;
      const k = still.matches ? 1 : Math.min(1, (hug ? HUG_EASE : EASE) * d);
      cx += (tx - cx) * k;
      cy += (ty - cy) * k;
      el.style.transform = `translate3d(${cx.toFixed(4)}px, ${cy.toFixed(4)}px, 0) scale(${hug ? 1 : 1 - Math.min(lag, 0.5)})`;
      // Held on a button it keeps reading it, which a gliding strip moves.
      raf = hug || Math.abs(tx - cx) + Math.abs(ty - cy) > 0.05 ? requestAnimationFrame(tick) : 0;
      if (!raf) last = 0;
    };
    const place = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!seen) {
        tx = cx = mx;
        ty = cy = my;
      }
      // The rope's end, dragged behind the pointer the way it moved.
      const a = Math.atan2(ty - my, tx - mx) + Math.PI;
      tx = mx - rope * Math.cos(a);
      ty = my - rope * Math.sin(a);
      if (!ready && !el.hasAttribute("data-ready")) {
        ready = window.setTimeout(() => el.setAttribute("data-ready", ""), seen ? 0 : READY);
      }
      seen = true;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    /* The word, at once, and the circle sized to hold it. */
    const write = (text: string) => {
      const w = word.current;
      if (!w) return;
      w.textContent = text;
      el.style.setProperty("--d", `${Math.max(LEAST, w.offsetWidth + 20)}px`);
    };
    /* A word that changes under a still pointer, as the view switch does
       once it is pressed. */
    const watch = new MutationObserver(() => {
      const text = over?.getAttribute("data-ring");
      if (text) write(text);
    });

    const move = (e: PointerEvent) => {
      place(e);
      const b = (e.target as Element | null)?.closest?.<HTMLElement>(BUTTON);
      const merge = b && !b.matches(":disabled, [aria-disabled='true']") ? b : null;
      if (merge !== hug) {
        hug = merge;
        hugSize = "";
        if (hug) {
          /* Julian: around a filter chip it stays, since a chip has no
             outline of its own to fade into. The lit chip's rounded
             rectangle, not a pill: pills are for buttons (Julian). */
          const outline = hug.hasAttribute("data-ring-hug");
          el.style.setProperty("--mr", outline ? "6px" : getComputedStyle(hug).borderRadius);
          el.setAttribute("data-merge", outline ? "outline" : "");
        } else el.removeAttribute("data-merge");
      }
      /* A word on an ancestor reaches everything inside it. Two things
         cancel it: an empty `data-ring`, and any control of its own that
         was given no word. */
      const near = (e.target as Element | null)?.closest?.(
        "[data-ring], a, button, input, textarea, select, label, summary",
      );
      const on = near?.getAttribute("data-ring") ? near : null;
      if (on === over) return;
      over = on;
      watch.disconnect();
      // The word is left in place on the way out, so it sinks away
      // rather than blanking first.
      if (!on) return el.removeAttribute("data-over");
      write(on.getAttribute("data-ring") ?? "");
      watch.observe(on, { attributes: true, attributeFilter: ["data-ring"] });
      el.setAttribute("data-over", "");
    };
    /* The pointer left the window. Julian: the word should not be left
       hanging over the page with no pointer under it — which is what
       happened on the way to a bookmark or another window, because the
       last `pointermove` inside the page was over something with a word
       and nothing since said otherwise. `relatedTarget` is null exactly
       when the pointer has gone out of the document rather than into
       another element, and `blur` covers the window losing focus without
       the pointer crossing an edge: alt-tab, a screenshot tool, the
       browser's own chrome. Moving back in brings it up again. */
    const away = () => {
      window.clearTimeout(ready);
      ready = 0;
      el.removeAttribute("data-ready");
      el.removeAttribute("data-over");
      el.removeAttribute("data-merge");
      over = null;
      hug = null;
      watch.disconnect();
    };
    const left = (e: PointerEvent) => {
      if (e.relatedTarget === null) away();
    };

    document.addEventListener("pointermove", move, { passive: true });
    /* And when what is under the pointer changes without the pointer
       moving — a click that navigates, a strip that glides past under a
       still hand. Measured in Julian's own Chrome: after opening a project
       from the work page the label still read VIEW PROJECT over a frame
       that zooms, until the mouse was nudged. `pointerover` carries
       coordinates like any pointer event, so the same handler does. */
    document.addEventListener("pointerover", move, { passive: true });
    document.addEventListener("pointerout", left, { passive: true });
    window.addEventListener("blur", away);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", move);
      document.removeEventListener("pointerout", left);
      window.removeEventListener("blur", away);
      watch.disconnect();
      sizes.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(ready);
    };
    // On `mounted`, not `[]`: the first render on a hydrated page returns
    // null, so `ref.current` is empty when this first runs and the listeners
    // were never attached — the ring sat at (0,0) with nothing driving it.
    // Re-running once the element exists is the whole point of the dep.
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    /* The outer element only moves; everything that fades or shifts is
       inside it, about its own box. The individual `scale` and `translate`
       properties compose after `transform` about the untransformed origin,
       so anything animated on the element that carries the translate
       animates its whole offset — a label meant for the pointer used to
       swoop in from the corner of the viewport. */
    <div
      ref={ref}
      aria-hidden
      /* Over everything, the image viewer included: at z-50 it sat under
         the viewer (also z-50, and later in the page), so SCROLL never
         showed there. */
      className="cursor-ring pointer-events-none z-[100] will-change-transform"
    >
      <span
        ref={word}
        className="ring-word block flex-none font-mono text-[0.6875rem] uppercase tracking-[0.1em]"
      />
    </div>,
    document.body,
  );
}
