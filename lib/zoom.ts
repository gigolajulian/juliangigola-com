/* ── the zoom ─────────────────────────────────────────────────────
 * One picture moves. A thumbnail grows into the viewer and the viewer's
 * picture shrinks back into whichever thumbnail it now belongs to; there
 * is never a second picture cross fading over the first.
 *
 * Two engines behind one face. Where the browser has the View Transitions
 * API the name `zoom-picture` travels from the thumbnail to the viewer's
 * picture and the browser draws the trip; only the two pictures are
 * snapshotted, never the page (the root is named `none` for the length of
 * it), which is what keeps the first frame cheap. Elsewhere the trip is
 * FLIP: the viewer mounts, both boxes are measured, the viewer's box is
 * put where the thumbnail was with one transform and played to identity
 * with the Web Animations API. Both engines use the same numbers below, so
 * they look the same.
 *
 * No framework in here. Callers hand in elements and two callbacks, one
 * that mounts the viewer and one that unmounts it.
 * ─────────────────────────────────────────────────────────────── */

/** Opening: how long, and on what curve. */
export const OPEN_MS = 420;
export const OPEN_EASE = "cubic-bezier(0.2, 0, 0, 1)";
/** Closing. */
export const CLOSE_MS = 320;
export const CLOSE_EASE = "cubic-bezier(0.3, 0, 0.2, 1)";
/** The backdrop: quicker in and slower out, so the picture leads it. */
export const BACKDROP_IN_MS = 200;
export const BACKDROP_OUT_MS = 280;
/** The chrome (close, caption, counter) comes up this long after the
    picture lands, and goes at once on close. */
export const CHROME_DELAY_MS = 80;
export const CHROME_MS = 160;
/** With reduced motion: a plain cross fade, no scale. */
export const REDUCED_MS = 150;
/** How long a press waits for the full picture to decode before the trip
    starts without it. */
export const DECODE_CAP_MS = 250;

export const NAME = "zoom-picture";
/* Which engine draws the trip where the browser offers both.
   Measured on Chrome 140: with the page snapshotted, the browser's engine
   spent about 105ms of GPU time rasterising the page for the first frame
   of every open (the stall Julian saw); with only the pictures snapshotted
   (`view-transition-name: none` on the root) Chrome composited the moving
   picture over a second, larger ghost of itself for the first frames, and
   the live viewer under the pseudo tree could not be hidden without
   blanking the capture. The FLIP engine has neither problem and looks the
   same, so it is the one that runs. "vt" is kept for trying again on a
   later browser. */
export const ENGINE = "flip" as "flip" | "vt";

type Rect = { left: number; top: number; width: number; height: number };

export type ZoomTrip = {
  finished: Promise<void>;
  /** Stops the trip where it is and says where the picture is right now,
      so a close can start from there rather than from the end. */
  interrupt: () => Rect | null;
};

/** Found after the viewer mounts, so these are looked up, not handed in. */
type Chrome = {
  backdrop?: () => HTMLElement | null;
  chrome?: () => HTMLElement[];
};

type OpenOptions = Chrome & {
  /** The thumbnail pressed. Null opens with a fade from the centre. */
  from: HTMLElement | null;
  /** Mounts the viewer, synchronously. */
  mount: () => void;
  /** After `mount`: the box the picture sits in (overflow hidden, the
      picture's own size) and the picture inside it. */
  box: () => HTMLElement | null;
  picture: () => HTMLImageElement | null;
  /** The thumbnail's corner radius in px, if it has one. Read off the
      element when omitted. */
  radius?: number;
};

type CloseOptions = Chrome & {
  box: HTMLElement | null;
  picture: HTMLImageElement | null;
  /** The thumbnail to land in. Scrolled into view first; null shrinks
      toward the middle of the window. */
  to: HTMLElement | null;
  unmount: () => void;
  /** Where the picture is now, when a drag or an interrupted open moved
      it off the box's own place. */
  startRect?: Rect | null;
  radius?: number;
};

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const hasVT = () =>
  ENGINE === "vt" &&
  typeof document !== "undefined" &&
  typeof document.startViewTransition === "function";

