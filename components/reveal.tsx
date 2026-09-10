"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Reveals its children once, when they scroll into view.
 *
 * `clip-path` rather than opacity: a photograph fading up from nothing reads
 * as a loading state, while a clip wipe reads as a print being uncovered. It
 * also means the frame is never semi-transparent over the page ground, which
 * is what makes a fade look washed out on a dark background.
 *
 * Fires once and then stops observing — re-animating on the way back up makes
 * a long gallery feel unstable, and the visitor has already seen it.
 *
 * Reduced motion is handled in CSS rather than by branching here, so there is
 * only ever one code path: the observer still reveals the frame, it just does
 * it without a transition.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Milliseconds. Keep stagger steps short — 40-80ms reads as one gesture. */
  delay?: number;
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
      // Start the wipe slightly before the frame's edge clears the fold, so it
      // has finished by the time it is properly in view. An element already on
      // screen at load fires on the first callback, so the top of a page does
      // not wait for a scroll that may never come.
      { rootMargin: "0px 0px -12% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-shown={shown || undefined}
      className={cn("reveal", className)}
      style={{ transitionDelay: shown ? `${delay}ms` : undefined }}
    >
      {children}
    </div>
  );
}
