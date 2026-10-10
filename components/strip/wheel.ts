import { isTrackpad } from "@/lib/motion/wheel";
import type { Band } from "./band";
import type { Mover } from "./motion";
import {
  centreOf,
  GESTURE_GAP_MS,
  LINE,
  nav,
  PAD,
  padGesture,
  wantsOwnNotch,
  WHEEL,
} from "./shared";

/* How long a paged move owns the wheel. A mouse notch is one turn of
   the hand and another turn a moment later means another screen, so
   its lock is short. A trackpad sends a stream of small deltas for one
   swipe and keeps sending them through the momentum afterwards, so
   every one of those extends the lock: one swipe is one screen, however
   long the fingers keep gliding. */
const NOTCH_LOCK = 260;
const SWIPE_LOCK = 380;

/* A wheel moves the strip sideways, whichever way it is turned.
   `passive: false` because it has to be able to take the event; left
   passive, the browser would scroll the page at the same time and both
   would move.

   Both axes through here, and that is the fix for what Julian saw as
   a glitchy trackpad. A sideways swipe used to be handed to the
   browser to scroll the overflow natively, so the strip had two ways
   of moving at once: the browser writing `scrollLeft` with its own
   momentum, and the loop below easing towards a target it had worked
   out before any of that happened. A diagonal swipe - which every
   trackpad swipe is, a little - ran both, and the next notch yanked
   the strip back to a target measured from where it used to be. One
   path, one idea of where the strip is going, and up, down, left and
   right all reach it. */