const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

const radiusOf = (el: HTMLElement | null, given?: number) => {
  if (given !== undefined) return given;
  if (!el) return 0;
  return parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
};

/* ── the matrix ──
   `transform-origin: top left` on both the box and the picture, and one
   matrix per element, so scale and translate are a single property.

   The box (overflow hidden, the viewer's size T) is put onto the
   thumbnail's rectangle F with `matrix(sx, 0, 0, sy, tx, ty)`: scale by
   F/T on each axis, then move its corner onto F's corner. That squashes
   the picture inside with it when the two shapes differ, so the picture
   is counter scaled: a thumbnail shows the picture at `object-fit: cover`,
   which is the uniform scale c = max(F.w/T.w, F.h/T.h) of the viewer's
   picture, centred. Inside a box already scaled by (sx, sy) the picture
   needs scale (c/sx, c/sy) and a translate of the centring offset divided
   by the box's scale, so that the composition of the two is exactly the
   thumbnail's rendering. At the far end both are identity. Corners: a
   radius r on the box after a scale of (sx, sy) is an ellipse, so the box
   carries r/sx by r/sy instead, which the scale turns back into r. */
function place(F: Rect, T: Rect) {
  const sx = F.width / T.width;
  const sy = F.height / T.height;
  const c = Math.max(sx, sy);
  const ox = (F.width - T.width * c) / 2;
  const oy = (F.height - T.height * c) / 2;
  return {
    box: `matrix(${sx}, 0, 0, ${sy}, ${F.left - T.left}, ${F.top - T.top})`,
    picture: `matrix(${c / sx}, 0, 0, ${c / sy}, ${ox / sx}, ${oy / sy})`,
    radius: (r: number) => `${r / sx}px / ${r / sy}px`,
  };
}

const ID = "matrix(1, 0, 0, 1, 0, 0)";

/** Where the picture shrinks to when nothing is left to land in. */
const centre = (T: Rect): Rect => ({
  left: T.left + T.width * 0.2,
  top: T.top + T.height * 0.2,
  width: T.width * 0.6,
  height: T.height * 0.6,
});

/* ── the stand-in ──
   The viewer's picture is a new file, and a picture that has not decoded
   is a blank frame. The thumbnail's own bitmap is copied on top of it for
   the trip and taken off once the real one is decoded, so what moves is
   what was already on the screen and the swap happens after the landing,
   on identical pixels. */
function standIn(box: HTMLElement, from: HTMLElement | null) {
  const src =
    from instanceof HTMLImageElement
      ? from
      : from?.querySelector<HTMLImageElement>("img");
  if (!src?.currentSrc) return null;
  const copy = document.createElement("img");
  copy.src = src.currentSrc;
  copy.alt = "";
  copy.decoding = "sync";
  copy.setAttribute("aria-hidden", "true");
  Object.assign(copy.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    objectFit: "contain",
    pointerEvents: "none",
  } as CSSStyleDeclaration);
  box.appendChild(copy);
  return copy;
}

/** The real picture, decoded, or the cap, whichever is first. */
const decoded = (img: HTMLImageElement | null) =>
  Promise.race([
    img ? img.decode().catch(() => {}) : Promise.resolve(),
    new Promise<void>((r) => window.setTimeout(r, DECODE_CAP_MS)),
  ]);

const fade = (
  el: HTMLElement | null | undefined,
  to: 0 | 1,
  ms: number,
  delay = 0,
) => {
  if (!el) return;
  el.getAnimations().forEach((a) => a.cancel());
  const from = getComputedStyle(el).opacity;
  el.style.opacity = String(to);
  el.animate([{ opacity: from }, { opacity: to }], {
    duration: ms,
    delay,
    easing: to ? "ease-out" : "ease-in",
    fill: "backwards",
  });
};

const promote = (els: (HTMLElement | null)[]) => {
  for (const el of els) if (el) el.style.willChange = "transform";
  return () => {
    for (const el of els) if (el) el.style.removeProperty("will-change");
  };
};

