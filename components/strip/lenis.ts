import { matches } from "@/lib/device";
import * as React from "react";
import {
  GESTURE_GAP_MS,
  LENIS_LINE,
  LINE,
  MOUSE_LERP,
  padGesture,
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
          /* A trackpad is the strip's own (`onWheel`): its events move
             the scroller directly, since macOS has already eased them.
             Eased again here it cost a frame loop and a layout a frame,
             and a home page swipe ran at 31ms a frame against 20
             without it (WebKit, 1440 wide). A notch is still Lenis's. */
          if (padGesture.get(el)) {
            // Taken over mid-run: Lenis stops where the strip stands.
            if (lenis.isScrolling === "smooth")
              lenis.scrollTo(el.scrollLeft, { immediate: true, force: true });
            return false;
          }
          // Under `?notch` the strip has the notch too (`onWheel`).
          if (ownNotch) return false;
          lenis.options.lerp = MOUSE_LERP;
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
      const settle = () => {
        // A notch under `?notch` lands by the strip's own slide.
        if (ownNotch && !padGesture.get(el)) return;
        const cs = getComputedStyle(el);
        const gap = parseFloat(cs.columnGap) || 0;
        const end = el.scrollWidth - el.clientWidth;
        const stops: number[] = [];
        let at = parseFloat(cs.paddingLeft) || 0;
        for (const k of Array.from(el.children) as HTMLElement[]) {
          stops.push(Math.min(end, at));
          at += k.offsetWidth + gap;
        }
        if (!stops.length) return;
        const x = lenis.targetScroll;
        let i = 0;
        while (i < stops.length - 1 && stops[i + 1] <= x) i++;
        const from = stops[i];
        const to = stops[Math.min(i + 1, stops.length - 1)];
        const gone = to > from ? (x - from) / (to - from) : 0;
        const onward = lenis.direction >= 0 ? gone > 0.2 : gone > 0.8;
        const target = onward ? to : from;
        if (Math.abs(target - x) < 1 && Math.abs(target - el.scrollLeft) < 1) return;
        lenis.scrollTo(target, {
          duration: 0.6,
          easing: (t) => 1 - (1 - t) ** 3,
        });
        wake();
      };
      const onRest = () => {
        window.clearTimeout(rest);
        rest = window.setTimeout(settle, GESTURE_GAP_MS + 20);
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
