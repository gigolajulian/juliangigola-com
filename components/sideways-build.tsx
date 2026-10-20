"use client";

import * as React from "react";

/* ── the sideways build-up (`?motion=sideways`, off by default) ───
 * The homepage's screens build themselves as they arrive: the label,
 * the title, then the rest, 75ms apart, and the photographs wipe open
 * from the side the strip is travelling from. All of it is CSS
 * (`styles/sideways.css`); this only says which screen is here.
 *
 * Sideways (iPad and up) a screen is "in" once 60% of it shows, and
 * the one it replaced goes "out". The deck pins every screen at the
 * edge, so a covered screen still reads as on screen: the screen here
 * is the last one that shows, not the first. Down a phone a screen is
 * taller than the window, so each piece goes "in" as it scrolls into
 * frame instead.
 *
 * `?motion=sideways` keeps it on for the visit, `?motion=0` turns it off.
 * ─────────────────────────────────────────────────────────────── */

const KEY = "jg-motion";
const PIECES = ".label, .title, .contact-title, h2, h3, .title-rest, .font-display, img";

export function SidewaysBuild() {
  React.useEffect(() => {
    let on = false;
    try {
      const q = new URLSearchParams(location.search).get("motion");
      if (q === "sideways") sessionStorage.setItem(KEY, q);
      if (q === "0") sessionStorage.removeItem(KEY);
      on = sessionStorage.getItem(KEY) === "sideways";
    } catch {}
    const strip = document.querySelector<HTMLElement>("main .strip-scroll");
    if (!on || !strip) return;
    const root = document.documentElement;
    root.dataset.motion = "sideways";
    const phone = matchMedia("(max-width: 39.99rem)");
    let stop = () => {};

    const sideways = () => {
      const seen = new Map<Element, number>();
      let here = -1;
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) seen.set(e.target, e.intersectionRatio);
          const cells = [...strip.children];
          let next = -1;
          cells.forEach((c, i) => {
            // A zero-wide cell (the window into the work) reads as wholly in view.
            if ((c as HTMLElement).offsetWidth && (seen.get(c) ?? 0) >= 0.6) next = i;
          });
          if (next < 0 || next === here) return;
          root.style.setProperty("--build-dir", next > here ? "1" : "-1");
          if (here >= 0) (cells[here] as HTMLElement).dataset.build = "out";
          (cells[next] as HTMLElement).dataset.build = "in";
          here = next;
        },
        { threshold: [0, 0.6] },
      );
      const watch = () => {
        // The cover leaves like any screen but builds itself (the splash).
        [...strip.children].forEach((c, i) => {
          const cell = c as HTMLElement;
          // Held empty until it builds, or it shows, blanks and builds.
          if (i && !cell.dataset.build && cell.offsetWidth) cell.dataset.build = "wait";
          io.observe(c);
        });
      };
      watch();
      // Held-back screens arrive later (`defer`).
      const mo = new MutationObserver(watch);
      mo.observe(strip, { childList: true });
      return () => {
        io.disconnect();
        mo.disconnect();
      };
    };

    const stacked = () => {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries)
            if (e.isIntersecting) {
              (e.target as HTMLElement).dataset.build = "in";
              io.unobserve(e.target);
            }
        },
        { rootMargin: "0px 0px -12% 0px" },
      );
      const watch = () => {
        for (const c of [...strip.children].slice(1))
          c.querySelectorAll<HTMLElement>(PIECES).forEach((p) => {
            if (!p.dataset.build) io.observe(p);
          });
      };
      watch();
      const mo = new MutationObserver(watch);
      mo.observe(strip, { childList: true, subtree: true });
      return () => {
        io.disconnect();
        mo.disconnect();
      };
    };

    const mode = () => {
      stop();
      strip.querySelectorAll<HTMLElement>("[data-build]").forEach((el) => delete el.dataset.build);
      root.dataset.build = phone.matches ? "stacked" : "sideways";
      stop = phone.matches ? stacked() : sideways();
    };
    mode();
    phone.addEventListener("change", mode);
    return () => {
      phone.removeEventListener("change", mode);
      stop();
      delete root.dataset.motion;
      delete root.dataset.build;
    };
  }, []);

  return null;
}
