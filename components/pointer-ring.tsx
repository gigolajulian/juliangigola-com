"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

/* ── the pointer's label ──────────────────────────────────────────
 * The cursor over something that opens: the system arrow, with a word
 * hanging off it saying what a press will do. VIEW PROJECT, DRAG, ZOOM IN,
 * ZOOM OUT, set as a camera sets a focus box - four corner marks around a
 * half-there pane. See `.ring-tag` in `globals.css`.
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

// Where the label hangs off the arrow: clear of the cursor's own
// artwork, close enough to read as attached to it.
const OFF_X = 16;
const OFF_Y = 18;

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
  /* Not on the homepage. It is a cover photograph with a name on it and
     two ways in: nothing there needs a word explaining what a press does,
     and a tag following the pointer across the one screen that is meant to
     be looked at rather than used is noise. Julian's call. */
  const quiet = usePathname() === "/";

  React.useEffect(() => {
    if (quiet) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }
    const el = ref.current;
    if (!el) return;

    /* What the pointer is over, not whether it is over something: moving
       from a frame straight into the picture it opened kept the first
       word, because only the boolean had changed and the word was written
       on that change. */
    let over: Element | null = null;
    /* The word's width, read once per word rather than per move. Past the
       right edge it hangs on the other side of the pointer: the view
       buttons and the search sit close enough to the edge to cut it off. */
    let wide = 0;

    const place = (e: PointerEvent) => {
      const x =
        e.clientX + OFF_X + wide > window.innerWidth - 8
          ? e.clientX - OFF_X - wide
          : e.clientX + OFF_X;
      el.style.transform = `translate3d(${x}px, ${e.clientY + OFF_Y}px, 0)`;
    };

    const move = (e: PointerEvent) => {
      place(e);
      /* A word on an ancestor reaches everything inside it, which is how
         the strip says `Drag` over its whole shelf. Two things cancel it:
         an empty `data-ring`, written on the cells that are words rather
         than pictures, and any control of its own that was given no word
         — a button under a pointer that says DRAG, with no arrow to
         press it with, is worse than no pointer at all. */
      const near = (e.target as Element | null)?.closest?.(
        "[data-ring], a, button, input, textarea, select, label, summary",
      );
      const on = near?.getAttribute("data-ring") ? near : null;
      if (on === over) return;
      over = on;
      const hit = !!on;
      el.toggleAttribute("data-over", hit);
      if (!hit) el.removeAttribute("data-pressed");
      // The word stays while the label fades out, so it never blanks first.
      if (hit && word.current) {
        word.current.textContent = on?.getAttribute("data-ring") ?? "";
        wide = word.current.offsetWidth;
        place(e);
      }
    };
    /* The pointer left the window. Julian: the word should not be left
       hanging over the page with no pointer under it — which is what
       happened on the way to a bookmark or another window, because the
       last `pointermove` inside the page was over something with a word
       and nothing since said otherwise. `relatedTarget` is null exactly
       when the pointer has gone out of the document rather than into
       another element, and `blur` covers the window losing focus without
       the pointer crossing an edge: alt-tab, a screenshot tool, the
       browser's own chrome. The word fades on its own transition, and
       moving back in writes it again. */
    const away = () => {
      if (!over) return;
      over = null;
      el.removeAttribute("data-over");
      el.removeAttribute("data-pressed");
    };
    const left = (e: PointerEvent) => {
      if (e.relatedTarget === null) away();
    };

    const down = () => {
      if (over) el.setAttribute("data-pressed", "");
    };
    const up = () => el.removeAttribute("data-pressed");

    document.addEventListener("pointermove", move, { passive: true });
    /* And when what is under the pointer changes without the pointer
       moving — a click that navigates, a strip that glides past under a
       still hand. Measured in Julian's own Chrome: after opening a project
       from the work page the label still read VIEW PROJECT over a frame
       that zooms, until the mouse was nudged. `pointerover` carries
       coordinates like any pointer event, so the same handler does. */
    document.addEventListener("pointerover", move, { passive: true });
    document.addEventListener("pointerdown", down, { passive: true });
    document.addEventListener("pointerup", up, { passive: true });
    document.addEventListener("pointercancel", up, { passive: true });
    document.addEventListener("pointerout", left, { passive: true });
    window.addEventListener("blur", away);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", move);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      document.removeEventListener("pointerout", left);
      window.removeEventListener("blur", away);
    };
    // On `mounted`, not `[]`: the first render on a hydrated page returns
    // null, so `ref.current` is empty when this first runs and the listeners
    // were never attached — the ring sat at (0,0) with nothing driving it.
    // Re-running once the element exists is the whole point of the dep.
  }, [mounted, quiet]);

  if (!mounted || quiet) return null;

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
      className="pointer-events-none fixed left-0 top-0 z-50 will-change-transform"
    >
      <span
        ref={word}
        className={[
          "ring-tag block whitespace-nowrap",
          "font-mono text-[0.625rem] uppercase leading-none tracking-[0.18em]",
          "opacity-0 translate-y-1 transition-[opacity,translate] duration-200 ease-[var(--ease-out-strong)]",
          "in-data-over:opacity-100 in-data-over:translate-y-0",
          "in-data-pressed:opacity-70",
          "empty:hidden motion-reduce:transition-none",
        ].join(" ")}
      />
    </div>,
    document.body,
  );
}
