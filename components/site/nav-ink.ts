"use client";

import * as React from "react";

/* The header (app/styles/navfx.css), on for everyone since 2026-11-22, `?navfx=0` off for the tab:
   1. `data-navtop` on the root while the bar has no ground: the top of a page, and on the homepage for as long
      as the hero shows.
   2. Each word in the bar is white or black, whichever reads better over what is under it (photo, film or page,
      with the bar's veil on top once it is on). Pixels come from a small copy of each photo, made once.
   3. Page words and buttons fade out as they slide under the bar; photos do not. */

export const navfx = () => typeof document !== "undefined" && "navfx" in document.documentElement.dataset;

type RGB = [number, number, number];
const VEIL = 0.47; // --nav-veil
const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const unlin = (v: number) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
/** The bar's one ink: the one that leaves the fewest spots under 4.5:1 (WCAG AA) through the words, not the one
    most stretches prefer (audit 2026-11-22, P1). The other ink takes over only once it fails clearly fewer spots,
    so a busy photo does not flip the bar back and forth. */
export function barInk(grounds: RGB[], was: string | null): "w" | "b" {
  let w = 0, b = 0; // spots each ink fails
  for (const g of grounds) {
    const l = lum(g);
    if (1.05 / (l + 0.05) < 4.5) w++;
    if ((l + 0.05) / 0.05 < 4.5) b++;
  }
  const lead = Math.max(1, grounds.length * 0.1); // clearly: a tenth of the spots
  if (was === "w") return w - b > lead ? "b" : "w";
  if (was === "b") return b - w > lead ? "w" : "b";
  return w <= b ? "w" : "b";
}
/** Spots the better ink still fails, at 4.5:1 or the given ratio. */
const fewest = (grounds: RGB[], min = 4.5) => {
  let w = 0, b = 0;
  for (const g of grounds) {
    const l = lum(g);
    if (1.05 / (l + 0.05) < min) w++;
    if ((l + 0.05) / 0.05 < min) b++;
  }
  return Math.min(w, b);
};

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
const N = 128; // 24, then 48: a thin dark strip in a photo (a shadow the links sat on, MAC) blurred into the bright ground around it
const thumbs = new WeakMap<Element, { at: number; src: string; data: Uint8ClampedArray | null }>();
/* A canvas of its own each time: a photo from a host that does not allow reading taints the canvas it is drawn
   on for good, and on the shared one every later read threw (a preview serves its photos from the live host). */
