"use client";

import * as React from "react";

/* `?navfx=1` (app/styles/navfx.css): two jobs for the header on trial.
   1. `data-navtop` on the root while the bar has no ground: the top of a page, and on the homepage for as long
      as the hero shows.
   2. Each word in the bar is white or black, whichever reads better over what is under it (photo, film or page,
      with the bar's veil on top once it is on). Pixels come from a small copy of each photo, made once. */

export const navfx = () => typeof document !== "undefined" && "navfx" in document.documentElement.dataset;

type RGB = [number, number, number];
const VEIL = 0.47; // --nav-veil
const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);

let pen: CanvasRenderingContext2D | null | undefined;
const one = () => (pen === undefined ? (pen = document.createElement("canvas").getContext("2d", { willReadFrequently: true })) : pen);

/** Any CSS colour as rgb plus alpha, through a 1px canvas (the tokens are oklch). */
const colours = new Map<string, [RGB, number]>();
function colour(css: string): [RGB, number] {
  let c = colours.get(css);
  if (c) return c;
  c = [[0, 0, 0], 0];
  const x = one();
  if (x && css) {
    x.canvas.width = x.canvas.height = 1;
    x.clearRect(0, 0, 1, 1);
    x.fillStyle = "#0000";
    x.fillStyle = css;
    x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    c = [[d[0], d[1], d[2]], d[3] / 255];
  }
  colours.set(css, c);
  return c;
}

/** A photo or film frame, shrunk to N by N. `null`: its pixels cannot be read. */
const N = 24;
const thumbs = new WeakMap<Element, { at: number; src: string; data: Uint8ClampedArray | null }>();
function thumb(el: HTMLImageElement | HTMLVideoElement): Uint8ClampedArray | null {
  const film = el instanceof HTMLVideoElement, src = el.currentSrc || el.src, now = performance.now();
  const had = thumbs.get(el);
  if (had && had.src === src && (!film || now - had.at < 400)) return had.data;
  let data: Uint8ClampedArray | null = null;
  const x = one();
  try {
    if (x) {
      x.canvas.width = x.canvas.height = N;
      x.drawImage(el, 0, 0, N, N);
      data = x.getImageData(0, 0, N, N).data.slice();
    }
  } catch {
    data = null;
  }
  thumbs.set(el, { at: now, src, data });
  return data;
}

/** The colour of a photo or film at a point on screen, through its object-fit and object-position. */
function pixel(el: HTMLImageElement | HTMLVideoElement, x: number, y: number): RGB | null {
  const nw = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth, nh = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
  if (!nw || !nh) return null;
  const data = thumb(el);
  if (!data) return null;
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  let u = (x - r.left) / r.width, v = (y - r.top) / r.height;
  if (cs.objectFit === "cover" || cs.objectFit === "contain") {
    const s = cs.objectFit === "cover" ? Math.max(r.width / nw, r.height / nh) : Math.min(r.width / nw, r.height / nh);
    const [px, py] = cs.objectPosition.split(" ").map((p) => (p.endsWith("%") ? parseFloat(p) / 100 : 0.5));
    u = (x - r.left - (r.width - nw * s) * (px ?? 0.5)) / (nw * s);
    v = (y - r.top - (r.height - nh * s) * (py ?? 0.5)) / (nh * s);
  }
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  const i = (Math.min(N - 1, Math.floor(v * N)) * N + Math.min(N - 1, Math.floor(u * N))) * 4;
  return [data[i], data[i + 1], data[i + 2]];
}

/** What shows at a point, under the header: the first photo, film or painted box from the top. */
function under(x: number, y: number, hdr: HTMLElement, page: RGB): RGB {
  for (const el of document.elementsFromPoint(x, y)) {
    if (hdr.contains(el) || el.closest("[aria-hidden].mt-dockname")) continue;
    if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement) {
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || +cs.opacity < 0.5) continue;
      const p = pixel(el, x, y);
      if (p) return p;
      continue;
    }
    const [c, a] = colour(getComputedStyle(el).backgroundColor);
    if (a > 0.5) return c;
  }
  return page;
}

const WORDS = ".site-wm,.links a,.tbtn,.menu-btn,.hslot";