/* ── the view transition's rules ──
   Injected once. Only the picture is captured: the root is named `none`
   for the trip (`data-zoom` on the root), so the page and the viewer's
   own backdrop and chrome are live and run on their own curves below.
   One picture carries each trip, never two crossing. Going in it is the
   viewer's picture, `object-fit: cover` in the group's box: in the
   thumbnail's box that is exactly the thumbnail's own crop, and as the
   box takes the picture's shape the crop opens out, which is the
   counter scaling the FLIP engine does by hand. The thumbnail's snapshot
   sits on top for the first frames only, identical pixels, in case the
   full picture has not decoded yet. Coming out the viewer's picture (the
   old snapshot) carries the whole way and lands as the thumbnail's crop.
   The group is clipped and its corners run from the thumbnail's radius
   to square through `--zoom-radius`. */
let styled = false;
function style() {
  if (styled) return;
  styled = true;
  const s = document.createElement("style");
  s.textContent = `
:root[data-zoom] { view-transition-name: none; }
::view-transition-group(${NAME}) {
  animation-duration: var(--zoom-ms);
  animation-timing-function: var(--zoom-ease);
  overflow: hidden;
  border-radius: var(--zoom-radius-from, 0px);
  animation-name: -ua-view-transition-group-anim-${NAME}, zoom-corners;
}
::view-transition-image-pair(${NAME}) {
  animation: none;
  isolation: auto;
}
::view-transition-old(${NAME}), ::view-transition-new(${NAME}) {
  animation: none;
  mix-blend-mode: normal;
  block-size: 100%;
  inline-size: 100%;
  object-fit: cover;
}
:root[data-zoom="in"]::view-transition-old(${NAME}) {
  z-index: 1;
  animation: zoom-cover 120ms linear both;
}
:root[data-zoom="out"]::view-transition-new(${NAME}) { display: none; }
@keyframes zoom-cover { to { opacity: 0; } }
::view-transition { pointer-events: none; }
@keyframes zoom-corners {
  from { border-radius: var(--zoom-radius-from, 0px); }
  to { border-radius: var(--zoom-radius-to, 0px); }
}`;
  document.head.appendChild(s);
}

/* With the page not snapshotted, the page is live under the pseudo tree,
   and that includes the viewer's own picture, which would show through at
   its landing place for the whole trip. Its parent goes to opacity 0: an
   ancestor's opacity is not part of the element's own capture, so the
   snapshot the browser draws from it stays whole while the live one is
   unseen. Visibility would not do; it inherits, and the capture would be
   blank. */
function hideLive(box: HTMLElement | null) {
  const el = box?.parentElement;
  if (!el) return () => {};
  const had = el.style.opacity;
  el.style.opacity = "0";
  return () => {
    el.style.opacity = had;
  };
}

/* The group's rectangle right now, read off the pseudo element, for a
   close that interrupts an open the browser is drawing. */
function groupRect(): Rect | null {
  const cs = getComputedStyle(
    document.documentElement,
    `::view-transition-group(${NAME})`,
  );
  const w = parseFloat(cs.width);
  const h = parseFloat(cs.height);
  if (!w || !h) return null;
  const m = new DOMMatrix(cs.transform);
  return { left: m.e, top: m.f, width: w * m.a, height: h * m.d };
}

