import type { Deck } from "@/lib/deck";
import { nearestSeat } from "@/lib/motion/seat";
import {
  frameDt,
  launchSpeed,
  springSettled,
  stepSpring,
} from "@/lib/motion/spring";
import { dampingFor } from "@/lib/motion/throw";
import { leftOf } from "./shared";

/* ── how it moves ───────────────────────────────────────────────
   Every way of moving the strip writes to one target and a single rAF
   loop eases the scroller towards it. A wheel notch is ~100px of jump
   if it is applied straight to `scrollLeft`; eased instead, the same
   notch is a glide, and notches that arrive together blend into one
   movement rather than stacking into a jolt. Julian asked for the
   horizontal scroll to be super smooth and to allow drag to scroll.

   A drag is the exception: while a pointer is down the strip tracks it
   exactly, because anything eased there feels like the picture is
   lagging behind the hand. The easing comes back on release, as
   momentum - the strip carries on at the speed it was let go.

   Reduced motion gets the same controls with the interpolation off.

   This file is the travel itself: the loops that move the scroller and
   the state they share with the band (`band.ts`), the finger
   (`touch.ts`), the wheel (`wheel.ts`) and the rest (`use-motion.ts`). */

/* Momentum and friction, measured off the reference. Julian recorded
   remyshoots.co.za; read frame by frame, its strip's speed climbs while
   the wheel turns and then decays once it stops, running out over about
   two thirds of a second. That is velocity with friction: nothing
   chases a target, the strip simply has a speed. A spin is one
   continuous motion because the speed accumulates; a lone notch is a
   glide that tails off. Two earlier tries each felt wrong in their own
   way - a lerp trailed the hand by six frames, and an ease that
   restarted on every notch pulsed at the notch cadence.

   TAU is the friction: the time in which the speed falls to a third,
   and so also how far a speed carries (speed × TAU). It was swept
   against a steady spin rather than picked, because it trades two
   things off. The reference's own tail decays by a fifth per frame,
   which is a TAU near 90 - but a notched wheel fires about ten times a
   second, and at 90 the speed sagged between notches: the strip moved
   between 8px and 27px a frame at exactly the notch cadence. That
   ripple, once per picture, is the snap Julian saw. More friction
   holds the speed through the gaps. Measured on the dev server:

     TAU     90   120   150   180   220
     swing  ±5.4  ±4.0  ±3.3  ±2.8  ±2.5   px per frame
     lag       0     1     4     8    19   px behind after a spin

   180 is where the ripple has flattened and the strip is still within
   8px of the hand. Integrated exactly per frame, so a tick lands where
   it aimed and 60Hz and 144Hz feel the same. `target` is always where
   the strip will stop. */
/* Julian: smoother. 180 carried a tail a reader could watch - the
   landing test is the remaining distance, so at seven time constants
   the strip was still creeping a third of a pixel a frame more than a
   second after the hand stopped, and a sequence that is still moving
   when you have finished the gesture reads as lag rather than glide.
   150 catches up sooner and the landing below is called earlier. */
export const TAU = 150;

/* ── a paged move is a slide, not a throw ──
   Julian: the scroll smooth, the homepage above all. A paged move went
   through the momentum above, which aims a speed that runs out at the
   next screen: measured on the homepage at 1440, 281px of the 1440 in
   the first frame and then a tail, the last 100px taking 600ms. A lurch
   and a crawl. A screen to screen move is a slide, so it is timed and
   eased in and out like the opening's lift. A move that starts while
   another is running is already travelling, so it carries on with the
   ease out only, timed so it sets off at the speed it already had: a
   quick second notch runs on into the next screen without a stall or a
   kick. Julian, after 800ms shipped: slow. 550. */
const PAGE_MS = 550;
const inOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const out = (t: number) => 1 - (1 - t) ** 2;

