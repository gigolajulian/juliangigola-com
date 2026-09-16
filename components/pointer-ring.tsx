"use client";

import * as React from "react";
import { createPortal } from "react-dom";

/* ── the ring ─────────────────────────────────────────────────────
 * The cursor over something that opens large: a hollow circle that fills
 * when pressed, drawn in the inverse of whatever it is over.
 *
 * Not a `cursor:` image. Those are bitmaps handed to the operating system,
 * so they cannot animate, cannot read a CSS variable, and are drawn the same
 * on a black sleeve in dark mode as on a cream one in light. This is an
 * element that follows the pointer instead — one `transform` written per
 * move, no state, no re-render — which makes the fill a transition, the
 * colour `currentColor`, and the whole thing one component.
 *
 * Only where there is a pointer to follow: `hoverable` gates it, so a phone
 * never mounts the listeners. Anything that should carry it says so with
 * `data-ring` and hides the system cursor with `hoverable:cursor-none`; the
 * ring appears over those and nowhere else, and a lightbox opening under a
 * click hides it by the same rule — the pointer is no longer over a sleeve.
 * The attribute's value, if it has one, is a word set under the ring —
 * "Zoom in" over a frame, "Next project" over the cell that leads on —
 * which is the label the reference site (remyshoots.co.za) hangs off its
 * pointer, and which Julian asked for.
 *
 * Portalled to `<body>`, and this is a bug fixed. `position: fixed` is
 * relative to the viewport only while no ancestor has a transform — and
 * `<main>` has one: `rise` leaves `translateY(0)` on it at rest, which is
 * identity but still a transform, so the ring was fixed to `<main>` instead.
 * At scroll 0 nobody could tell. The cover-art rack is below the fold, and
 * once scrolled to it the ring sat `scrollY` pixels off the pointer and
 * jumped with every wheel tick — "very glitchy once I go over the cover
 * arts". Rendered under `<body>` it has no transformed ancestors to inherit.
 * ─────────────────────────────────────────────────────────────── */

// Larger than the hairline ring it replaced: glass needs some area to be
// seen as glass, and a drop of it is what the pointer is now.
const RADIUS = 22;

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

    /* What the pointer is over, not whether it is over something: moving
       from a frame straight into the picture it opened kept the first
       word, because only the boolean had changed and the word was written
       on that change. */
    let over: Element | null = null;

    const move = (e: PointerEvent) => {
      el.style.transform = `translate3d(${e.clientX - RADIUS}px, ${e.clientY - RADIUS}px, 0)`;
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
      /* And the system cursor goes, from the root rather than from the
         element under the pointer. `hoverable:cursor-none` on the target
         only reaches what inherits from it: a button, a link or anything
         with a cursor of its own inside that target draws the arrow back
         on top of the ring, which is two pointers at once. One attribute
         and one rule in `globals.css` covers the page for as long as the
         ring is up. */
      document.documentElement.toggleAttribute("data-ring-over", hit);
      if (!hit) el.removeAttribute("data-pressed");
      // The word stays while the ring fades out, so it never blanks first.
      if (hit && word.current) {
        word.current.textContent = on?.getAttribute("data-ring") ?? "";
      }
    };
    const down = () => {
      if (over) el.setAttribute("data-pressed", "");
    };
    const up = () => el.removeAttribute("data-pressed");

    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerdown", down, { passive: true });
    document.addEventListener("pointerup", up, { passive: true });
    document.addEventListener("pointercancel", up, { passive: true });
    return () => {
      document.documentElement.removeAttribute("data-ring-over");
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
    };
    // On `mounted`, not `[]`: the first render on a hydrated page returns
    // null, so `ref.current` is empty when this first runs and the listeners
    // were never attached — the ring sat at (0,0) with nothing driving it.
    // Re-running once the element exists is the whole point of the dep.
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    /* Two elements, and the split is the fix for a slide.

       The individual `scale` property composes *after* `transform`, both
       about the element's transform-origin — which is the centre of the box
       where it would be with no transform at all, up in the corner of the
       viewport. So `scale-75` on the element that carries the translate did
       not shrink the ring in place: it scaled its whole offset, and a ring
       meant for (761, 559) sat at (575, 424) until the entrance finished,
       then slid 180px into position over 200ms. Every appearance was a
       swoop from the wrong place. Measured on the dev server.

       The outer element only moves. Everything that scales or fades is
       inside it, about its own centre, so the ring is exactly under the
       pointer at every instant of its entrance. */
    <div
      ref={ref}
      aria-hidden
      // Sized by the constant above, so the offset in `move` and the box
      // here cannot disagree.
      style={{ width: RADIUS * 2, height: RADIUS * 2 }}
      // Its own compositor layer: the transform changes on every pointer
      // move, and promoting it up front is what keeps that from being a
      // repaint of whatever it is over.
      className="pointer-events-none fixed left-0 top-0 z-50 will-change-transform"
    >
      <div
        className={[
          // A drop of the site's own glass (`glass` in `globals.css`, the
          // material of the lightbox's buttons and the header's ground),
          // with its catch light left on at the upper left, where a light
          // would strike it. It used to be a hairline ring inverting what
          // it was over; Julian asked for a liquid glass look across the
          // site, and one material everywhere is what makes it a theme.
          "glass glass-lit relative h-full w-full rounded-full",
          // Clearer than the buttons' glass: a pointer is looked through,
          // a button is read, and at the buttons' fill it was a disc.
          "[--glass-fill:color-mix(in_oklab,var(--background)_22%,transparent)]",
          // Arrives from slightly small, like everything else pressable here.
          "opacity-0 scale-75 transition-[opacity,scale] duration-200 ease-[var(--ease-out-strong)]",
          "in-data-over:opacity-100 in-data-over:scale-100",
          // Pressed, the drop squashes a little: glass has weight.
          "in-data-pressed:scale-[0.88]",
          "motion-reduce:transition-none",
        ].join(" ")}
        style={{ "--gx": "35%", "--gy": "25%" } as React.CSSProperties}
      >
        {/* The fill. A brighter drop grows from the centre on press and lets
            go on release, a transition, so a quick tap still reads as a
            press and not a flash. */}
        <div
          className={[
            "h-full w-full rounded-full bg-white/45",
            "scale-0 transition-[scale] duration-[260ms] ease-[var(--ease-out-strong)]",
            "in-data-pressed:scale-100",
            "motion-reduce:transition-none",
          ].join(" ")}
        />
      </div>
      {/* The word, below and to the right of the ring, the way a tag hangs
          off a pointer; a hair later than the ring so the ring leads. Set
          as a focus box — four corner marks around a dark pane, mono caps —
          which is the design Julian drew for VIEW PROJECT, DRAG, ZOOM IN
          and ZOOM OUT. Its own ground and its own ink rather than the
          page's: it is read over photographs of every tone, and a word
          under `difference` on a mid-grey frame is unreadable. Empty when
          the element gave no word, and `empty:` hides it rather than
          leaving a mark. */}
      <span
        ref={word}
        className={[
          "ring-tag absolute left-full top-full -ml-1 -mt-1 whitespace-nowrap",
          "font-mono text-[0.625rem] uppercase leading-none tracking-[0.18em]",
          "opacity-0 translate-y-1 transition-[opacity,translate] duration-200 ease-[var(--ease-out-strong)]",
          "in-data-over:opacity-100 in-data-over:translate-y-0 in-data-over:delay-[40ms]",
          "empty:hidden motion-reduce:transition-none",
        ].join(" ")}
      />
    </div>,
    document.body,
  );
}
