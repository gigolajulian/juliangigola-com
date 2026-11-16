"use client";

import * as React from "react";

/* The site's own light or dark, read off the page (`data-theme`) and
   followed when it flips. The effects from Libraries.dev take a theme, and
   their "auto" reads the system's setting, not this site's switch. */
export function useSiteTheme(): "dark" | "light" {
  return useSiteThemeRead() ?? "dark";
}

/* The same, but null until the page has been read: for a caller that must
   not mount on a guess (the Astryx desks, whose root Theme writes data-theme
   onto <html> itself and would lock the guess in). */
export function useSiteThemeRead(): "dark" | "light" | null {
  const [theme, setTheme] = React.useState<"dark" | "light" | null>(null);
  React.useEffect(() => {
    const root = document.documentElement;
    const read = () =>
      setTheme(root.dataset.theme === "light" ? "light" : "dark");
    read();
    const watch = new MutationObserver(read);
    watch.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => watch.disconnect();
  }, []);
  return theme;
}