function read(src: CanvasImageSource): Uint8ClampedArray | null {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const x = c.getContext("2d");
    if (!x) return null;
    x.imageSmoothingQuality = "high"; // an average of the pixels, not every nth one
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
/** A same-host copy by photo address: null while it loads, false when it cannot be had. */
const copies = new Map<string, Uint8ClampedArray | null | false>();
/** Set by the last `pixel`: the photo is there but its pixels are not known yet (still loading, or its copy is). */
let pending = false;
/** True once a photo needed a same-host copy (a preview; the live site reads its own photos): the header then asks ahead. */
let copied = false;
function thumb(el: HTMLImageElement | HTMLVideoElement): Uint8ClampedArray | null {
  const film = el instanceof HTMLVideoElement, src = el.currentSrc || el.src, now = performance.now();
  const had = thumbs.get(el);
  if (had && had.src === src && (!film || now - had.at < 400)) {
    pending = !had.data && copies.get(src) === null;
    return had.data ?? (copies.get(src) || null);
  }
  // not all there yet: drawn now it would read as black, and that would be kept (the load event looks again)
  if (!film && !el.complete) {
    pending = true;
    return null;
  }
  const data = foreign(src, el) ? null : read(el);
  thumbs.set(el, { at: now, src, data });
  if (data || film) return data;
  /* Unreadable: the same file from this host, without the resizer (`/cdn-cgi/image/<options>/<path>` on another
     host becomes `/<path>` here). Asked for once; the word keeps its ink until it lands. */
  const m = /^https?:\/\/[^/]+\/cdn-cgi\/image\/[^/]+\/(.+)$/.exec(src);
  if (m && !copies.has(src)) {
    copied = true;
    copies.set(src, null);
    const im = new Image();
    im.src = "/" + m[1];
    // decoded off the main thread first: the copy is the full-size original, and drawing it undecoded took the
    // frame (MAC, previews: 218 to 311ms frames on the first pass as new photos came under the bar)
    im.decode().then(() => (copies.set(src, read(im) ?? false), poke()), () => copies.set(src, false));
  }
  pending = copies.get(src) === null;
  return copies.get(src) || null;
}

/* Where a photo is painted. The v4 hero's columns sit 48 and 80px forward under `.mt-stage`'s perspective. Chromium
   and Firefox paint them in perspective and report the box that way. WebKit paints them flat: on Windows it reports
   the flat box too, on a Mac it reports the projected one, so a look read a row of the photo 30px off the one under
   the word (MAC, 2026-11-16: black words at 1.2:1). Asking what is at a point does not help, on a Mac that follows
   the report. So in WebKit a box that comes back scaled by the perspective is put back: flat = O + (reported - O) / S,
   O the perspective origin. Kept for one look, as `seen` is. */
const boxes = new Map<Element, { left: number; top: number; width: number; height: number }>();
const webkit = () => navigator.vendor.startsWith("Apple");
/** The perspectives a box was put back from: each stage and the scales under it. Safari's answer to "what is at this
    point" follows the reported box too, so `under` also asks at the point each of these would report (MAC: at 1180
    a photo whose painted bottom edge is 15px under the words was never found, white words at 1.75:1).
    shortcut: a scale is only known once a photo at that depth was looked at, which the top of the hero does. */
const stages = new Map<Element, Set<number>>();
function hits(x: number, y: number) {
  const list = document.elementsFromPoint(x, y);
  for (const [stage, scales] of stages) {
    if (!stage.isConnected) {
      stages.delete(stage);
      continue;
    }
    const sr = stage.getBoundingClientRect(), o = getComputedStyle(stage).perspectiveOrigin.split(" ").map(parseFloat);
    const ox = sr.left + o[0], oy = sr.top + o[1];
    // photos only, ahead of the rest: `pixel` drops the ones whose painted box does not hold the point
    for (const S of scales) list.unshift(...document.elementsFromPoint(ox + (x - ox) * S, oy + (y - oy) * S).filter((e) => e instanceof HTMLImageElement && !list.includes(e)));
  }
  return list;
}
function box(el: HTMLElement) {
  const had = boxes.get(el);
  if (had) return had;
  const g = el.getBoundingClientRect();
  let r = { left: g.left, top: g.top, width: g.width, height: g.height };
  if (webkit() && el.offsetHeight) {
    let z = 0, persp = 0, stage: Element | null = null;
    for (let n: Element | null = el; n && n !== document.body && !persp; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (n !== el && cs.perspective !== "none") (persp = parseFloat(cs.perspective)), (stage = n);
      else {
        const t = cs.translate.split(" ");
        if (t.length === 3) z += parseFloat(t[2]) || 0;
        const m = /^matrix3d\((.+)\)$/.exec(cs.transform);
        if (m) z += parseFloat(m[1].split(",")[14]) || 0;
      }
    }
    const S = stage && z && z < persp ? persp / (persp - z) : 1, k = g.height / el.offsetHeight;
    // reported in perspective: the box is S times its laid-out height, not 1
    if (stage && Math.abs(S - 1) > 0.005 && Math.abs(k - S) < Math.abs(k - 1)) {
      const sr = stage.getBoundingClientRect(), o = getComputedStyle(stage).perspectiveOrigin.split(" ").map(parseFloat);
      const ox = sr.left + o[0], oy = sr.top + o[1];
      (stages.get(stage) ?? stages.set(stage, new Set()).get(stage)!).add(S);
      r = { left: ox + (g.left - ox) / S, top: oy + (g.top - oy) / S, width: g.width / S, height: g.height / S };
    }
  }
  boxes.set(el, r);
  return r;
}

/** The colour of a photo or film at a point on screen, through its object-fit and object-position: the mean, in
    light, of the patch `hw` by `hh` either side of the point (the stretch of a word it stands for). */
function pixel(el: HTMLImageElement | HTMLVideoElement, x: number, y: number, hw = 0, hh = 0): RGB | null {
  const nw = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth, nh = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
  pending = false;
  if (!nw || !nh) {
    pending = el instanceof HTMLImageElement && !!(el.currentSrc || el.src); // an image that has not arrived
    return null;
  }
  const data = thumb(el);
  if (!data) return null;
  const r = box(el), cs = getComputedStyle(el);
  // the photo's own box on screen: the element's, or the fitted picture inside it
  let left = r.left, top = r.top, w = r.width, h = r.height;
  if (cs.objectFit === "cover" || cs.objectFit === "contain") {
    const s = cs.objectFit === "cover" ? Math.max(r.width / nw, r.height / nh) : Math.min(r.width / nw, r.height / nh);
    const [px, py] = cs.objectPosition.split(" ").map((p) => (p.endsWith("%") ? parseFloat(p) / 100 : 0.5));
    w = nw * s;
    h = nh * s;
    left = r.left + (r.width - w) * (px ?? 0.5);
    top = r.top + (r.height - h) * (py ?? 0.5);
  }
  const u = (x - left) / w, v = (y - top) / h;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  const cell = (t: number) => Math.min(N - 1, Math.max(0, Math.floor(t * N)));
  const i0 = cell((x - hw - left) / w), i1 = cell((x + hw - left) / w), j0 = cell((y - hh - top) / h), j1 = cell((y + hh - top) / h);
  // at most 8 by 8 cells of the patch
  const di = Math.max(1, Math.ceil((i1 - i0 + 1) / 8)), dj = Math.max(1, Math.ceil((j1 - j0 + 1) / 8));
  let R = 0, G = 0, B = 0, k = 0;
  for (let j = j0; j <= j1; j += dj)
    for (let i = i0; i <= i1; i += di) {
      const q = (j * N + i) * 4;
      R += lin(data[q]);
      G += lin(data[q + 1]);
      B += lin(data[q + 2]);
      k++;
    }
  return [unlin(R / k), unlin(G / k), unlin(B / k)];
}

/** `?navdbg`: what each look saw, for `window.__navink()` (MAC reads words under 3:1 that pass on Windows). Null otherwise. */
let dbg: unknown[] | null = null;
/** Each photo's strength, kept for one look (cleared at the start of the next). */
const seen = new Map<Element, number>();
/** Filled by `under`: the same thing's colour at another height of the same column, or null where it does not reach. */
type Hit = { at?: (y: number) => RGB | null; unknown?: boolean };
/** What shows at a point, under the header: the first photo, film or painted box from the top. */
function under(x: number, y: number, hdr: HTMLElement, page: RGB, hit?: Hit, hw = 0, hh = 0): RGB {
  const list = hits(x, y);
  for (const el of list) {
    if (hdr.contains(el)) continue;
    /* A photo's own frame (the .ph tile behind a portfolio or /book image) can come first in the list, through a
       pseudo-element of its own, though its photo is drawn over it: its dark tile is not the ground there (MAC SSH,
       #1431: /book's bright hero read as near black, so the frost never came up and "Book a session" sat at 3.7:1).
       Only while that photo's pixels can be read: until then the tile is what shows, and the safer guess. */
    if (
      !(el instanceof HTMLImageElement || el instanceof HTMLVideoElement) &&
      list.some((o) => o !== el && el.contains(o) && (o instanceof HTMLImageElement || o instanceof HTMLVideoElement) && getComputedStyle(o).visibility !== "hidden" && pixel(o, x, y, hw, hh))
    )
      continue;
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
      const p = pixel(el, x, y, hw, hh);
      dbg?.push({ x: Math.round(x), y: Math.round(y), img: (el instanceof HTMLImageElement ? el.currentSrc || el.src : "video").slice(-48), complete: el instanceof HTMLImageElement ? el.complete : true, o: +o.toFixed(2), copy: copies.has((el as HTMLImageElement).currentSrc) ? (copies.get((el as HTMLImageElement).currentSrc) ? "in" : copies.get((el as HTMLImageElement).currentSrc) === null ? "loading" : "failed") : "none", rgb: p?.map(Math.round) ?? null, pending, box: Object.values(box(el)).map(Math.round), rect: (({ left, top, width, height }) => [left, top, width, height].map(Math.round))(el.getBoundingClientRect()) });
      if (p) {
        const s = o, mix = (q: RGB) => (s > 0.97 ? q : (q.map((v, i) => v * s + page[i] * (1 - s)) as RGB));
        if (hit) {
          const r = box(el);
          hit.at = (yy) => {
            const q = yy < r.top || yy > r.top + r.height ? null : pixel(el, x, yy, hw, hh);
            return q && mix(q);
          };
        }
        return mix(p);
      }
      // a photo is there and its pixels are on their way: what is behind it (its dark tile) is not the ground
      if (pending && hit) hit.unknown = true;
      continue;
    }
    const [c, a] = colour(getComputedStyle(el).backgroundColor);
    if (a > 0.5) dbg?.push({ x: Math.round(x), y: Math.round(y), box: (el.className?.toString() || el.tagName).slice(0, 40), rgb: c.map(Math.round) });
    if (a > 0.5) {
      if (hit) {
        const r = el.getBoundingClientRect();
        hit.at = (yy) => (yy < r.top || yy > r.bottom ? null : c);
      }
      return c;
    }
  }
  return page;
}

