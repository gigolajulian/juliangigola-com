"use client";

import * as React from "react";
import { createPortal } from "react-dom";

/* ── the ring ─────────────────────────────────────────────────────
 * The cursor over something that opens large: a hollow circle that fills
 * when pressed.
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

const RADIUS = 18;

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
  const mounted = useMounted();

  React.useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }
    const el = ref.current;
    if (!el) return;

    let over = false;

    const move = (e: PointerEvent) => {
      el.style.transform = `translate3d(${e.clientX - RADIUS}px, ${e.clientY - RADIUS}px, 0)`;
      const hit = !!(e.target as Element | null)?.closest?.("[data-ring]");
      if (hit === over) return;
      over = hit;
      el.toggleAttribute("data-over", hit);
      if (!hit) el.removeAttribute("data-pressed");
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
          // Grey, not the page's ink: Julian asked for it. `muted-foreground`
          // is the grey the labels and the credits are already set in, so
          // the ring belongs to the same family as the type around it — and
          // over a photograph a mid grey reads as a mark laid on the picture
          // rather than a hole punched in it, the way full white did.
          "relative h-full w-full rounded-full border border-muted-foreground",
          // Arrives from slightly small, like everything else pressable here.
          "opacity-0 scale-75 transition-[opacity,scale] duration-200 ease-[var(--ease-out-strong)]",
          "in-data-over:opacity-100 in-data-over:scale-100",
          "motion-reduce:transition-none",
        ].join(" ")}
      >
        {/* A glow, feathered to nothing. Five times the ring and faint — the
            same grey at 12% at the centre, gone by two-thirds of the way
            out — so it lifts the sleeve under the pointer a shade rather
            than putting a torch on it. A radial gradient, not a blur
            filter: it costs nothing to move and it needs no compositor
            layer. */}
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 -z-10 size-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-radial from-muted-foreground/12 to-transparent to-66%"
        />
        {/* The fill. Grows from the centre on press and lets go on release —
            a transition, so a quick tap still reads as a fill and not a
            flash. */}
        <div
          className={[
            "h-full w-full rounded-full bg-muted-foreground",
            "scale-0 transition-[scale] duration-[260ms] ease-[var(--ease-out-strong)]",
            "in-data-pressed:scale-100",
            "motion-reduce:transition-none",
          ].join(" ")}
        />
      </div>
    </div>,
    document.body,
  );
}
