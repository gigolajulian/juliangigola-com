"use client";

import * as React from "react";

/* Motion plan 05: the project hero grows out of the portfolio cover that was
   clicked (work.tsx stores its box). Only with ?v3motion, never under reduced
   motion, and only within 3s of the click on this project. */
export function TileFly() {
  React.useLayoutEffect(() => {
    let f: { s: string; t: number; x: number; y: number; w: number } | null = null;
    try {
      f = JSON.parse(sessionStorage.getItem("jg-fly") || "null");
      sessionStorage.removeItem("jg-fly");
    } catch {}
    const big = document.querySelector<HTMLElement>(".pj-big");
    if (!f || !big || Date.now() - f.t > 3000 || !location.pathname.endsWith(`/${f.s}`)) return;
    if (!document.documentElement.hasAttribute("data-v3motion") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = big.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const ease = "cubic-bezier(.16,1,.3,1)";
    big.animate(
      [{ transformOrigin: "0 0", transform: `translate(${f.x - r.left}px, ${f.y - r.top}px) scale(${f.w / r.width})` }, { transformOrigin: "0 0", transform: "none" }],
      { duration: 550, easing: ease },
    );
    document.querySelector(".pj-top")?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 150, easing: ease, fill: "backwards" });
  }, []);
  return null;
}