const WORDS = ".site-wm,.links a,.tbtn,.menu-btn,.hslot";

export function useNavInk(hdr: React.RefObject<HTMLElement | null>, path: string) {
  React.useEffect(() => {
    const bar = hdr.current, root = document.documentElement;
    if (!bar || !navfx()) return;
    let raf = 0, timer = 0, last = 0, frostT = 0, inkAt = 0, lastY = scrollY, down = false;
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
      boxes.clear();
      const isTop = top();
      root.toggleAttribute("data-navtop", isTop);
      // The v4 home: the bar's wordmark waits until the hero's big name has gone, faded by hero.ts
      // or scrolled under the bar, so the name never shows twice. navfx.css hides it until this is set.
      const nm = path === "/" ? document.querySelector<HTMLElement>(".mt-name h1") : null;
      const nr = nm?.getBoundingClientRect();
      const blk = nm?.closest<HTMLElement>("[data-mt-name]");
      // only once the name is fully gone, so the two never show together: faded out, hidden by hero.ts at the end
      // of its exit, or wholly out of the window:
      // on phones it scrolls up through the bar, and the wordmark came on while it was still passing under it (MAC)
      // The whole block, tagline and buttons too, and 80px clear of the top: on an iPhone a ghost of the name still
      // showed behind the status bar when the wordmark came on, and Inquire then rose through it (MAC, sim).
      const br = blk?.getBoundingClientRect() ?? nr;
      const shows = !!br && br.bottom > -80 && br.top < innerHeight && blk?.style.visibility !== "hidden" && parseFloat(blk?.style.opacity || "1") > 0.02;
      root.toggleAttribute("data-navnamegone", !shows);
      // A section that is dark in both themes (the v4 footer sets its own --bg) under a light page: the bar takes
      // the dark ground there (navfx.css), or its light veil over it would be a mid grey nothing reads on.
      const [rootBg] = colour(getComputedStyle(root).getPropertyValue("--bg").trim());
      const sec = document.elementsFromPoint(innerWidth / 2, bar.getBoundingClientRect().bottom - 1).find((el) => !bar.contains(el));
      const [secBg] = sec ? colour(getComputedStyle(sec).getPropertyValue("--bg").trim()) : [rootBg];
      root.toggleAttribute("data-navdark", lum(rootBg) > 0.2 && lum(secBg) < 0.2);
      const [page] = colour(getComputedStyle(bar).getPropertyValue("--bg").trim());
      /* Over the home hero the bar has no ground, and no one ink reads on every photo: the ground comes up there
         while a word would fall under 4.5:1 without it (Julian picked "frost" from the prototype, 2026-11-22). */
      /* The frost stays on past the hero once it is up (a "carry"): dropping it where the hero ends brought the bar's
         own ground back in from transparent and handed the ink back to the photos, so it went white, black, white with
         the wordmark and menu apart (MAC, iPhone dark, #1417). It goes only near the top of the page (below). */
      const frosted = bar.getAttribute("data-navfrost") === ""; // "off" is the frost fading out
      if (scrollY !== lastY) {
        down = scrollY > lastY;
        lastY = scrollY;
      }
      const veiled = (!isTop && !root.hasAttribute("data-tuck")) || frosted;
      // One ink for the whole bar: no word on its own, all of them fade to the other colour together.
      // Each word still looks under itself in stretches; the stretches vote.
      const votes = { w: 0, n: 0, els: [] as HTMLElement[] };
      const grounds: RGB[] = [], raw: RGB[] = []; // what each stretch stands on, through the veil and without it
      const own = new Map<HTMLElement, RGB[]>(); // each word's own grounds
      for (const el of bar.querySelectorAll<HTMLElement>(WORDS)) {
        // an icon button is judged by its icon, not its 32px box: half the box can be on a photo the icon is clear of (MAC: the theme icon)
        const r = ((el.matches(".tbtn,.menu-btn") && el.querySelector("svg")) || el).getBoundingClientRect();
        if (!r.width || r.bottom < 0) continue;
        // a word that is not showing has no say (the v4 home hides the wordmark while the hero's name shows)
        if (+getComputedStyle(el).opacity < 0.1) continue;
        const mine: RGB[] = [];
        own.set(el, mine);
        /* One ink per stretch of about 16px, so a word that sits half on a photo and half on the page is white
           on one and black on the other (QA: "Ju" white on light grey). And one for the upper half and one for the
           lower: a photo's top or bottom edge can run through a word (MAC: the wordmark white, 1.2:1, with only its
           lower half on a photo; the one look along the middle line called the whole word). A stretch keeps its
           ink unless the other is clearly better, so it does not flicker on a busy photo, but never below 3:1.
           `data-inks` is the upper row, a slash, the lower row. */
        const n = Math.max(1, Math.round(r.width / 16));
        const ya = r.top + r.height * 0.25, yb = r.top + r.height * 0.75; // the middle of each half
        const prev = el.dataset.inks ?? "";
        const [pa = "", pb = ""] = prev.split("/");
        dbg?.push({ word: el.textContent?.trim().slice(0, 12) || el.className, prev, isTop, veiled });
        const pick = (g: RGB, was: string, unknown?: boolean) => {
          if (unknown && was) return was; // the photo's pixels are not in yet: keep the ink until they are
          const c = veiled ? ([0, 1, 2].map((i) => g[i] * (1 - VEIL) + page[i] * VEIL) as RGB) : g;
          if (!unknown) grounds.push(c), raw.push(g), mine.push(c);
          const l = lum(c), white = 1.05 / (l + 0.05), black = (l + 0.05) / 0.05;
          return was === "w" && white >= 3 && white * 1.25 >= black ? "w" : was === "b" && black >= 3 && black * 1.25 >= white ? "b" : white >= black ? "w" : "b";
        };
        let ra = "", rb = "";
        for (let k = 0; k < n; k++) {
          const x = r.left + (r.width * (k + 0.5)) / n, hit: Hit = {}, low: Hit = {};
          const hw = r.width / n / 2, hh = r.height / 4; // the patch each look stands for: one stretch, half the height
          const ca = under(x, ya, bar, page, hit, hw, hh);
          // the lower half is usually on the same photo or box: a second look only where that one ends
          const cb = hit.at?.(yb) ?? under(x, yb, bar, page, low, hw, hh);
          ra += pick(ca, pa.length === n ? pa[k] : "", hit.unknown);
          rb += pick(cb, pb.length === n ? pb[k] : "", hit.at ? false : low.unknown || hit.unknown);
        }
        const inks = ra + "/" + rb;
        el.dataset.inks = inks;
        votes.w += inks.split("w").length - 1;
        votes.n += 2 * n;
        votes.els.push(el);
      }
      if (votes.n) {
        // the one ink that fails the fewest spots (`barInk`); while every photo under the bar is loading, the stretches vote (60% to flip)
        const was = bar.getAttribute("data-ink"), share = votes.w / votes.n;
        const voted = was === "w" ? (share >= 0.4 ? "w" : "b") : was === "b" ? (share <= 0.6 ? "b" : "w") : share >= 0.5 ? "w" : "b";
        /* Under the frost the ink is the frost's own: dark on a light page, light on a dark one, so it never sits white
           on light frost (MAC, Safari 1440). Elsewhere the ink that fails fewest; held 300ms, so it does not flip for a
           few frames on a busy photo (MAC, iPhone). */
        /* Under the frost the theme's ink, fixed and never sampled: the frost is a 62% veil of the page colour, so black
           on it (light) or white on it (dark) holds at least 6:1 over any photo, and both words always share it (MAC). */
        const themeInk = root.dataset.theme === "light" ? "b" : "w";
        const pick = frosted ? themeInk : grounds.length ? barInk(grounds, was) : voted;
        const now = performance.now();
        const ink = was && pick !== was && !frosted && now - inkAt < 300 ? was : pick;
        if (ink !== was) inkAt = now;
        bar.setAttribute("data-ink", ink);
        // the ground comes up over the hero while the bar's ink fails anywhere without it, and goes once it would not
        /* On at once for any spot that fails, and then it stays for the rest of the hero: switched as each look found it,
           it flashed on and off across the masonry (MAC, iPhone, #1417). It goes only back near the top of the page,
           after 1.2s with nothing failing, faded (navfx.css). */
        // at 6:1, a margin over 4.5, so it is up before a word actually fails (MAC: a word on the wrong photo for 0.13s first)
        /* Pre-roll: while scrolling down, also look a little below the bar, at what is about to come under the words, so
           the frost is in before a word sits on the wrong photo (MAC: the menu on a dark figure for 0.3s before the fade).
           Only on the way down, so a page at rest at its top keeps no frost. */
        const ahead: RGB[] = [];
        if (down && !frosted && (isTop || veiled)) {
          const bb = bar.getBoundingClientRect().bottom;
          for (const el of votes.els) {
            const r = ((el.matches(".tbtn,.menu-btn") && el.querySelector("svg")) || el).getBoundingClientRect();
            for (const t of [0.15, 0.5, 0.85])
              for (const dy of [28, 64]) {
                const g = under(r.left + r.width * t, bb + dy, bar, page);
                ahead.push(isTop ? g : ([0, 1, 2].map((i) => g[i] * (1 - VEIL) + page[i] * VEIL) as RGB));
              }
          }
        }
        /* Every page, not only the home hero (MAC SSH, live v3.0.369: /portfolio/paradox at 1440 had 18 words under 4.5:1
           through the bar's usual 47% ground, and dark /book at 390 a black menu at 3.3:1 over its bright hero). Past the
           top, the bar already has that ground, so a word is judged through it: where it would still fall under 6:1, the
           frost comes up there too and the ink becomes the theme's. A plain page ground never fails, so it never shows there. */
        /* Past the top the bar's blur (24px) and saturate (1.8) pull light in from around each point, so the ground as drawn
           can sit well above the one a look samples: judged there at 7.5:1, not 6 (MAC SSH, a4e718dd: words at 4.0 just
           past the top of a project page, and /book's current link at 3.7). The look ahead reaches 64px below the bar. */
        const fails = isTop ? (raw.length ? fewest(raw.concat(ahead), 6) : 0) : veiled && !frosted && grounds.length ? fewest(grounds.concat(ahead), 7.5) : 0;
        if (!isTop) {
          // past the top: comes up where a word fails through the usual ground, and once up it stays, ink fixed
          clearTimeout(frostT);
          frostT = 0;
          if (fails || bar.getAttribute("data-navfrost") === "off") bar.setAttribute("data-navfrost", "");
        } else if (fails) {
          clearTimeout(frostT);
          frostT = 0;
          if (bar.getAttribute("data-navfrost") !== "") bar.setAttribute("data-navfrost", "");
        } else if (bar.getAttribute("data-navfrost") === "" && !frostT && scrollY < innerHeight / 4)
          frostT = window.setTimeout(() => {
            bar.setAttribute("data-navfrost", "off");
            frostT = window.setTimeout(() => {
              frostT = 0;
              if (bar.getAttribute("data-navfrost") === "off") bar.removeAttribute("data-navfrost");
            }, 300);
          }, 1200);
        for (const el of votes.els) {
          // this word's worst contrast as drawn, for QA (`data-cr`)
          const g = own.get(el) ?? [];
          el.dataset.cr = g.length ? Math.min(...g.map((c) => (ink === "w" ? 1.05 / (lum(c) + 0.05) : (lum(c) + 0.05) / 0.05))).toFixed(1) : "";
          if (el.dataset.ink === ink) continue;
          el.dataset.ink = ink;
          el.style.setProperty("--nav-ink", ink === "w" ? "#fff" : "#000"); // navfx.css fades the colour
        }
      }
    };
    if (/[?&]navdbg/.test(location.search)) (window as unknown as { __navink: () => unknown[] }).__navink = () => ((dbg = []), paint(), [dbg, (dbg = null)][0] as unknown[]);
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
    // On a preview, where photos need a same-host copy: ask for the ones near the window before they reach the bar.
    const ahead = () => {
      if (!copied) return;
      for (const im of document.querySelectorAll<HTMLImageElement>("#main img")) {
        const q = im.getBoundingClientRect();
        if (q.width && q.bottom > -innerHeight / 2 && q.top < innerHeight * 2) thumb(im);
      }
    };
    const again = window.setInterval(() => document.hidden || (ask(), scan(), kick(), ahead()), 500);
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
      clearTimeout(frostT);
      bar.removeAttribute("data-navfrost");
      clearInterval(again);
      poke = () => {};
      cancelAnimationFrame(raf);
      root.removeAttribute("data-navtop");
      root.removeAttribute("data-navdark");
      root.removeAttribute("data-navnamegone");
    };
  }, [hdr, path]);
}

