"use client";

import * as React from "react";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { notchStream } from "@/lib/motion/wheel";

type ScrollFn = (y: number) => void;
const scrollFns = new Set<ScrollFn>();
let live: Lenis | null = null;

/** Goes to the top, through Lenis when it runs: a plain scrollTo mid-glide
 *  is written over by Lenis's next frame (page-fly.tsx). `glide` scrolls
 *  there smoothly (the wordmark on the homepage, chrome.tsx). */
export function scrollTop(glide = false) {
  // 1.2s ease-in-out for the glide: Lenis's lerp lurched 75% in 200ms, then crawled (Julian, #833).
  if (live)
    live.scrollTo(
      0,
      glide
        ? { duration: 1.2, easing: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2), force: true, userData: { goal: 0 } }
        : { immediate: true, force: true },
    );
  else scrollTo({ top: 0, behavior: glide ? "smooth" : "instant" });
}

/** Glides to `y` with the same 1.2s ease as the wordmark's trip to the top, then calls `done` (once, also if the glide is cut short). */
export function glideTo(y: number, done: () => void) {
  let over = false;
  const end = () => {
    if (over) return;
    over = true;
    done();
  };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    scrollTo({ top: y, behavior: "instant" });
    return end();
  }
  if (live)
    live.scrollTo(y, {
      duration: 1.2,
      easing: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
      force: true,
      onComplete: end,
      userData: { goal: y },
    });
  else {
    scrollTo({ top: y, behavior: "smooth" });
    addEventListener("scrollend", end, { once: true });
  }
  // shortcut: Safari before 26 has no scrollend, and a glide can be interrupted: the card opens by 1.6s regardless
  setTimeout(end, 1600);
}

/** Puts the page at `y` now, and Lenis with it: a glide it still had from the last page otherwise carried on over a restored scroll (#1313). */
export function jumpTo(y: number) {
  // resize first: Lenis clamps to the limit it measured, which is still the last page's on a Back (row below the fold for 20 frames)
  if (live) {
    live.resize();
    live.scrollTo(y, { immediate: true, force: true });
  } else scrollTo(0, y);
}

/** Where the page is headed: a timed glide's end (Lenis moves its targetScroll along with it, so a held row's snap took the glide
 *  for a stop when a frame ran late, and cut the trip to the footer short), Lenis's target while it lerps, the scroll itself otherwise.
 *  `goal` lives in Lenis's userData, which its next scrollTo of any kind replaces. */
export const scrollGoal = (): number => (live?.userData as { goal?: number } | undefined)?.goal ?? live?.targetScroll ?? scrollY;

/** Heads for `y` on a soft lerp that the next wheel or touch takes over (no lock): the held rows settle on an item with it (mt/motion/rows.ts).
 *  A lerp, not a timed glide: it carries on from the speed the page already has, where a timed ease stopped and started again (Julian: "smoother"). */
export function settleTo(y: number) {
  if (live) live.scrollTo(y, { lerp: 0.07 });
  else scrollTo({ top: y, behavior: "smooth" });
}

/** Moves the page by `dy` without breaking a glide: Lenis writes its own
 *  position every frame, so a plain scrollBy is undone (home.tsx rows). */
export function shiftScroll(dy: number) {
  if (live) {
    // shortcut: shifts Lenis's internal glide (from/to/value, lenis 1.3), recheck on a Lenis upgrade
    const glide = (live as unknown as { animate?: { from: number; to: number; value: number } }).animate;
    if (glide) {
      glide.from += dy;
      glide.to += dy;
      glide.value += dy;
    }
    live.animatedScroll += dy;
    live.targetScroll += dy;
  }
  scrollBy(0, dy);
}

/** Called inside Lenis's own frame, right after it moves the page, with the
 *  page scroll it just wrote. Native scroll events only arrive a frame later. */
export function onLenisScroll(fn: ScrollFn) {
  scrollFns.add(fn);
  return () => void scrollFns.delete(fn);
}

/** Pages that scroll natively, with no Lenis at all.
 *  Proof galleries, deliveries and contracts: Lenis's glide read as a delay on a Mac trackpad.
 *  /admin: the Leads desk and the editor pin themselves to the screen and scroll their own panes. Lenis
 *  cancels every vertical wheel event to glide the window, which has nothing to scroll there, so a
 *  trackpad moved nothing at all in Leads. */
const NATIVE = ["/proof/", "/delivery/", "/contract/", "/admin"];

/** On the homepage a mouse wheel notch moves this many times its delta; a trackpad is left as it is.
 *  The home is ten screens tall with its holds, about 80 notches at 1x (Julian: "needs more effort"). `?wheel=1.4` tries another value. */
const HOME_NOTCH = 1.6;

export function SmoothScroll() {
  const pathname = usePathname();
  const lenisRef = React.useRef<Lenis | null>(null);
  // Per route, not once on mount: a client hop onto one of these pages drops Lenis, a hop off brings it back.
  const native = NATIVE.some((p) => pathname.startsWith(p));

  React.useEffect(() => {
    // Skip if reduced motion is requested
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (native) return;

    // A lerp follows the wheel as it moves instead of replaying a fixed
    // 1.2s glide on every event, which read as lag on a trackpad.
    // 0.13, not 0.2: the v4 home's motion is tied to the scroll, and at 0.2 each wheel notch read as a step.
    // `?lerp=0.1` tries another value.
    const q = new URLSearchParams(location.search);
    const asked = parseFloat(q.get("lerp") ?? "");
    const wheelAsked = parseFloat(q.get("wheel") ?? "");
    const notchBoost = wheelAsked >= 1 && wheelAsked <= 4 ? wheelAsked : HOME_NOTCH;
    const isNotch = notchStream();
    const lenis = new Lenis({
      lerp: asked > 0.02 && asked <= 1 ? asked : 0.13,
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.5,
      autoRaf: true,
      // Lenis reads deltaY back after this returns, so scaling it here is the whole boost
      virtualScroll: (d) => {
        if (d.event instanceof WheelEvent && isNotch(d.event, devicePixelRatio) && location.pathname === "/") d.deltaY *= notchBoost;
        return true;
      },
    });
    lenisRef.current = live = lenis;
    lenis.on("scroll", () => scrollFns.forEach((fn) => fn(window.scrollY)));

    // Sync Lenis with window scroll on navigation / dynamic content changes
    const onResize = () => lenis.resize();
    window.addEventListener("resize", onResize);

    // <html> is h-full, so Lenis's own observer never sees the page grow
    // after a client route change. The body does grow, so watch that.
    const resizeObserver = new ResizeObserver(() => lenis.resize());
    resizeObserver.observe(document.body);

    return () => {
      window.removeEventListener("resize", onResize);
      resizeObserver.disconnect();
      lenis.destroy();
      lenisRef.current = live = null;
    };
  }, [native]);

  // Re-measure on every route change too, in case the new page has the
  // same body height at first and only grows later.
  React.useEffect(() => {
    lenisRef.current?.resize();
  }, [pathname]);

  return null;
}
