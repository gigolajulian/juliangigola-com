"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── the theme switch ─────────────────────────────────────────────
 * Dark is the site and the default. This offers the alternative without
 * arguing for it.
 *
 * A circle, half of it filled, that turns over when pressed. One shape, and
 * the rotation is the state rather than a decoration on top of it — half
 * light and half dark is the contrast mark, and which half is which says
 * which way the page is set.
 *
 * That replaced a sun and a moon crossfading past each other: two marks
 * always mounted, eight rays, an SVG mask with a document-unique id, and a
 * quarter turn each. All of it to say one bit of information. The mark no
 * longer previews the destination the way a sun-while-dark does — the
 * `sr-only` label carries that, in full, which is also the only version a
 * screen reader ever had.
 *
 * Opacity and transform only, never layout, so the header cannot shift.
 * ─────────────────────────────────────────────────────────────── */

/** Kept in step with the inline script in `app/layout.tsx`. */
const STORAGE_KEY = "theme";

type Theme = "dark" | "light";

const read = (): Theme =>
  document.documentElement.dataset.theme === "light" ? "light" : "dark";

export function ThemeToggle({ className }: { className?: string }) {
  /**
   * Starts as `null`, not as `"dark"`.
   *
   * The server cannot know the choice — it lives in `localStorage`, which the
   * inline script reads before first paint. `null` is also what suppresses
   * the turn on arrival: a visitor who chose light would otherwise watch the
   * mark spin half a circle on every page load, animating a state it was
   * already in.
   */
  const [theme, setTheme] = React.useState<Theme | null>(null);

  React.useEffect(() => setTheme(read()), []);

  const toggle = () => {
    const next: Theme = read() === "dark" ? "light" : "dark";

    // The attribute is the source of truth and what the CSS keys off;
    // `localStorage` is only how it survives a reload.
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;

    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing, or storage disabled. The theme still changes for
      // this page; it simply will not be remembered.
    }

    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      // A thumb target, like the burger beside it, rather than the 18px of
      // artwork.
      // Constant colour, and no hover brighten. The mark is a ring, so
      // taking it from muted to foreground on hover read as a thin white
      // border appearing around the icon and staying until the pointer left
      // — which is what a click looks like, since the cursor is still on it.
      // The same brighten is right on a text link and wrong on an outline.
      // Press is the feedback here, and the cursor is the affordance.
      className={cn(
        "relative flex h-11 w-11 items-center justify-center text-foreground",
        "press active:scale-[0.94]",
        className,
      )}
    >
      <span className="sr-only">
        {theme
          ? `Switch to ${theme === "dark" ? "light" : "dark"} theme`
          : "Switch theme"}
      </span>

      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className={cn(
          "h-[1.125rem] w-[1.125rem] origin-center",
          // Only once the real theme is known — see the note on `theme`.
          theme !== null &&
            "transition-transform duration-500 ease-[var(--ease-out-strong)] motion-reduce:transition-none",
          theme === "light" && "rotate-180",
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="8.5" />
        {/* The filled half: top of the circle, clockwise round the right side
            to the bottom, then straight back up the diameter.

            An arc rather than a half-disc drawn some other way, because the
            fill has to share an edge with the stroked circle exactly — a
            rectangle clipped to the circle leaves a hairline of ground
            showing along the curve at some sizes, and a second stroked path
            doubles the outline down the middle. */}
        <path d="M12 3.5A8.5 8.5 0 0 1 12 20.5Z" fill="currentColor" />
      </svg>
    </button>
  );
}
