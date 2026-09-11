"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── the theme switch ─────────────────────────────────────────────
 * Dark is the site and the default. This offers the alternative without
 * arguing for it.
 *
 * Type, not an icon. A sun and a moon would be the first icons on a site
 * that has none, and at this size the word is both smaller and less
 * ambiguous than a glyph.
 *
 * It names what you will get, not what you have — "LIGHT" while the page
 * is dark — which is the convention, and the `aria-label` says so in full
 * for anyone the convention fails.
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
   * The server cannot know the choice — it lives in `localStorage`, which
   * the inline script reads before first paint. Rendering a guess here and
   * correcting it after hydration is how a toggle ends up briefly
   * contradicting the page it sits on. Until the effect runs there is no
   * label to print, so it prints none.
   */
  const [theme, setTheme] = React.useState<Theme | null>(null);

  React.useEffect(() => setTheme(read()), []);

  const toggle = () => {
    const next: Theme = read() === "dark" ? "light" : "dark";

    // The attribute is the source of truth and the thing the CSS keys off;
    // `localStorage` is only how it survives a reload.
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;

    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing, or storage disabled. The theme still changes for
      // this page; it simply will not be remembered. Not worth failing over.
    }

    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      // Both states named, because "LIGHT" alone does not say whether it
      // describes the current theme or the one behind the button.
      aria-label={theme ? `Switch to ${theme === "dark" ? "light" : "dark"} theme` : "Switch theme"}
      className={cn(
        "label tabular-nums text-muted-foreground transition-colors duration-200",
        "hoverable:hover:text-foreground",
        className,
      )}
    >
      {/* Reserved before hydration so the nav does not shift when the word
          arrives. `LIGHT` and `DARK` are the same character count, so one
          width holds both. */}
      <span aria-hidden className={cn(!theme && "opacity-0")}>
        {theme === "dark" ? "Light" : "Dark"}
      </span>
    </button>
  );
}
