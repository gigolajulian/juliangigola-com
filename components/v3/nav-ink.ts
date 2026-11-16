"use client";

import * as React from "react";

/* `?navfx=1` (app/styles/navfx.css): two jobs for the header on trial.
   1. `data-navtop` on the root while the bar has no ground: the top of a page, and on the homepage for as long
      as the hero shows.
   2. Each word in the bar is white or black, whichever reads better over what is under it (photo, film or page,
      with the bar's veil on top once it is on). Pixels come from a small copy of each photo, made once.
   3. Page words and buttons fade out as they slide under the bar; photos do not (Julian, 2026-11-16). */

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
    try {
      const d = x.getImageData(0, 0, 1, 1).data;
      c = [[d[0], d[1], d[2]], d[3] / 255];
    } catch {
      return c; // not cached: the next call tries again
    }
  }
  colours.set(css, c);
  return c;
}

/** A photo or film frame, shrunk to N by N. `null`: its pixels cannot be read. */
const N = 48; // was 24: on a wide photo one cell covered more than a 16px stretch, so a split landed off the real edge
const thumbs = new WeakMap<Element, { at: number; src: string; data: Uint8ClampedArray | null }>();
/* A canvas of its own each time: a photo from a host that does not allow reading taints the canvas it is drawn
   on for good, and on the shared one every later read threw (a preview serves its photos from the live host). */
function read(src: CanvasImageSource): Uint8ClampedArray | null {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const x = c.getContext("2d");
    if (!x) return null;
    x.drawImage(src, 0, 0, N, N);
    return x.getImageData(0, 0, N, N).data.slice();
  } catch {
    return null;
  }
}
/* A photo from another host with no CORS mode cannot be read, and Safari logs an error for the try even when it is
   caught (QA: 10 to 12 a load on previews). So it is not tried: such a photo goes straight to its same-host copy. */
