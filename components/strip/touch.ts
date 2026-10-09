import { chooseSeat } from "@/lib/motion/seat";
import { projectThrow } from "@/lib/motion/throw";
import type { Band } from "./band";
import type { Mover } from "./motion";
import { centreOf, LEAVE_TOUCH } from "./shared";

/* A finger on a paged strip (the homepage), from Julian's iPad, 2026-10-08,
   recorded and logged at each step:
   - The strip waited for iOS's momentum to run out and then slid to the
     nearest screen. The momentum's tail creeps for seconds, so a swipe
     glided, stalled, lurched to a screen, and once ran on to the ask card
     and back. Now the lift decides, and iOS's momentum is stopped so only
     the strip moves it.
   - A first version of that slid on a timed ease, and set off at 40 to 70%
     of the finger's speed: a brake at the moment of letting go. Now the
     lift is projected the way iOS throws a scroll (`lib/motion/throw.ts`),
     the screen is the one nearest where it would land (one at most from
     where the finger went down), and a spring carries the strip there from
     the finger's own speed. Critically damped; a flick gets a little give.
     A finger back on the glass takes it from wherever it is.
   - A swipe that began 16 to 50ms after momentum had carried the strip to
     its end led straight to the next page. The end has to have been
     reached and left alone for `EDGE_REST` first. */
const EDGE_REST = 300;

/* ── a finger past the end ──
   The wheel stretches the band and leads on at `LEAVE_AFTER`; a finger
   never reached that path, because a touchscreen scrolls the strip
   itself and the browser stops it dead on the last cell. Julian, on
   an iPad held sideways: on a filter, allow swiping back and forth to
   the previous and next filter. So a swipe that finds the strip
   already at its end, and carries on the same way, is read as that
   ask. The band is pushed with the finger so the pull is seen, and at
   `LEAVE_TOUCH` of it the strip leads on through the same `leave` the
   wheel uses - between two filters that is the row swapped in place.

   Native scrolling is left alone: the listeners are passive, a swipe
   with room still to scroll is not read at all, and the edge is
   decided once at the start of the gesture, so a swipe that arrives
   at the end mid-travel does not carry straight through into the next
   page. Two fingers are the platform's, and are ignored. */
export function touchHandlers(m: Mover, band: Band) {
  const { el } = m;
  let flick: { x: number; t: number }[] = [];
  // When the strip last moved, for `EDGE_REST`.
  let movedAt = 0;
  const onMoved = () => {
    movedAt = performance.now();
  };
  let touchEdge: 1 | -1 | 0 = 0;
  // The screen under the strip when the finger went down.
  let downSeat = 0;
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) {
      m.touchX = null;
      return;
    }
    m.touchX = e.touches[0].clientX;
    m.touchOn = e.touches[0].target;
    const r = m.room();
    // A run that fits the window is at both ends at once: 0 here, and
    // the move reads the direction instead.
    touchEdge =
      r < 1 ? 0 : el.scrollLeft >= r - 2 ? 1 : el.scrollLeft <= 2 ? -1 : 0;
    // Still arriving at its end: this swipe is not a request to leave.
    if (r >= 1 && performance.now() - movedAt < EDGE_REST) touchEdge = 0;
    flick = [{ x: m.touchX, t: e.timeStamp }];
    downSeat = m.nearest(el.scrollLeft);
    // A finger on a sliding strip takes it.
    if (m.frame && m.paged) {
      cancelAnimationFrame(m.frame);
      m.frame = 0;
    }
    /* And on a strip that runs free (the portfolio). A glide the rail or
       a key had set going kept writing `scrollLeft` under the finger, and
       `sync` left its target where it was, so after the lift the strip
       ran on and then glided back to that target with nothing touching
       it: 300 to 1100px back in 19 of 20 flicks made mid-glide (WebKit,
       iPad size, 2026-10-09). */
    if (m.frame && !m.paged) m.stop();
    el.style.overflowX = "";
  };
  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1)
      flick = [...flick, { x: e.touches[0].clientX, t: e.timeStamp }].slice(-8);
    if (m.touchX === null || e.touches.length !== 1 || m.leaving) return;
    const x = e.touches[0].clientX;
    const by = m.touchX - x;
    m.touchX = x;
    // Which way the finger is going, as the band counts it: forward is
    // positive, the same sign the wheel gives `push`.
    const dir: 1 | -1 = by > 0 ? 1 : -1;
    const r = m.room();
    const edge = r < 1 ? dir : touchEdge;
    if (edge !== dir || !(dir > 0 ? m.nextHref : m.prevHref)) return;
    band.push(by);
    if (m.over >= LEAVE_TOUCH) band.leave(1);
    if (m.over <= -LEAVE_TOUCH) band.leave(-1);
  };
  const onTouchEnd = (e: TouchEvent) => {
    m.touchX = null;
    touchEdge = 0;
    if (!m.paged || !m.eased || m.leaving || e.touches.length) return;
    const lift = e.changedTouches[0];
    if (!lift || flick.length < 2 || Math.abs(lift.clientX - flick[0].x) < 8) return;
    /* The finger's speed over its last tenth of a second of moving, and
       nothing if it stood still that long before it lifted. */
    const last = flick[flick.length - 1];
    let from = flick.findIndex((p) => last.t - p.t <= 100);
    /* A slow phone hands the moves over far apart: on a mid-range
       Android (Chrome, 4x CPU throttle, 2026-10-09) a swipe's last two
       came 102ms apart, the tenth of a second held only the last, the
       speed read nought and a swipe of a third of a screen went back.
       Then the move before it counts, up to a quarter second back. */
    if (from === flick.length - 1 && from > 0 && last.t - flick[from - 1].t <= 250) from--;
    const back = flick[Math.max(0, from)];
    const fv =
      e.timeStamp - last.t < 100 && last.t > back.t
        ? (last.x - back.x) / (last.t - back.t)
        : 0;
    // The strip moves against the finger.
    const sv = -fv;
    const lands = projectThrow(el.scrollLeft, sv);
    const seat = chooseSeat(m.nearest(lands), downSeat, el.children.length);
    const where = centreOf(el, seat);
    if (where === null) return;
    m.throwTo(where, sv, fv);
  };
  return { onMoved, onTouchStart, onTouchMove, onTouchEnd };
}
