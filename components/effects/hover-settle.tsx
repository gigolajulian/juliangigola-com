"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/* ── a photograph's hover waits for the page to settle ──
   Julian: no photograph lights up under a still pointer while a page
   lands (2026-10-19). `data-hover` on the root, which the photographs'
   hovers need (`settled:` and their own `:hover` rules), comes on 600ms
   after the splash lifts and after each route lands (a crossing lands as
   one). Links, buttons and focus never wait. */
export function HoverSettle() {
  const path = usePathname();
  React.useEffect(() => {
    const root = document.documentElement;
    root.removeAttribute("data-hover");
    let t = 0;
    const arm = () => {
      if (root.hasAttribute("data-intro")) return;
      mo.disconnect();
      t = window.setTimeout(() => root.setAttribute("data-hover", ""), 600);
    };
    const mo = new MutationObserver(arm);
    mo.observe(root, { attributeFilter: ["data-intro"] });
    arm();
    return () => {
      mo.disconnect();
      window.clearTimeout(t);
    };
  }, [path]);
  return null;
}