const foreign = (src: string, el: HTMLImageElement | HTMLVideoElement) => {
  if (!src || /^(data|blob):/.test(src)) return false;
  try {
    return new URL(src, location.href).origin !== location.origin && el.crossOrigin === null;
  } catch {
    return true;
  }
};
/** Called when a photo that could not be read has a readable copy: the header looks again. */
let poke = () => {};
const copies = new Map<string, Uint8ClampedArray | null>();
function thumb(el: HTMLImageElement | HTMLVideoElement): Uint8ClampedArray | null {
  const film = el instanceof HTMLVideoElement, src = el.currentSrc || el.src, now = performance.now();
  const had = thumbs.get(el);
  if (had && had.src === src && (!film || now - had.at < 400)) return had.data ?? copies.get(src) ?? null;
  const data = foreign(src, el) ? null : read(el);
  thumbs.set(el, { at: now, src, data });
  if (data || film) return data;
  /* Unreadable: the same file from this host, without the resizer (`/cdn-cgi/image/<options>/<path>` on another
     host becomes `/<path>` here). Asked for once; the word keeps its ink until it lands. */
  const m = /^https?:\/\/[^/]+\/cdn-cgi\/image\/[^/]+\/(.+)$/.exec(src);
  if (m && !copies.has(src)) {
    copies.set(src, null);
    const im = new Image();
    im.onload = () => (copies.set(src, read(im)), poke());
    im.src = "/" + m[1];
  }
  return copies.get(src) ?? null;
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

/** Each photo's strength, kept for one look (cleared at the start of the next). */
const seen = new Map<Element, number>();
/** What shows at a point, under the header: the first photo, film or painted box from the top. */
function under(x: number, y: number, hdr: HTMLElement, page: RGB): RGB {
  for (const el of document.elementsFromPoint(x, y)) {
    if (hdr.contains(el) || el.closest("[aria-hidden].mt-dockname")) continue;
    if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement) {
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden") continue;
      // how solid it is, through its parents: the v4 hero's wall thins out as it leaves, and a dark photo at
      // half strength over a light page is a mid grey, not a dark ground
      let o = seen.get(el);
      if (o === undefined) {
        o = 1;
        for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) o *= +getComputedStyle(n).opacity; // the hero stage, ten levels up, is what dims
        seen.set(el, o);
      }
      if (o < 0.08) continue;
      const p = pixel(el, x, y);
      if (p) return o > 0.97 ? p : (p.map((v, i) => v * o + page[i] * (1 - o)) as RGB);
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
      seen.clear();
      const isTop = top();
      root.toggleAttribute("data-navtop", isTop);
      // The v4 home (Julian, 2026-11-15): the bar's wordmark waits until the hero's big name has gone, faded by hero.ts
      // or scrolled under the bar, so the name never shows twice. navfx.css hides it until this is set.
      const nm = path === "/" ? document.querySelector<HTMLElement>(".mt-name h1") : null;
      const nr = nm?.getBoundingClientRect();
      const blk = nm?.closest<HTMLElement>("[data-mt-name]");
      // only once the name is fully gone, so the two never show together: faded out, hidden by hero.ts at the end
      // of its exit (it rides out of the window at full strength under ?mtdock=left), or out of the window
      const shows = !!nr && nr.bottom > bar.offsetHeight && nr.top < innerHeight && blk?.style.visibility !== "hidden" && parseFloat(blk?.style.opacity || "1") > 0.02;
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
        /* One ink per stretch of about 16px, so a word that sits half on a photo and half on the page is white
           on one and black on the other (QA: "Ju" white on light grey). A stretch keeps its ink unless the other
           is clearly better, so it does not flicker on a busy photo, but never below 3:1. */
        const n = Math.max(1, Math.round(r.width / 16));
        const prev = el.dataset.inks ?? "";
        let inks = "";
        for (let k = 0; k < n; k++) {
          let c = under(r.left + (r.width * (k + 0.5)) / n, y, bar, page);
          if (veiled) c = [0, 1, 2].map((i) => c[i] * (1 - VEIL) + page[i] * VEIL) as RGB;
          const l = lum(c), white = 1.05 / (l + 0.05), black = (l + 0.05) / 0.05;
          const was = prev.length === n ? prev[k] : "";
          inks += was === "w" && white >= 3 && white * 1.25 >= black ? "w" : was === "b" && black >= 3 && black * 1.25 >= white ? "b" : white >= black ? "w" : "b";
        }
        if (inks === prev) continue;
        el.dataset.inks = inks;
        // the word's one ink: what most of it has (icons and the hover colours use it)
        const ink = inks.split("w").length - 1 >= n / 2 ? "w" : "b";
        el.dataset.ink = ink;
        el.style.setProperty("--nav-ink", ink === "w" ? "#fff" : "#000");
        // two grounds under a word of text: paint it in stretches (navfx.css clips the gradient to the letters)
        const mixed = el.matches(".site-wm,.links a") && inks.includes("w") && inks.includes("b");
        el.toggleAttribute("data-inkmix", mixed);
        if (mixed) {
          const stops = [...inks].map((ch, k) => `${ch === "w" ? "#fff" : "#000"} ${((k / n) * 100).toFixed(1)}% ${(((k + 1) / n) * 100).toFixed(1)}%`);
          el.style.setProperty("--nav-mix", `linear-gradient(90deg,${stops.join(",")})`);
        } else el.style.removeProperty("--nav-mix");
      }
    };
    /* Words and buttons under the bar. An observer on the band at the top of the window names the few that are in
       it; only those are measured, and each gets a mask cut along a line just under the bar. It follows anything
       that moves, by scroll or by transform (the v4 hero), and nothing outside the band carries a mask. */
    const EDGE = 20, SOFT = 28; // the line sits this far under the bar; the fade is this deep above it
    const live = new Set<HTMLElement>(), watched = new WeakSet<Element>(), cuts = new WeakMap<HTMLElement, string>();
    let cutRaf = 0, still = 0, count = -1;
    const mask = (el: HTMLElement, m: string) => {
      if ((cuts.get(el) ?? "") === m) return false;
      cuts.set(el, m);
      el.style.setProperty("-webkit-mask-image", m);
      el.style.maskImage = m;
      return true;
    };
    const cut = () => {
      cutRaf = 0;
      const bottom = bar.getBoundingClientRect().bottom, line = bottom > 0 ? Math.round(bottom) + EDGE : 0; // the bar can slide away
      let moved = false;
      for (const el of live) {
        const t = Math.round(el.getBoundingClientRect().top);
        if (mask(el, line && t < line ? `linear-gradient(#0000 ${line - t - SOFT}px,#000 ${line - t}px)` : "")) moved = true;
      }
      still = moved ? 0 : still + 1;
      // keeps going while things still move with no scroll event (a glide after the wheel stops), then rests
      if (live.size && still < 30) cutRaf = requestAnimationFrame(cut);
    };
    const kick = () => {
      still = 0;
      if (live.size && !cutRaf) cutRaf = requestAnimationFrame(cut);
    };
    const band = () =>
      new IntersectionObserver(
        (es) => {
          for (const e of es) {
            const el = e.target as HTMLElement;
            // one that already wears a mask of its own (the client marks) keeps it
            if (e.isIntersecting) {
              if (getComputedStyle(el).maskImage === "none") live.add(el);
            } else if (live.delete(el)) mask(el, "");
          }
          kick();
        },
        { rootMargin: `0px 0px -${Math.max(0, innerHeight - bar.offsetHeight - EDGE - 8)}px 0px` },
      );
    let io = band();
    // every element that holds text of its own, and every control: never one that only wraps a photo
    const scan = () => {
      const main = document.getElementById("main");
      if (!main) return;
      const n = main.getElementsByTagName("*").length;
      if (n === count) return;
      count = n;
      const walk = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      for (let t = walk.nextNode(); t; t = walk.nextNode()) {
        const el = t.parentElement;
        if (el && !watched.has(el) && t.nodeValue?.trim()) {
          watched.add(el);
          io.observe(el);
        }
      }
      for (const el of main.querySelectorAll("button,input,select,textarea"))
        if (!watched.has(el)) {
          watched.add(el);
          io.observe(el);
        }
    };
    const rebind = () => {
      io.disconnect();
      for (const el of live) mask(el, "");
      live.clear();
      io = band();
      count = -1;
      const main = document.getElementById("main");
      // the old observer's elements go to the new one
      if (main) for (const el of main.querySelectorAll<HTMLElement>("*")) watched.delete(el);
      scan();
    };
    scan();

    /* At most every 50ms while scrolling. The v4 hero's wall glides on for about a second after the last scroll
       event, so it keeps looking through that second too: one look at 120ms left the ink a photo behind (QA). */
    let until = 0;
    const tail = () => {
      raf ||= requestAnimationFrame(paint);
      // over the homepage hero the words sit on moving photos with no ground: every frame there, 60ms elsewhere
      if (performance.now() < until) timer = window.setTimeout(tail, root.hasAttribute("data-navtop") ? 16 : 60);
    };
    const ask = () => {
      until = performance.now() + 1100;
      clearTimeout(timer);
      timer = window.setTimeout(tail, 60);
      if (!raf && performance.now() - last > (root.hasAttribute("data-navtop") ? 12 : 50)) raf = requestAnimationFrame(paint);
    };
    poke = ask;
    const loaded = (e: Event) => (e.target instanceof HTMLImageElement || e.target instanceof HTMLVideoElement) && ask();
    addEventListener("scroll", ask, { passive: true });
    addEventListener("scroll", kick, { passive: true });
    addEventListener("resize", ask);
    addEventListener("resize", rebind);
    document.addEventListener("load", loaded, true);
    document.addEventListener("loadeddata", loaded, true);
    const watch = new MutationObserver(ask);
    watch.observe(root, { attributeFilter: ["data-theme", "data-tuck", "data-mt-intro", "data-mt-pasthero"] });
    paint();
    // Photos also move with no scroll event (the v4 hero glides on after the wheel stops, films play): look again twice a second.
    const again = window.setInterval(() => document.hidden || (ask(), scan(), kick()), 500);
    return () => {
      removeEventListener("scroll", ask);
      removeEventListener("scroll", kick);
      removeEventListener("resize", ask);
      removeEventListener("resize", rebind);
      io.disconnect();
      cancelAnimationFrame(cutRaf);
      for (const el of live) mask(el, "");
      document.removeEventListener("load", loaded, true);
      document.removeEventListener("loadeddata", loaded, true);
      watch.disconnect();
      clearTimeout(timer);
      clearInterval(again);
      poke = () => {};
      cancelAnimationFrame(raf);
      root.removeAttribute("data-navtop");
      root.removeAttribute("data-navdark");
      root.removeAttribute("data-navnamegone");
    };
  }, [hdr, path]);
}