export function useNavInk(hdr: React.RefObject<HTMLElement | null>, path: string) {
  React.useEffect(() => {
    const bar = hdr.current, root = document.documentElement;
    if (!bar || !navfx()) return;
    let raf = 0, timer = 0, last = 0;
    const top = () => {
      // The homepage: no ground while its hero shows (the v4 hero, or the cover). Elsewhere: none at the very top.
      const hero = path === "/" ? document.querySelector(".mt-hero, .a-cover") : null;
      // `data-mt-pasthero` is the v4 hero's own "the hero is over" (hero.ts, where it is set); the measure covers a build without it.
      return hero ? hero.getBoundingClientRect().bottom > bar.offsetHeight && !root.hasAttribute("data-mt-pasthero") : scrollY <= 8;
    };
    const paint = () => {
      raf = 0;
      last = performance.now();
      const isTop = top();
      root.toggleAttribute("data-navtop", isTop);
      // The v4 home (Julian, 2026-11-15): the bar's wordmark waits until the hero's big name has gone, faded by hero.ts
      // or scrolled under the bar, so the name never shows twice. navfx.css hides it until this is set.
      const nm = path === "/" ? document.querySelector<HTMLElement>(".mt-name h1") : null;
      const nr = nm?.getBoundingClientRect();
      const shows = !!nr && nr.bottom > bar.offsetHeight && nr.top < innerHeight && parseFloat(nm?.closest<HTMLElement>("[data-mt-name]")?.style.opacity || "1") > 0.02; // only once the name is fully gone: the two never show together
      root.toggleAttribute("data-navnamegone", !shows);
      // A section that is dark in both themes (the v4 footer sets its own --bg) under a light page: the bar takes
      // the dark ground there (navfx.css), or its light veil over it would be a mid grey nothing reads on.
      const [rootBg] = colour(getComputedStyle(root).getPropertyValue("--bg").trim());
      const sec = document.elementsFromPoint(innerWidth / 2, bar.getBoundingClientRect().bottom - 1).find((el) => !bar.contains(el) && !el.closest(".mt-dockname"));
      const [secBg] = sec ? colour(getComputedStyle(sec).getPropertyValue("--bg").trim()) : [rootBg];
      root.toggleAttribute("data-navdark", lum(rootBg) > 0.2 && lum(secBg) < 0.2);
      const [page] = colour(getComputedStyle(bar).getPropertyValue("--bg").trim());
      const veiled = !isTop && !root.hasAttribute("data-tuck");
      for (const el of bar.querySelectorAll<HTMLElement>(WORDS)) {
        const r = el.getBoundingClientRect();
        if (!r.width || r.bottom < 0) continue;
        const y = r.top + r.height / 2;
        // Five points along the word, and the middle one by brightness: the ink suits most of the word, so a
        // few pixels hanging over a gutter or a photo's edge do not decide it.
        const ls = [0.1, 0.3, 0.5, 0.7, 0.9].map((t) => {
          let c = under(r.left + r.width * t, y, bar, page);
          if (veiled) c = [0, 1, 2].map((i) => c[i] * (1 - VEIL) + page[i] * VEIL) as RGB;
          return lum(c);
        }).sort((a, b) => a - b);
        const white = 1.05 / (ls[2] + 0.05), black = (ls[2] + 0.05) / 0.05;
        const was = el.dataset.ink;
        // Keep the ink it has unless the other one is clearly better, so a word does not flicker on a busy photo.
        const ink = was === "w" && white * 1.25 >= black ? "w" : was === "b" && black * 1.25 >= white ? "b" : white >= black ? "w" : "b";
        if (ink !== was) {
          el.dataset.ink = ink;
          el.style.setProperty("--nav-ink", ink === "w" ? "#fff" : "#000");
        }
      }
    };
    // At most every 80ms while scrolling, and once more when it settles.
    const ask = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => (raf ||= requestAnimationFrame(paint)), 120);
      if (!raf && performance.now() - last > 80) raf = requestAnimationFrame(paint);
    };
    const loaded = (e: Event) => (e.target instanceof HTMLImageElement || e.target instanceof HTMLVideoElement) && ask();
    addEventListener("scroll", ask, { passive: true });
    addEventListener("resize", ask);
    document.addEventListener("load", loaded, true);
    document.addEventListener("loadeddata", loaded, true);
    const watch = new MutationObserver(ask);
    watch.observe(root, { attributeFilter: ["data-theme", "data-tuck", "data-mt-intro", "data-mt-pasthero"] });
    paint();
    // Photos also move with no scroll event (the v4 hero glides on after the wheel stops, films play): look again twice a second.
    const again = window.setInterval(() => document.hidden || ask(), 500);
    return () => {
      removeEventListener("scroll", ask);
      removeEventListener("resize", ask);
      document.removeEventListener("load", loaded, true);
      document.removeEventListener("loadeddata", loaded, true);
      watch.disconnect();
      clearTimeout(timer);
      clearInterval(again);
      cancelAnimationFrame(raf);
      root.removeAttribute("data-navtop");
      root.removeAttribute("data-navdark");
      root.removeAttribute("data-navnamegone");
    };
  }, [hdr, path]);
}