export function wheelHandler(m: Mover, band: Band) {
  const { el } = m;
  const ownNotch = wantsOwnNotch();
  /** While a paged move is landing, another gesture is the same gesture. */
  let locked = 0;
  let paused = false;
  /* One swipe is one gesture, and who owns it is decided once.
     A trackpad sends a stream of events for a single push of two
     fingers, and each one is aimed at whatever happens to be under a
     cursor that never moved: as the strip carries cells along, that is
     a different element every few frames. Deciding per event let the
     middle of a swipe land on something that wanted the wheel for
     itself - an inner box, a tile, a list - and the rest of the push
     did nothing. Whoever the first event of a gesture goes to keeps it
     until the fingers lift, which is a gap of `GESTURE_GAP_MS`. */
  let owned = false;
  /* A fling decays and a hand does not. `peak` is the biggest delta of
     the push that is running and `prevMag` the one before this one, so a
     delta that climbs again once the tail has fallen away is the next
     swipe arriving before the last one has died. The lock below is
     pushed another SWIPE_LOCK into the future by every momentum event,
     and a trackpad's momentum runs for a second or two, so without this
     a swipe made while the last one was still gliding was thrown away
     whole. Measured on the homepage before the fix: three swipes, each a
     full second after the fingers lifted, moved one section between
     them. That is the hit-and-miss Julian reported on the Mac. */
  let peak = 0;
  let trough = Infinity;
  let again = false;

  return (e: WheelEvent) => {
    // A pinch is a zoom.
    if (e.ctrlKey) return;
    /* An open dialog keeps its own wheel: the reference picker sits
       in the form, so inside the strip, and its photographs could
       not be scrolled. */
    if ((e.target as Element | null)?.closest?.("dialog[open]")) return;
    const now = e.timeStamp || performance.now();
    // Since the last notch here, or since the page came if none has yet.
    const before = m.gestureAt;
    const gap = now - Math.max(before, m.arrived);
    const fresh = now - before > GESTURE_GAP_MS;
    m.gestureAt = now;
    // A new push: take the measurements again, once, before using them.
    if (fresh) m.size();
    if (fresh) padGesture.set(el, false);
    /* A trackpad's event, not a mouse's notch: under 80 device pixels
       and in pixels, as the strip and Lenis both tell them apart. */
    if (isTrackpad(e, window.devicePixelRatio)) padGesture.set(el, true);
    const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    const raw = sideways ? e.deltaX : e.deltaY;
    if (!raw) return;
    /* Whether Lenis carries this one: not a trackpad's, and not a
       notch under `?notch`. */
    const lenisWheel = m.smooth && !(ownNotch && !padGesture.get(el));
    /* Half a second of quiet, not half a second since the mount: the
       spin that led here is still that spin until it pauses, so the
       arrival moves with it. A long spin went Sessions to Contact to
       About with Contact on screen for under a second. A pause is
       300ms, and a second for the first notch here: the page mounting
       under the spin stalls it. Only for a page a spin or a drag led
       to; one reached from the bar owes nothing to a wheel. */
    if (!paused) {
      if (!nav.arriveDir || gap > (before > m.arrived ? 300 : 1000)) paused = true;
      else m.arrived = performance.now();
    }
    /* The tail of the push that brought the page here. A trackpad keeps
       sending momentum after the strip has led on, and those notches
       land on the strip that has just arrived: measured on Contact
       pushed back to About, the page landed at its end as it should and
       then paged itself straight back to the start, on a notch that came
       560ms after the mount. So for the first second, a push the same
       way as the one that led here is that push still running out, and
       is dropped; the other way is a new decision and goes through. Not
       under Lenis, which has the wheel there. */
    if (
      !lenisWheel &&
      nav.arriveDir !== 0 &&
      Math.sign(raw) === nav.arriveDir &&
      performance.now() - m.arrived < 1000
    ) {
      e.preventDefault();
      return;
    }
    /* Something inside a cell that scrolls on its own gets the wheel
       first: a form's box until it has run out, a textarea and a select
       always. A strip that took the wheel over a form would move the
       page out from under the words being typed. */
    const inner =
      sideways || (!fresh && owned)
        ? null
        : (e.target as Element | null)?.closest?.<HTMLElement>(
            "textarea, select, [data-scroll]",
          );
    if (inner && el.contains(inner)) {
      owned = false;
      // A textarea or a select keeps the wheel whatever it holds. A
      // marked box gives it back once it has run out, whatever element
      // it happens to be: the contact page's details are a `dl` and the
      // studio's services a `ul`, and a tag-name test left both of them
      // holding the wheel for good.
      if (!inner.hasAttribute("data-scroll")) return;
      const more =
        e.deltaY < 0
          ? inner.scrollTop > 0
          : inner.scrollTop + inner.clientHeight < inner.scrollHeight - 1;
      if (more) return;
    }
    owned = true;
    // Firefox can report lines rather than pixels.
    const dy = e.deltaMode === 1 ? raw * LINE : raw;
    /* Measured against the quietest the stream has been since its peak,
       not against the event before it. A new push and the tail it lands
       on arrive interleaved - macOS keeps the old fling coming for a
       moment after the fingers are down again - so the event before
       this one may belong to either, and a rule that reads it compares
       a push against a fling. The trough belongs to the fling alone,
       because a fling only ever gets quieter. Twice it, and at least
       six, is a hand: momentum comes in whole pixels and jitters by
       one, and a push that is still climbing never sees a trough at all
       because the trough is only taken once the stream is under half
       its peak. */
    const mag = Math.abs(dy);
    if (fresh) {
      peak = 0;
      trough = Infinity;
    }
    again = mag >= 6 && mag > trough * 2 && trough < peak / 2;
    if (again) {
      peak = mag;
      trough = Infinity;
    } else {
      peak = Math.max(peak, mag);
      if (mag < peak / 2) trough = Math.min(trough, mag);
    }

    /* By where the strip is, not where it is heading: a notch that lands
       while the strip is still gliding up to the end aims it there and
       no further, and only once it has got there does the next one pull
       the band. That tail of the glide is the beat between arriving and
       asking to leave, and it comes free with the friction. */
    if (dy > 0 ? el.scrollLeft >= m.room() - 1 : el.scrollLeft <= 0) {
      /* A page that can still scroll vertically goes first, in both
         directions: a project strip on a phone has its footer below it.
         From 40rem up a strip page cannot scroll at all (`globals.css`),
         so neither of these is ever true there. */
      if (!sideways && dy < 0 && window.scrollY > 0) {
        owned = false;
        return;
      }
      if (
        !sideways &&
        dy > 0 &&
        document.documentElement.scrollHeight -
          window.innerHeight -
          window.scrollY >
          1
      ) {
        owned = false;
        return;
      }
      owned = true;
      e.preventDefault();
      // Nowhere to go that way: the wall. A swipe knocks once; a
      // mouse's notch is a knock of its own.
      if (!(dy > 0 ? m.nextHref : m.prevHref)) {
        if (fresh || again || Math.abs(dy) >= 80) band.bounce(dy > 0 ? 1 : -1, Math.abs(dy));
        return;
      }
      band.push(dy);
      // Past the end, on; past the start, back. Julian asked for both.
      if (m.over >= band.after(1)) band.leave(1);
      if (m.over <= -band.after(-1)) band.leave(-1);
      return;
    }
    // A notch the other way lets go of the band, and of the count.
    if (m.over) {
      m.over = 0;
      band.release();
    }
    /* A trackpad, where Lenis has the notches: the strip follows the
       fingers event by event, at the trackpad's gain, with macOS's own
       momentum and nothing eased on top. No frame loop and one write per
       event. A paged strip lands once the stream rests (`settle`, with
       Lenis). */
    if (m.smooth && padGesture.get(el)) {
      e.preventDefault();
      el.scrollLeft = Math.max(0, Math.min(m.room(), el.scrollLeft + dy * PAD));
      return;
    }
    /* Away from the ends, Lenis has the wheel. Nothing is prevented and
       nothing is aimed: its own listener moves the scroller, and this
       handler has already done the only part it keeps. */
    if (lenisWheel) return;
    e.preventDefault();
    /* Paged: the gesture means the next screen, whatever its size. A
       trackpad sends a stream of small deltas for one swipe and a mouse
       one large notch for one turn, so the move is locked for as long as
       it takes to land - otherwise a single swipe would fly through four
       sections. */
    if (m.paged) {
      const now = performance.now();
      const notch = Math.abs(dy) >= 80;
      if (now < locked && !again) {
        if (!notch) locked = now + SWIPE_LOCK;
        return;
      }
      locked = now + (notch ? NOTCH_LOCK : SWIPE_LOCK);
      const last = el.children.length - 1;
      const where = centreOf(
        el,
        Math.max(0, Math.min(last, m.nearest(m.target) + (dy > 0 ? 1 : -1))),
      );
      if (where !== null) m.to(where);
      return;
    }
    m.to(m.target + dy * (Math.abs(dy) >= 80 ? WHEEL : PAD));
  };
}

