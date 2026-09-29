"use client";

import * as React from "react";

/* ── pictures arrive, they do not pop ─────────────────────────────
 * A lazily loaded photograph used to appear the instant its bytes did: one
 * frame the placeholder colour, the next the picture. Every `<img
 * data-fade>` now starts transparent and fades up over 480ms once it has
 * loaded — see the rule in `globals.css`.
 *
 * "Once it has loaded" is the one thing CSS cannot know, so this listens
 * for `load` on the document in the capture phase (image load events do
 * not bubble) and marks the element. Pictures that were already complete
 * when the listener arrived — from cache, or decoded before hydration — are
 * swept on mount so they are never left invisible.
 *
 * Not on anything above the fold: a picture that is the largest paint on
 * the page must not spend 480ms invisible, so those are left without the
 * attribute and appear as they always did.
 * ─────────────────────────────────────────────────────────────── */

const LOADED = "data-loaded";

/* ── the pixel load ──
   Julian: pictures past the hero load in pixels (after img-fx, which froze
   the page and is gone). Every photograph past the hero, which carries no
   `data-fade`, arrives as a few big blocks and sharpens in steps, then the
   real picture fades up over the last of them. A canvas a few dozen cells wide, drawn four times and
   thrown away, so there is nothing to run once it has landed. */
const STEPS = [16, 32, 64, 128]; // columns at each step (Julian: start smaller)
const STEP_MS = 90;

function pixelIn(img: HTMLImageElement, done: () => void) {
  const bw = img.clientWidth;
  const bh = img.clientHeight;
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (bw < 80 || bh < 80 || !nw || !img.parentElement) return done();
  // Where the picture sits in its box, as `object-fit: cover` puts it.
  const k = Math.max(bw / nw, bh / nh);
  const [px, py] = getComputedStyle(img)
    .objectPosition.split(" ")
    .map((v) => (v.endsWith("%") ? parseFloat(v) / 100 : 0.5));
  // One small copy to sample from, so each step averages rather than picks.
  // Decoded and shrunk off the main thread, from the bytes: drawing the
  // photograph itself, or making the bitmap from the element, decoded it on
  // the spot, 50 to 60ms of a scroll frame per picture coming into view on
  // Portfolio. The bytes are already in the cache.
  const cols = STEPS[STEPS.length - 1];
  const rows = Math.max(1, Math.round((cols * bh) / bw));
  const sw = bw / k;
  const sh = bh / k;
  fetch(img.currentSrc || img.src)
    .then((r) => r.blob())
    .then((blob) =>
      createImageBitmap(blob, (nw - sw) * px, (nh - sh) * py, sw, sh, {
        resizeWidth: cols,
        resizeHeight: rows,
        resizeQuality: "high",
      }),
    )
    .then((base) => run(img, base, bw, bh, done), done);
}

function run(
  img: HTMLImageElement,
  base: ImageBitmap,
  bw: number,
  bh: number,
  done: () => void,
) {
  const canvas = document.createElement("canvas");
  const c = canvas.getContext("2d");
  if (!c || !img.parentElement) return done();
  canvas.setAttribute("aria-hidden", "");
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;pointer-events:none";
  // Under the picture, so the picture fades up over it.
  img.parentElement.insertBefore(canvas, img);
  let n = 0;
  const step = () => {
    const w = STEPS[n];
    canvas.width = w;
    canvas.height = Math.max(1, Math.round((w * bh) / bw));
    c.imageSmoothingEnabled = true;
    c.drawImage(base, 0, 0, canvas.width, canvas.height);
    if (++n < STEPS.length) window.setTimeout(step, STEP_MS);
    else {
      done();
      base.close();
      window.setTimeout(() => canvas.remove(), 600);
    }
  };
  step();
}

export function PhotoFade() {
  React.useEffect(() => {
    const calm = matchMedia("(prefers-reduced-motion: reduce)");
    const mark = (img: HTMLImageElement) => {
      if (img.hasAttribute(LOADED)) return;
      const show = () => img.setAttribute(LOADED, "");
      if (calm.matches) return show();
      /* When it comes into view, not when it loads: the strip loads a
         screen or two ahead, and the pixels ran where nobody was. */
      seen.observe(img);
    };
    const seen = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          seen.unobserve(e.target);
          const img = e.target as HTMLImageElement;
          if (img.dataset.pixel !== undefined) return;
          img.dataset.pixel = "";
          pixelIn(img, () => img.setAttribute(LOADED, ""));
        }),
      { threshold: 0.15 },
    );
    const onLoad = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLImageElement && t.hasAttribute("data-fade")) mark(t);
    };
    document.addEventListener("load", onLoad, true);
    const sweep = () =>
      document
        .querySelectorAll<HTMLImageElement>("img[data-fade]")
        .forEach((img) => img.complete && img.naturalWidth > 0 && mark(img));
    sweep();
    // Client-side navigation mounts new pictures without a load event
    // reaching a listener that was attached earlier — some are cached and
    // complete before React commits them. Sweep again after each commit.
    const mo = new MutationObserver(sweep);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("load", onLoad, true);
      mo.disconnect();
      seen.disconnect();
    };
  }, []);
  return null;
}
