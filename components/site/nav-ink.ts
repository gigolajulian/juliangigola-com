"use client";

/* White or black for a word, whichever reads better over what is under it (photo, film or page).
   Pixels come from a small copy of each photo, made once. Used by Cover art's sound line. */

type RGB = [number, number, number];
const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const unlin = (v: number) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

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
/** A same-host copy by photo address: null while it loads, false when it cannot be had. */
const copies = new Map<string, Uint8ClampedArray | null | false>();
/** Set by the last `pixel`: the photo is there but its pixels are not known yet (still loading, or its copy is). */
let pending = false;
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
    copies.set(src, null);
    const im = new Image();
    im.src = "/" + m[1];
    // decoded off the main thread first: the copy is the full-size original, and drawing it undecoded took the
    // frame (MAC, previews: 218 to 311ms frames on the first pass as new photos came under the bar)
    im.decode().then(() => copies.set(src, read(im) ?? false), () => copies.set(src, false));
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

/** Each photo's strength, kept for one look (cleared at the start of the next). */
const seen = new Map<Element, number>();
/** Filled by `under`: the same thing's colour at another height of the same column, or null where it does not reach. */
type Hit = { at?: (y: number) => RGB | null; unknown?: boolean };
/** What shows at a point, under the header: the first photo, film or painted box from the top. */
function under(x: number, y: number, hdr: HTMLElement, page: RGB, hit?: Hit, hw = 0, hh = 0): RGB {
  for (const el of hits(x, y)) {
    if (hdr.contains(el)) continue;
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
