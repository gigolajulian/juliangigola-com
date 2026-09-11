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

        {/* Moon. A crescent cut from two arcs rather than a borrowed path:
            the left half of a 9-radius circle, closed by the bulge of a
            7-radius one. */}
        <path
          d="M 12 3 A 9 9 0 1 0 12 21 A 7 7 0 1 1 12 3 Z"
          className={cn(
            "origin-center transition-[opacity,transform] duration-300 ease-[var(--ease-out-strong)]",
            "motion-reduce:transition-none",
            showMoon ? "rotate-0 opacity-100" : "rotate-90 opacity-0",
          )}
          // The crescent is a filled shape, not a stroked outline — an
          // outlined one at this size reads as a fingernail.
          fill="currentColor"
          stroke="none"
        />
      </svg>
    </button>
  );
}