/* For words that sit on the page with no ground of their own (Cover art's sound line,
   components/cover/cover-sound.tsx): the same measure as the bar's, one ink for the whole word. */

/** The page colour for `inkWord`, from any CSS colour. */
export const inkGround = (css: string): RGB => colour(css)[0];

/** White or black for one word, whichever reads better over what shows under it: `data-ink` ("w" / "b") and
    `--nav-ink` are set on it. `skip` is what holds the word, `page` what shows where nothing is painted.
    Never throws: a look that fails leaves the word the ink it had. */
export function inkWord(el: HTMLElement, skip: HTMLElement, page: RGB) {
  try {
    const r = el.getBoundingClientRect();
    if (!r.width || r.bottom < 0) return;
    seen.clear();
    // Five points along the word, and the middle one by brightness, so a few pixels over a gutter do not decide it.
    const ls = [0.1, 0.3, 0.5, 0.7, 0.9].map((t) => lum(under(r.left + r.width * t, r.top + r.height / 2, skip, page))).sort((a, b) => a - b);
    const white = 1.05 / (ls[2] + 0.05), black = (ls[2] + 0.05) / 0.05;
    const was = el.dataset.ink;
    // Keep the ink it has unless the other one is clearly better, so a word does not flicker on a busy photo.
    const ink = was === "w" && white * 1.25 >= black ? "w" : was === "b" && black * 1.25 >= white ? "b" : white >= black ? "w" : "b";
    if (ink !== was) {
      el.dataset.ink = ink;
      el.style.setProperty("--nav-ink", ink === "w" ? "#fff" : "#000");
    }
  } catch {}
}