/* ── open ──────────────────────────────────────────────────────── */
export function zoomOpen(o: OpenOptions): ZoomTrip {
  const thumbRadius = radiusOf(o.from, o.radius);

  // Reduced motion: the viewer fades up over the page.
  if (reduced() || !o.from) {
    o.mount();
    const box = o.box();
    fade(box, 1, REDUCED_MS);
    fade(o.backdrop?.(), 1, REDUCED_MS);
    for (const c of o.chrome?.() ?? []) fade(c, 1, REDUCED_MS);
    return {
      finished: new Promise((r) => window.setTimeout(r, REDUCED_MS)),
      interrupt: () => (box ? rectOf(box) : null),
    };
  }

  const from = o.from;
  const F = rectOf(from);

  if (hasVT()) {
    style();
    const root = document.documentElement;
    root.dataset.zoom = "in";
    root.style.setProperty("--zoom-ms", `${OPEN_MS}ms`);
    root.style.setProperty("--zoom-ease", OPEN_EASE);
    root.style.setProperty("--zoom-radius-from", `${thumbRadius}px`);
    root.style.setProperty("--zoom-radius-to", "0px");
    from.style.viewTransitionName = NAME;
    let box: HTMLElement | null = null;
    let unpromote = () => {};
    let unhide = () => {};
    const t = document.startViewTransition(() => {
      o.mount();
      from.style.viewTransitionName = "";
      box = o.box();
      if (box) box.style.viewTransitionName = NAME;
      unpromote = promote([box]);
      unhide = hideLive(box);
      fade(o.backdrop?.(), 1, BACKDROP_IN_MS);
      for (const c of o.chrome?.() ?? [])
        fade(c, 1, CHROME_MS, OPEN_MS + CHROME_DELAY_MS);
    });
    const done = () => {
      delete root.dataset.zoom;
      if (box) box.style.viewTransitionName = "";
      unpromote();
      unhide();
    };
    // A skipped transition rejects `ready` too, which nobody awaits.
    t.ready.catch(() => {});
    const finished = t.finished.then(done, done);
    return {
      finished,
      interrupt: () => {
        const r = groupRect();
        t.skipTransition();
        return r;
      },
    };
  }

  // FLIP.
  o.mount();
  const box = o.box();
  const pic = o.picture();
  if (!box) return { finished: Promise.resolve(), interrupt: () => null };
  const T = rectOf(box);
  const at = place(F, T);
  const unpromote = promote([box, pic]);
  const copy = standIn(box, from);
  const removeStandIn = () => copy?.remove();
  const opts = { duration: OPEN_MS, easing: OPEN_EASE, fill: "both" as const };
  box.style.transformOrigin = "0 0";
  if (pic) pic.style.transformOrigin = "0 0";
  if (copy) copy.style.transformOrigin = "0 0";
  const a = box.animate(
    [
      { transform: at.box, borderRadius: at.radius(thumbRadius) },
      { transform: ID, borderRadius: "0px" },
    ],
    opts,
  );
  // The stand-in rides the same counter scale as the picture it covers,
  // or the box's own scale would squash it.
  const b = pic?.animate(
    [{ transform: at.picture }, { transform: ID }],
    opts,
  );
  const c = copy?.animate(
    [{ transform: at.picture }, { transform: ID }],
    opts,
  );
  fade(o.backdrop?.(), 1, BACKDROP_IN_MS);
  for (const c of o.chrome?.() ?? [])
    fade(c, 1, CHROME_MS, OPEN_MS + CHROME_DELAY_MS);
  const settle = async () => {
    await decoded(pic);
    removeStandIn();
    unpromote();
  };
  const finished = a.finished.then(settle, settle);
  return {
    finished,
    interrupt: () => {
      const r = rectOf(box);
      a.cancel();
      b?.cancel();
      c?.cancel();
      removeStandIn();
      unpromote();
      return r;
    },
  };
}

