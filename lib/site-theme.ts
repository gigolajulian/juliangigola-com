"use client";

import * as React from "react";

/* The site's own light or dark, read off the page (`data-theme`) and
   followed when it flips. The effects from Libraries.dev take a theme, and
   their "auto" reads the system's setting, not this site's switch. */
export function useSiteTheme(): "dark" | "light" {
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");
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
