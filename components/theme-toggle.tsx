"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── the theme switch ─────────────────────────────────────────────
 * Dark is the site and the default. This offers the alternative without
 * arguing for it.
 *
 * The mark is drawn here rather than imported. An icon library would be a
 * dependency and a whole visual family brought in for one 18px glyph, and
 * the two shapes are an arc and eight lines — less code than the import.
 *
 * It shows what you will get, not what you have: a sun while the page is
 * dark. That is the convention, and it is the only reading that makes the
 * button feel like a control rather than a status light. The `sr-only`
 * label says it in full for anyone the convention fails.
 *
 * The swap is a crossfade with a quarter turn, on the same curve as the
 * cover's. Both marks are always mounted and stacked — animating opacity
 * and transform only, never layout, so the header never shifts.
 * ─────────────────────────────────────────────────────────────── */

/** Kept in step with the inline script in `app/layout.tsx`. */
const STORAGE_KEY = "theme";

type Theme = "dark" | "light";

const read = (): Theme =>
  document.documentElement.dataset.theme === "light" ? "light" : "dark";

/** Eight rays, evenly spaced, drawn rather than listed. */
const RAYS = Array.from({ length: 8 }, (_, i) => i * 45);

export function ThemeToggle({ className }: { className?: string }) {
  /**
   * Starts as `null`, not as `"dark"`.
   *
   * The server cannot know the choice — it lives in `localStorage`, which
   * the inline script reads before first paint. Rendering a guess here and
   * correcting it after hydration is how a toggle ends up briefly
   * contradicting the page it sits on.
   */
  const [theme, setTheme] = React.useState<Theme | null>(null);

  /** A mask needs a document-unique id, and the header renders on the server. */
  const moonId = `moon${React.useId().replace(/:/g, "")}`;

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

  // Until the effect runs, neither mark is shown — see the note on `theme`.
  const showSun = theme === "dark";
  const showMoon = theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      // A thumb target, like the burger beside it, rather than the 18px of
      // artwork.
      className={cn(
        "relative flex h-11 w-11 items-center justify-center text-muted-foreground",
        "transition-colors duration-200 hoverable:hover:text-foreground press active:scale-[0.94]",
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
        className="h-[1.125rem] w-[1.125rem] overflow-visible"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        {/* Sun. Shown while the page is dark. */}
        <g
          className={cn(
            "origin-center transition-[opacity,transform] duration-300 ease-[var(--ease-out-strong)]",
            "motion-reduce:transition-none",
            showSun ? "rotate-0 opacity-100" : "-rotate-90 opacity-0",
          )}
        >
          <circle cx="12" cy="12" r="4.25" />
          {RAYS.map((deg) => (
            <line
              key={deg}
              x1="12"
              y1="1.75"
              x2="12"
              y2="4"
              transform={`rotate(${deg} 12 12)`}
            />
          ))}
        </g>

        {/* Moon: a disc with a bite taken out of it.
         *
         * Drawn as a mask rather than as one clever arc. A crescent written
         * as two arcs needs the second radius to be at least half the chord
         * it spans, and when it is not, SVG silently scales the radius to fit
         * rather than failing — which is how the first attempt here rendered
         * as a 7px splinter instead of a moon, visible in the markup and
         * correct in every computed style.
         *
         * Two circles cannot go wrong that way: the shape is the first minus
         * the second, whatever the numbers.
         */}
        <mask id={moonId}>
          <rect x="0" y="0" width="24" height="24" fill="#fff" />
          <circle cx="16.5" cy="7.5" r="7.75" fill="#000" />
        </mask>
        <circle
          cx="12"
          cy="12"
          r="8.5"
          mask={`url(#${moonId})`}
          className={cn(
            "origin-center transition-[opacity,transform] duration-300 ease-[var(--ease-out-strong)]",
            "motion-reduce:transition-none",
            showMoon ? "rotate-0 opacity-100" : "rotate-90 opacity-0",
          )}
          // Filled, not stroked — an outlined crescent at 18px reads as a
          // fingernail.
          fill="currentColor"
          stroke="none"
        />
      </svg>
    </button>
  );
}
