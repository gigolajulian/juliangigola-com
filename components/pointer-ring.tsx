"use client";

import * as React from "react";

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
 * ─────────────────────────────────────────────────────────────── */

const RADIUS = 18;

export function PointerRing() {
  const ref = React.useRef<HTMLDivElement>(null);

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
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      // Sized by the constant above, so the offset in `move` and the box
      // here cannot disagree.
      style={{ width: RADIUS * 2, height: RADIUS * 2 }}
      className={[
        "pointer-events-none fixed left-0 top-0 z-50 rounded-full border border-foreground",
        // Arrives from slightly small, like everything else pressable here.
        "opacity-0 scale-75 transition-[opacity,scale] duration-200 ease-[var(--ease-out-strong)]",
        "data-over:opacity-100 data-over:scale-100",
        "motion-reduce:transition-none",
      ].join(" ")}
    >
      {/* The fill. Grows from the centre on press and lets go on release —
          a transition, so a quick tap still reads as a fill and not a
          flash. */}
      <div
        className={[
          "h-full w-full rounded-full bg-foreground",
          "scale-0 transition-[scale] duration-260 ease-[var(--ease-out-strong)]",
          "in-data-pressed:scale-100",
          "motion-reduce:transition-none",
        ].join(" ")}
      />
    </div>
  );
}