/* ── close ─────────────────────────────────────────────────────── */
export function zoomClose(o: CloseOptions): ZoomTrip {
  const box = o.box;
  const pic = o.picture;
  for (const c of o.chrome?.() ?? []) fade(c, 0, CHROME_MS / 2);
  fade(o.backdrop?.(), 0, BACKDROP_OUT_MS);

  if (!box || reduced()) {
    fade(box, 0, REDUCED_MS);
    const finished = new Promise<void>((r) =>
      window.setTimeout(() => {
        o.unmount();
        r();
      }, REDUCED_MS),
    );
    return { finished, interrupt: () => null };
  }

  /* The thumbnail to land in, brought on screen first. Instantly and
     behind the backdrop, so the page is where the picture is going before
     the picture goes there. */
  const to = o.to;
  if (to) to.scrollIntoView({ block: "nearest", inline: "nearest" });
  // A drag offset lives on an ancestor; it was measured into `startRect`
  // and is cleared before the box's own place is read, so the box alone
  // carries the position from here.
  for (let el = box.parentElement; el; el = el.parentElement) {
    if (el.style.transform) el.style.transform = "";
    if (el.style.opacity) el.style.opacity = "";
  }
  const T = rectOf(box);
  const start = o.startRect ?? T;
  const F = to ? rectOf(to) : centre(T);
  const r = radiusOf(to, o.radius);

  /* The browser's engine draws from the box's own place; a picture moved
     by a drag or an interrupted open is put back there with FLIP, which
     can start anywhere. */
  if (hasVT() && to && start === T) {
    style();
    const root = document.documentElement;
    root.dataset.zoom = "out";
    root.style.setProperty("--zoom-ms", `${CLOSE_MS}ms`);
    root.style.setProperty("--zoom-ease", CLOSE_EASE);
    root.style.setProperty("--zoom-radius-from", "0px");
    root.style.setProperty("--zoom-radius-to", `${r}px`);
    box.style.viewTransitionName = NAME;
    const t = document.startViewTransition(() => {
      o.unmount();
      to.style.viewTransitionName = NAME;
    });
    const done = () => {
      delete root.dataset.zoom;
      to.style.viewTransitionName = "";
    };
    // A skipped transition rejects `ready` too, which nobody awaits.
    t.ready.catch(() => {});
    const finished = t.finished.then(done, done);
    return {
      finished,
      interrupt: () => {
        const rect = groupRect();
        t.skipTransition();
        return rect;
      },
    };
  }

  // FLIP, from wherever the picture is now.
  const unpromote = promote([box, pic]);
  box.style.transformOrigin = "0 0";
  if (pic) pic.style.transformOrigin = "0 0";
  const here = place(start, T);
  const there = place(F, T);
  const opts = { duration: CLOSE_MS, easing: CLOSE_EASE, fill: "both" as const };
  box.getAnimations().forEach((a) => a.cancel());
  pic?.getAnimations().forEach((a) => a.cancel());
  const a = box.animate(
    [
      { transform: here.box, borderRadius: "0px", opacity: 1 },
      {
        transform: there.box,
        borderRadius: there.radius(r),
        opacity: to ? 1 : 0,
      },
    ],
    opts,
  );
  const b = pic?.animate(
    [{ transform: here.picture }, { transform: there.picture }],
    opts,
  );
  const done = () => {
    unpromote();
    o.unmount();
  };
  const finished = a.finished.then(done, done);
  return {
    finished,
    interrupt: () => {
      const rect = rectOf(box);
      a.cancel();
      b?.cancel();
      unpromote();
      return rect;
    },
  };
}

/* ── around the trip ───────────────────────────────────────────── */

/** The page does not scroll under an open viewer, and comes back to
    exactly where it was. */
export function lockScroll() {
  const x = window.scrollX;
  const y = window.scrollY;
  const root = document.documentElement;
  const had = root.style.overflow;
  root.style.overflow = "hidden";
  return () => {
    root.style.overflow = had;
    window.scrollTo(x, y);
  };
}

/** An entry in the history for the open viewer, so the back button (and a
    phone's back gesture) closes it the same way the close button does
    instead of leaving the page. Returns a function to call when the
    viewer closes by any other route, which takes the entry back off. */
export function pushHistory(onBack: () => void) {
  const key = `zoom:${Date.now()}`;
  /* The browser would put the page back where it was scrolled on the way
     back to the entry underneath, in the middle of a close that may have
     scrolled the thumbnail into view; scrolling is the viewer's business
     while its entry is live. The router's own state is kept on the entry
     so a pop to it is a plain restore. */
  const restoration = window.history.scrollRestoration;
  window.history.scrollRestoration = "manual";
  window.history.pushState({ ...(window.history.state ?? {}), zoom: key }, "");
  let live = true;
  const onPop = () => {
    if (!live) return;
    live = false;
    window.removeEventListener("popstate", onPop);
    window.history.scrollRestoration = restoration;
    onBack();
  };
  window.addEventListener("popstate", onPop);
  return () => {
    if (!live) return;
    live = false;
    window.removeEventListener("popstate", onPop);
    window.history.scrollRestoration = restoration;
    if ((window.history.state as { zoom?: string } | null)?.zoom === key)
      window.history.back();
  };
}
