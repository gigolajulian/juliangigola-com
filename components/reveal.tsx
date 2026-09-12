"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Reveals its children once, when they scroll into view.
 *
 * Two characters, because a photograph and a paragraph do not want the same
 * motion. `photo` lifts from 0.6 opacity on a spring — a print being set
 * down, never fading up from nothing, which reads as a loading state. `calm`
 * is the flat fade-and-lift that belongs to type: no scale, no overshoot,
 * because an overshoot on a line of text reads as the page wobbling.
 *
 * All the values live in CSS (`@utility reveal` / `reveal-calm`). This only
 * decides *when*, by flipping one attribute — which is what keeps the two
 * cases it has to survive declarative:
 *
 *   - reduced motion: the block still appears, it just does not travel.
 *   - no scripting: the observer never runs, so CSS unhides everything and
 *     the page is readable without JavaScript at all.
 *
 * Fires once and then stops observing — re-animating on the way back up makes
 * a long gallery feel unstable, and the visitor has already seen it.
 *
 * Stagger is not a prop. Put `stagger` on the parent instead: siblings that
 * cross the fold in the same frame get stepped delays from CSS, and blocks
 * stacked down a page already stagger themselves by scroll position.
 */
export function Reveal({
  children,
  className,
  variant = "photo",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "photo" | "calm";
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      // Start slightly before the block's edge clears the fold, so it has
      // finished by the time it is properly in view — and so a keyboard
      // visitor never lands focus inside something still invisible. An
      // element already on screen at load fires on the first callback, so the
      // top of a page does not wait for a scroll that may never come.
      { rootMargin: "0px 0px -12% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-shown={shown || undefined}
      // A new variant needs adding to the reduced-motion and `scripting: none`
      // blocks in `globals.css` as well as here. They name each class rather
      // than relying on `.reveal` always being present, because the no-JS one
      // decides whether the page is readable at all.
      className={cn("reveal", variant === "calm" && "reveal-calm", className)}
    >
      {children}
    </div>
  );
}