/** A strip's moving parts, shared by every way of moving it. */
export type Mover = {
  el: HTMLDivElement;
  paged: boolean;
  /** Not under reduced motion. */
  eased: boolean;
  /** Whether Lenis is carrying the travel on this strip. */
  smooth: boolean;
  nextHref?: string;
  prevHref?: string;
  prevStart: boolean;
  deck?: Deck;
  /** Whether later sections are still held back (`defer`). */
  heldBack: { readonly current: boolean };
  /** Goes to another page (the router's `push`). */
  go: (href: string) => void;

  /* The scroller's own measurements, taken when it changes (`size`). */
  width: number;
  span: number;
  /* The window into the work, on the homepage: the pull opens it out
     of the right edge, up to a third of the screen at the count. Looked
     up when first asked for, since with `defer` it mounts after the strip
     does. */
  win: HTMLElement | null;
  drawn: boolean;

  /** Where the strip will stop. */
  target: number;
  /** The loop's frame, or 0 while nothing is moving the strip. */
  frame: number;
  /** Where the strip is and how fast it is going, in px and px per ms. */
  x: number;
  v: number;
  /** The last frame's time, or 0 for a run that has not stepped. */
  last: number;

  /* ── the band ── (`band.ts`) */
  over: number;
  band: number;
  pushed: number;
  leaving: boolean;
  wall: Animation | null;

  /* ── the gestures ── */
  /** When the page came, or the spin that led here last moved it. */
  arrived: number;
  /** When the wheel last sent an event. */
  gestureAt: number;
  /** Where a finger is, and what it came down on. */
  touchX: number | null;
  touchOn: EventTarget | null;
  /** A mouse is down, how many fingers are, a mouse is dragging. */
  down: boolean;
  held: number;
  dragging: boolean;

  size: () => void;
  room: () => number;
  clamp: (v: number) => number;
  /** Aims the strip: sets the speed that runs out exactly at `where`. */
  to: (where: number) => void;
  stop: () => void;
  /** The cell whose centre is nearest a scroll position. */
  nearest: (where: number) => number;
  /** Lets a finger go: the spring carries the strip to `where`. */
  throwTo: (where: number, sv: number, fv: number) => void;
};

