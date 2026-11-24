"use client";

import * as React from "react";
import { getImageProps } from "next/image";
import { GRID_SIZES, STRIP_SIZES, type WorkItem } from "@/components/portfolio/work-tiles";

/** Covers ahead of the eye: the other view's first covers warmed, and the lazy photos near the scroll asked for in order. */
export function useCoverPreload(
  view: "grid" | "strip" | "color",
  list: WorkItem[],
  cells: unknown,
  shown: unknown,
  stripRef: React.RefObject<HTMLDivElement | null>,
) {
  /* The strip asks for larger files than the grid, so on a phone its covers
     flew in empty and the photos popped in after (Julian, iPhone and iPad).
     The other view's first frames are fetched and decoded while this one is
     up, both ways: back to the grid showed one grey frame too. */
  /* A phone at DPR 3 paid ~760 KB for eight strip covers it might never
     open (audit v3.0.92): the timer now warms the first three, the rest
     wait for a hand on the strip button, and Save-Data skips it all. */
  const warm = React.useCallback(
    (n: number) => {
      const net = navigator.connection;
      if (view === "color" || net?.saveData || /2g|3g/.test(net?.effectiveType ?? "")) return;
      for (const p of list.slice(0, n)) {
        const { props } = getImageProps({ src: p.cover, alt: "", fill: true, sizes: view === "strip" ? GRID_SIZES : STRIP_SIZES });
        const im = new window.Image();
        if (props.sizes) im.sizes = props.sizes;
        if (props.srcSet) im.srcset = props.srcSet;
        im.src = props.src;
        im.decode().catch(() => {});
      }
    },
    [list, view],
  );
  React.useEffect(() => {
    const t = setTimeout(() => warm(view === "strip" ? 12 : 3), 1200);
    return () => clearTimeout(t);
  }, [warm, view]);

  /* On for everyone (Julian, 2026-11-22: "push to live"): the lazy photos
     within 1.5 screens ahead of the scroll are asked for in reading order,
     LOOK_CAP at a time, so covers land in order and never as a burst. It
     promotes the real <img>, so each file is fetched once at its own width. */
  React.useEffect(() => {
    const net = navigator.connection;
    if (view === "color" || net?.saveData || /2g|3g/.test(net?.effectiveType ?? "")) return;
    const LOOK_CAP = 3;
    let busy = 0;
    let raf = 0;
    let first = true;
    const html = document.documentElement;
    html.dataset.preload = "";
    /* A cover fades in once its photo has landed and it is on screen, so it
       never shows as an empty card that fills later. A
       photo already there when the view mounts (cached, back from the
       strip) is shown at once, so the grid/strip flip finds it in place. */
    const reveal = () => {
      let n = 0;
      for (const f of document.querySelectorAll<HTMLElement>("#p-work :is(.wgrid .wt, .wstrip .sc):not([data-up])")) {
        const im = f.querySelector<HTMLImageElement>("img:not(.bk)");
        if (!im?.complete) continue;
        const r = f.getBoundingClientRect();
        const shown = (Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / r.height) * (Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) / r.width);
        if (first ? !shown : shown < 1 / 3) continue; // fades in once a third of it is on screen
        if (first) f.dataset.up = "0";
        else {
          f.style.setProperty("--up-d", `${Math.min(n++, 5) * 70}ms`);
          f.dataset.up = "1";
        }
      }
      first = false;
    };
    const pump = () => {
      raf = 0;
      reveal();
      const s = stripRef.current;
      const side = !!s && s.scrollWidth > s.clientWidth; // a phone stacks the strip: it scrolls down, like the grid
      for (const im of document.querySelectorAll<HTMLImageElement>("#p-work :is(.wgrid, .wstrip) img[loading=lazy]:not(.bk)")) {
        if (busy >= LOOK_CAP) return;
        const r = im.getBoundingClientRect();
        if (side ? r.right < 0 : r.bottom < 0) continue; // scrolled past: native lazy has it if it comes back
        if (side ? r.left > innerWidth * 2.5 : r.top > innerHeight * 2.5) return; // reading order: the rest are further still
        im.loading = "eager";
        if (im.complete) continue;
        busy++;
        const done = () => {
          busy--;
          schedule();
        };
        im.addEventListener("load", done, { once: true });
        im.addEventListener("error", done, { once: true });
      }
    };
    const schedule = () => {
      raf ||= requestAnimationFrame(pump);
    };
    schedule();
    addEventListener("scroll", schedule, { capture: true, passive: true });
    addEventListener("load", schedule, true); // a photo landing, by native lazy or this queue
    addEventListener("error", schedule, true); // a dead photo still shows its card
    return () => {
      busy = Infinity; // a load still in flight wakes nothing after this
      cancelAnimationFrame(raf);
      removeEventListener("scroll", schedule, { capture: true });
      removeEventListener("load", schedule, true);
      removeEventListener("error", schedule, true);
      delete html.dataset.preload;
    };
  }, [view, cells, list, shown, stripRef]);
  return warm;
}
