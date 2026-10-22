import { matches } from "@/lib/device";
import * as React from "react";
import {
  GESTURE_GAP_MS,
  LENIS_LINE,
  LINE,
  MOUSE_LERP,
  NOTCH_TURN_PX,
  padGesture,
  padLand,
  wantsLenis,
  wantsOwnNotch,
  WHEEL,
} from "./shared";

/* ── Lenis ────────────────────────────────────────────────────
 * On by default; `?lenis=0` opts a browser out. It takes the wheel on
 * the strip's own scroller, sideways, and leaves the drag, the rail,
 * the keys and the lead-on where they are. Loaded on its own, so it
 * arrives after the pictures rather than ahead of them.
 *
 * A paged strip (the homepage, the studio, the contact page) once kept
 * off it: Lenis made each one continuous scroll that slid the next
 * section into view instead of landing on it, and Julian reported
 * exactly that. They paged instead, a timed slide set off by the
 * gesture, which meant the stack moved after the wheel rather than with
 * it (Julian: make it happen with the scroll). So under a wheel they
 * have Lenis too, and land by `settle` below: the screens follow the
 * wheel, and once it rests the strip carries on to the next screen or
 * goes back to the one it left. A finger keeps the browser's snap. */
export function useLenis(
  scrollerRef: React.RefObject<HTMLDivElement | null>,
  live: boolean,
  paged: boolean,
) {
  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !live || !wantsLenis()) return;
    // A paged strip rides Lenis only under a wheel and a pointer.
    if (paged && !matches("fine")) return;
    let off = () => {};
    let gone = false;
    const ownNotch = wantsOwnNotch();
    const free = new URLSearchParams(location.search).get("scroll") === "1";
    /* A frame on: Lenis measures the wrapper as it is made, and made while
       the page arrives that was 18ms of layout inside the trip's freeze. */
    const ready = new Promise((go) => requestAnimationFrame(go));
    Promise.all([import("lenis"), ready]).then(([{ default: Lenis }]) => {
      if (gone) return;
      // The notch being judged, for `prevent` below.
      let dx = 0;
      let dy = 0;
      const lenis = new Lenis({
        wrapper: el,
        content: el,
        orientation: "horizontal",
        /* A wheel and a trackpad push downwards on a page that runs
           sideways, so both axes have to count. */
        gestureOrientation: "both",
        smoothWheel: true,
        /* A box that scrolls on its own (the contact form on a laptop) keeps
           the wheel until it has run out, as the strip's own wheel lets it.
           Without this Lenis took the wheel over the form and moved nothing,
           and the send button under the fold could not be reached.

           By the strip's own rule (`onWheel`): a textarea or a select
           keeps it, a `[data-scroll]` box until it has run out. Not
           Lenis's `allowNestedScroll`, which read the computed style of
           everything under the pointer and laid the page out again for
           it: 20 to 35ms on the first notch of a push on the portfolio,
           the lag into the way back home. */
        prevent: (node) => {
          if (node.closest("dialog[open]")) return true;
          if (Math.abs(dx) > Math.abs(dy)) return false;
          if (node.matches("textarea, select")) return true;
          if (!node.hasAttribute("data-scroll")) return false;
          return dy < 0
            ? node.scrollTop > 0
            : node.scrollTop + node.clientHeight < node.scrollHeight - 1;
        },
        /* The same gain the strip's own model uses, so what is being
           judged is the easing and not how far a notch carries: at one to
           one a notch moved 120px against 360 and Lenis would lose on a
           difference nobody asked about. */
        wheelMultiplier: WHEEL,
        /* A notch and a trackpad are not the same gesture, and Lenis
           treated them as one: a trackpad got the mouse's gain of three
           on top of its own momentum, eased again, which is twitchy under
           the finger and floaty after it. Measured per event, the way the
           strip's own model tells them apart: a notch is a delta of 80 or
           more (or a line or a page), anything finer is a trackpad. The
           trackpad keeps its gentler gain and a quick ease that follows
           its own momentum; a notch gets a longer ease so a spin reads as
           one movement rather than a pulse per notch. */
        virtualScroll: (data) => {
          const e = data.event;
          dx = data.deltaX;
          dy = data.deltaY;
          if (!(e instanceof WheelEvent)) return true;
          // A card crossing over has the wheel (`cross.ts`).
          if ("crossing" in el.dataset) return false;
          /* A trackpad is the strip's own (`onWheel`): its events move
             the scroller directly, since macOS has already eased them.
             Eased again here it cost a frame loop and a layout a frame,
             and a home page swipe ran at 31ms a frame against 20
             without it (WebKit, 1440 wide). A notch is still Lenis's. */
          if (padGesture.get(el)) {
            // `?scroll=1`: a swipe landing keeps its landing.
            if (padLand.has(el)) return false;
            // Taken over mid-run: Lenis stops where the strip stands.
            if (lenis.isScrolling === "smooth")
              lenis.scrollTo(el.scrollLeft, { immediate: true, force: true });
            return false;
          }
          // Under `?notch` the strip has the notch too (`onWheel`).
          if (ownNotch) return false;
          lenis.options.lerp = MOUSE_LERP;
          /* `?scroll=1`: the first notch of a turn carries half, so a lone
             notch is a small nudge (Julian: the first nudge too much); the
             notches after it in the same flick carry the whole, so a flick
             gets past a screen (Julian: too much work to go past one). */
          if (free) {
            e.preventDefault();
            const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            if (d) page(Math.sign(d));
            return false;
          }
          /* Firefox's mouse reports lines, and Lenis counts a line as
             16.7px, so a notch of three carried 150px against the 360 of
             a notch anywhere else, and on a paged strip that is under
             the fifth of a screen `settle` asks for: the page never
             turned. A line is 40px here, as the strip's own model and
             `scrubDeal` count it. Lenis reads the deltas after this. */
          if (e.deltaMode === 1) {
            data.deltaX *= LINE / LENIS_LINE;
            data.deltaY *= LINE / LENIS_LINE;
          }
          return true;
        },
        /* Not the finger. An iPad's own momentum is better than anything
           here, and Lenis says its touch sync is unstable on older iOS. */
        syncTouch: false,
        /* Driven here rather than by `autoRaf`, which asks for a frame
           every frame for the life of the page, so a strip nobody touches
           never lets the main thread sleep. The loop runs while an ease is
           travelling and stops when it lands; a wheel wakes it. */
        autoRaf: false,
      });
      let frame = 0;
      /* Lenis is fed its own clock, which never moves more than two
         frames at once. It eases by the time since the frame before, and
         the first frame after a rest can carry a stale stamp: measured on
         /work, a notch's first frame arrived 3ms after the one before it
         stamped 67ms later, and Lenis spent the whole of that at once:
         82px of a 300px notch in one frame, then 17. The jump at the
         start of every scroll. */
      let clock = 0;
      let seen = 0;
      const loop = (t: number) => {
        clock += seen ? Math.min(t - seen, 34) : 0;
        seen = t;
        lenis.raf(clock);
        frame =
          lenis.isScrolling === "smooth" ? requestAnimationFrame(loop) : 0;
      };
      const wake = () => {
        if (frame) return;
        /* A new run: its first frame is a start, not a step, so nothing
           is carried over from the rest. */
        seen = 0;
        lenis.time = clock;
        frame = requestAnimationFrame(loop);
      };
      /* ── landing, on a paged strip ──
         Once the wheel has been still for a moment, the strip goes on to
         the next screen if it has come a fifth of the way towards it, and
         back to the one it left if not: a single notch turns the page, and
         a nudge the other way is taken back. Screens are measured end to
         end off their widths, since the deck pins them where they are. */
      let rest = 0;
      /* Judged by where Lenis is heading, not where it has got to: the
         ease after a notch runs on for a second, and waiting it out put
         the landing back after the wheel. */
      const stopList = () => {
        const cs = getComputedStyle(el);
        const gap = parseFloat(cs.columnGap) || 0;
        const end = el.scrollWidth - el.clientWidth;
        const stops: number[] = [];
        let at = parseFloat(cs.paddingLeft) || 0;
        for (const k of Array.from(el.children) as HTMLElement[]) {
          stops.push(Math.min(end, at));
          at += k.offsetWidth + gap;
        }
        return stops;
      };
      // The screen `x` is in, and how far through it.
      const segment = (x: number) => {
        const stops = stopList();
        if (!stops.length) return null;
        let i = 0;
        while (i < stops.length - 1 && stops[i + 1] <= x) i++;
        const from = stops[i];
        const to = stops[Math.min(i + 1, stops.length - 1)];
        return { from, to, gone: to > from ? (x - from) / (to - from) : 0 };
      };
      /* `?scroll=1`, a mouse: every notch is one page (Julian: it should
         move from notch one). Notches during a slide add a page each to
         where it is going. */
      let pageTo = 0;
      const page = (dir: number) => {
        const stops = stopList();
        if (!stops.length) return;
        const x = lenis.isScrolling ? pageTo : el.scrollLeft;
        let i = 0;
        for (let k = 1; k < stops.length; k++)
          if (Math.abs(stops[k] - x) < Math.abs(stops[i] - x)) i = k;
        const next = Math.max(0, Math.min(stops.length - 1, i + dir));
        if (Math.abs(stops[next] - x) < 1) return;
        pageTo = stops[next];
        lenis.scrollTo(pageTo, { duration: 0.6, easing: (t) => 1 - (1 - t) ** 3, force: true });
        wake();
      };
      const settle = () => {
        // A notch under `?notch` lands by the strip's own slide.
        if (ownNotch && !padGesture.get(el)) return;
        /* `?scroll=1`: not while the wheel's own glide is still going.
           Landing mid-glide turned the strip round in one frame, 54px a
           frame onward to 10px back (Julian: the nudge is too abrupt). */
        // `?scroll=1`, a notch: it went a whole page already (`page`).
        if (free && !padGesture.get(el)) return;
        /* `?scroll=1`, a trackpad: where the strip stands, and the way the
           fingers went. The pad moves the scroller past Lenis, so Lenis's
           target and direction were a swipe old, and a strong flick was
           taken back to where it began (MAC, Safari). */
        const pad = free && padGesture.get(el);
        if (pad && padLand.has(el)) {
          padLand.delete(el);
          return;
        }
        const x = pad ? el.scrollLeft : lenis.targetScroll;
        const span = segment(x);
        if (!span) return;
        const { from, to, gone } = span;
        /* A notch carries 300 to 360px (`WHEEL`), under a fifth of a
           screen from about 1800px wide: on a 1920 monitor one notch was
           taken back every time and the page never turned. For a notch the line
           is the nearer of a fifth and `NOTCH_TURN_PX`; a trackpad keeps
           the fifth. */
        /* `?scroll=1` (Julian, 2026-10-22, a preview), a mouse: the deck
           goes where the wheel puts it, and at rest a quarter of the way
           turns the page: a lone notch is taken back, a flick of two or
           more goes on. A trackpad lands as it always has. */
        const turn = padGesture.get(el)
            ? 0.2
            : Math.min(0.2, NOTCH_TURN_PX / Math.max(1, to - from));
        const dir = pad ? Math.sign(padNet) || 1 : lenis.direction;
        const onward = dir >= 0 ? gone > turn : gone > 1 - turn;
        const target = onward ? to : from;
        if (Math.abs(target - x) < 1 && Math.abs(target - el.scrollLeft) < 1) return;
        if (pad) lenis.scrollTo(el.scrollLeft, { immediate: true, force: true });
        lenis.scrollTo(target, { duration: 0.6, easing: (t) => 1 - (1 - t) ** 3 });
        wake();
      };
      /* `?scroll=1`, a trackpad (Julian: make it work naturally). The
         strip follows the fingers one to one and carries the momentum;
         once the momentum is falling away the swipe lands on the screen
         it is heading for, at the speed it was going, rather than
         creeping to a stop and easing on from there. */
      let padV = 0; // px per ms, smoothed
      let padPeak = 0;
      let padPrev = 0;
      let padFall = 0;
      let padNet = 0;
      let padAt = -Infinity;
      const letGo = () => {
        padLand.delete(el);
        if (lenis.isScrolling) lenis.scrollTo(el.scrollLeft, { immediate: true, force: true });
      };
      const land = () => {
        const x = el.scrollLeft;
        // Where the momentum would have run out: about 300ms of its speed.
        const span = segment(x + padV * 300);
        if (!span) return;
        const { from, to, gone } = span;
        const dir = Math.sign(padV) || Math.sign(padNet) || 1;
        // Still going at 0.15px a millisecond is a flick, not a drop.
        const flick = Math.abs(padV) > 0.15;
        const target = dir > 0 ? (flick || gone > 0.15 ? to : from) : flick || gone < 0.85 ? from : to;
        const d = Math.abs(target - x);
        if (d < 1) return;
        padLand.add(el);
        lenis.scrollTo(x, { immediate: true, force: true });
        const ahead = Math.sign(target - x) === dir;
        // Cubic out starts at three times its mean speed: match the fingers.
        const ms = (3 * d) / Math.max(0.1, Math.abs(padV));
        lenis.scrollTo(target, {
          duration: ahead ? Math.min(0.7, Math.max(0.25, ms / 1000)) : 0.5,
          easing: ahead
            ? (t) => 1 - (1 - t) ** 3
            : (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
          force: true,
        });
        wake();
      };
      const onPad = (e: WheelEvent) => {
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        const mag = Math.abs(d);
        const dt = e.timeStamp - padAt;
        padAt = e.timeStamp;
        if (dt > GESTURE_GAP_MS) {
          if (padLand.has(el)) letGo();
          padV = padPeak = padPrev = padFall = padNet = 0;
        } else if (padLand.has(el)) {
          // A delta that climbs again is the next swipe, not the tail.
          if (!(mag > padPrev * 1.5 && mag > 4)) {
            padPrev = mag;
            return;
          }
          letGo();
          padPeak = padFall = padNet = 0;
        }
        padNet += d;
        padV = padV * 0.6 + (d / Math.min(Math.max(dt, 4), 50)) * 0.4;
        padFall = mag <= padPrev && mag < padPeak ? padFall + 1 : 0;
        padPeak = Math.max(padPeak, mag);
        padPrev = mag;
        // Four falling deltas under half the peak: the fingers are off.
        if (padFall >= 4 && mag < padPeak * 0.5) land();
      };
      const onRest = (e: WheelEvent) => {
        window.clearTimeout(rest);
        rest = window.setTimeout(settle, GESTURE_GAP_MS + 20);
        if (free && padGesture.get(el)) onPad(e);
      };
      if (paged) el.addEventListener("wheel", onRest, { passive: true });
      // Capture, so the wake is booked before Lenis handles the event.
      el.addEventListener("wheel", wake, { capture: true, passive: true });
      /* Lenis watches the strip's box, not how far it scrolls, so the
         sections that arrive after a crossing (`defer`) never reached
         it: the wheel stopped at the second screen. */
      const grown = new MutationObserver(() => lenis.resize());
      grown.observe(el, { childList: true });
      el.dataset.lenis = "1";
      off = () => {
        grown.disconnect();
        cancelAnimationFrame(frame);
        window.clearTimeout(rest);
        el.removeEventListener("wheel", onRest);
        el.removeEventListener("wheel", wake, { capture: true });
        lenis.destroy();
        delete el.dataset.lenis;
      };
    });
    return () => {
      gone = true;
      off();
    };
  }, [scrollerRef, live, paged]);
}