export function createMover(
  el: HTMLDivElement,
  opts: Pick<
    Mover,
    "paged" | "eased" | "smooth" | "nextHref" | "prevHref" | "prevStart" | "deck" | "heldBack" | "go"
  >,
): Mover {
  const m: Mover = {
    el,
    ...opts,
    width: 0,
    span: 0,
    win: null,
    drawn: false,
    target: 0,
    frame: 0,
    x: 0,
    v: 0,
    last: 0,
    over: 0,
    band: 0,
    pushed: 0,
    leaving: false,
    wall: null,
    arrived: performance.now(),
    gestureAt: 0,
    touchX: null,
    touchOn: null,
    down: false,
    held: 0,
    dragging: false,
    size: () => {
      m.width = el.clientWidth;
      m.span = el.scrollWidth - m.width;
      // Read with the rest, once a push, not on every notch of it: asked
      // for after the pull's writes, it laid the homepage out again each
      // notch.
      m.drawn = !!(m.win ??= el.querySelector<HTMLElement>(":scope > [data-lead-window]"))?.getClientRects().length;
    },
    room: () => m.span,
    clamp: (v: number) => Math.min(m.room(), Math.max(0, v)),
    to: () => {},
    stop: () => {},
    nearest: () => 0,
    throwTo: () => {},
  };

  const step = (now: number) => {
    const dt = Math.min(32, m.last ? now - m.last : 16);
    m.last = now;
    const decay = Math.exp(-dt / TAU);
    m.x += m.v * TAU * (1 - decay);
    m.v *= decay;
    const end = m.room();
    if (m.x <= 0 || m.x >= end) {
      m.x = Math.min(end, Math.max(0, m.x));
      m.v = 0;
    }
    /* Landed. A pixel and a half rather than half a pixel: `scrollLeft`
       is whole pixels, so everything under one is a frame of work
       nobody can see - measured on /work, sixty frames of it at the end
       of every swipe. */
    if (Math.abs(m.target - m.x) < 1.5 && Math.abs(m.v) * TAU < 1.5) {
      m.x = m.target;
      m.v = 0;
      el.scrollLeft = m.x;
      m.frame = 0;
      m.last = 0;
      return;
    }
    el.scrollLeft = m.x;
    m.frame = requestAnimationFrame(step);
  };

  let from = 0;
  let began = 0;
  let curve = inOut;
  let length = PAGE_MS;
  // The slide's speed on its last frame, px per ms, for a handover.
  let pace = 0;
  let paced = 0;
  /* The lift's spring (`onTouchEnd`, `lib/motion/spring.ts`): px and px
     per second, a mass of one. Stepped in 4ms pieces so a long frame does
     not throw it. Shows past an end only as far as the scroll allows,
     which is none. */
  let sx = 0;
  let zeta = 1;
  let sAt = 0;
  const spring = (now: number) => {
    const dt = frameDt(now, sAt);
    sAt = now;
    const s = stepSpring({ x: m.x, v: sx }, m.target, zeta, dt);
    m.x = s.x;
    sx = s.v;
    if (springSettled(s, m.target)) {
      m.x = m.target;
      el.scrollLeft = m.x;
      m.frame = 0;
      sAt = 0;
      sx = 0;
      el.style.overflowX = "";
      return;
    }
    el.scrollLeft = m.x;
    m.frame = requestAnimationFrame(spring);
  };
  const slide = (now: number) => {
    if (!began) began = now;
    const t = Math.min(1, (now - began) / length);
    const was = m.x;
    m.x = from + (m.target - from) * curve(t);
    if (paced) pace = (m.x - was) / Math.max(1, now - paced);
    paced = now;
    el.scrollLeft = m.x;
    if (t < 1) {
      m.frame = requestAnimationFrame(slide);
      return;
    }
    m.frame = 0;
    m.last = 0;
    m.v = 0;
    pace = 0;
    paced = 0;
  };

  m.to = (where: number) => {
    m.target = m.clamp(where);
    if (!m.eased) {
      el.scrollLeft = m.target;
      return;
    }
    /* Where the browser is snapping, it scrolls and this does not.

       A paged strip under a finger has `scroll-snap-type: x mandatory`
       (`strip-paged` in `globals.css`), which is what lands each swipe on
       a section. Snap and a scripted scroll are the same argument twice:
       the loop below writes `scrollLeft` a frame at a time and the snap
       engine pulls each of those writes to the nearest section, so a
       press on the ruler arrived instantly - measured on an iPad, nought
       to 768 between one frame and the next, where a swipe to the same
       place takes half a second of moving picture. Julian asked for the
       press to look like the swipe.

       So hand it over. `behavior: "smooth"` is the browser's own travel,
       which is what the finger gets, and it lands on the snap point
       rather than fighting it. Read off the element rather than from a
       media query, so this follows the rule wherever it applies. */
    if (getComputedStyle(el).scrollSnapType !== "none") {
      if (m.frame) cancelAnimationFrame(m.frame);
      m.frame = 0;
      m.last = 0;
      m.v = 0;
      m.x = m.target;
      el.scrollTo({ left: m.target, behavior: "smooth" });
      return;
    }
    if (m.paged) {
      from = el.scrollLeft;
      const still =
        !m.frame || !pace || Math.sign(pace) !== Math.sign(m.target - from);
      curve = still ? inOut : out;
      /* The ease out sets off at twice the average speed, so a length of
         twice the distance over the speed it had matches the two. */
      length = still
        ? PAGE_MS
        : Math.min(
            PAGE_MS * 1.5,
            Math.max(
              PAGE_MS / 2,
              (2 * Math.abs(m.target - from)) / Math.abs(pace),
            ),
          );
      if (m.frame) cancelAnimationFrame(m.frame);
      // From now, so the first frame already moves.
      began = performance.now();
      paced = 0;
      m.x = from;
      m.frame = requestAnimationFrame(slide);
      return;
    }
    // Pick up from wherever the keyboard, a touch or a drag left it.
    if (!m.frame) {
      m.x = el.scrollLeft;
      m.last = 0;
    }
    m.v = (m.target - m.x) / TAU;
    if (!m.frame) m.frame = requestAnimationFrame(step);
  };

  m.stop = () => {
    if (m.frame) cancelAnimationFrame(m.frame);
    m.frame = 0;
    m.last = 0;
    m.v = 0;
    m.x = m.target = el.scrollLeft;
  };

  m.nearest = (where: number) =>
    nearestSeat(
      Array.from(el.children, (c) => leftOf(c as HTMLElement) + (c as HTMLElement).offsetWidth / 2),
      where + el.clientWidth / 2,
    );

  m.throwTo = (where: number, sv: number, fv: number) => {
    el.style.overflowX = "hidden";
    m.target = m.clamp(where);
    m.x = el.scrollLeft;
    zeta = dampingFor(fv);
    /* The finger's speed, but never more than the spring can stop in
       the distance left. A hard flick let go just short of a screen set
       off at 14px/ms for a screen 180px away and ran 236px into the
       next one before it came back (measured in WebKit, iPad size). A
       critically damped spring stops dead from `w * distance`; a
       flick is allowed a quarter more, which is the give. */
    sx = launchSpeed(sv, m.target - m.x, zeta);
    if (m.frame) cancelAnimationFrame(m.frame);
    sAt = 0;
    m.frame = requestAnimationFrame(spring);
  };

  return m;
}
