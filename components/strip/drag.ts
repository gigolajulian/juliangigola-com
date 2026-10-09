import type { Band } from "./band";
import { TAU, type Mover } from "./motion";
import { centreOf, LEAVE_TOUCH } from "./shared";

/* Drag, for a mouse only. A touchscreen is left to the platform: its
   own flick and momentum, and on a paged strip the browser's scroll
   snap (`strip-paged` in `globals.css`) lands each swipe on a section.
   The first version took the finger over on paged pages and moved it
   one section per swipe by hand; on an iPad that fought the
   browser's own idea of the gesture and swipes went wrong more often
   than right.

   `m.held` is how many fingers are on the glass. `m.down` is a mouse's
   only - the drag is for a mouse and hands the touchscreen to the
   platform - so nothing here knew a finger was still on the strip. The
   settle (`onSettle`) is armed by the scroll events a swipe makes and
   fires 160ms after the last one: hold still mid-swipe without lifting
   and it re-centred the strip under the hand. That is the jump on the
   iPad. */
export function dragHandlers(m: Mover, band: Band, onSettle: () => void) {
  const { el } = m;
  let fromX = 0;
  let fromScroll = 0;
  let lastX = 0;
  let lastAt = 0;
  let speed = 0;

  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    // A field is for typing and selecting in, not for pulling the page.
    const at = e.target as Element | null;
    if (at?.closest?.("input, textarea, select, label")) return;
    /* A `[data-scroll]` box is not excluded as a whole. It used to be, and
       the Biography panel on /about is one box from edge to edge, so a
       drag back to the first panel only took from its margins: Julian
       found it buggy. The wheel is what the box scrolls with; a mouse
       pulling sideways means the strip. Only a press on the box's own
       scrollbar is left to the box. */
    if (
      at instanceof HTMLElement &&
      at.hasAttribute("data-scroll") &&
      e.offsetX >= at.clientWidth
    ) {
      return;
    }
    m.down = true;
    m.dragging = false;
    m.size();
    m.stop();
    fromX = lastX = e.clientX;
    fromScroll = el.scrollLeft;
    lastAt = e.timeStamp;
    speed = 0;
    delete el.dataset.dragged;
  };

  const onMove = (e: PointerEvent) => {
    if (!m.down) return;
    const dt = e.timeStamp - lastAt;
    // px per ms, positive when the sequence is being pulled leftwards.
    if (dt > 0) speed = (lastX - e.clientX) / dt;
    lastX = e.clientX;
    lastAt = e.timeStamp;
    const want = fromScroll - (e.clientX - fromX);
    m.target = m.clamp(want);
    el.scrollLeft = m.target;
    // Whatever the clamp refused is the band: pull past an end and it
    // gives, and holds where the hand holds it while the loop is stopped.
    band.push(want - m.target - m.over);

    /* Past a few pixels this is a drag rather than a press, and two
       things change. The frame under the pointer must not open when the
       button comes back up. And the pointer is captured, so a hand that
       leaves the strip mid-pull keeps pulling it.

       Capture only from here, never on the press itself: capturing
       retargets the compatibility mouse events too, so the `click` that
       follows is delivered to the scroller instead of the frame - which
       is exactly how the first version of this stopped the lightbox from
       opening at all. */
    if (!m.dragging && Math.abs(e.clientX - fromX) > 4) {
      m.dragging = true;
      el.dataset.dragged = "";
      el.setPointerCapture(e.pointerId);
    }
  };

  const onUp = () => {
    if (!m.down) return;
    m.down = false;
    m.dragging = false;
    // After the click that this release is about to fire, not before.
    requestAnimationFrame(() => delete el.dataset.dragged);

    // A flick keeps going: let go at a speed, the strip carries on at
    // that speed and runs out under the same friction as a notch.
    // Julian: drag to the next and the page before. Let go pulled past
    // an end as far as a finger has to, and it leads on as a swipe does.
    if (m.over >= LEAVE_TOUCH) return band.leave(1);
    if (m.over <= -LEAVE_TOUCH) return band.leave(-1);
    if (m.eased && Math.abs(speed) > 0.05) m.to(el.scrollLeft + speed * TAU);
    // Paged, a release lands on a screen rather than wherever the throw
    // ran out: the page is the unit, so it is what the hand is holding.
    if (m.eased && m.paged) {
      const where = centreOf(el, m.nearest(m.target));
      if (where !== null) m.to(where);
    }
  };

  // The browser took the pointer away mid-drag.
  const onCancel = () => {
    if (!m.down) return;
    m.down = false;
    m.dragging = false;
    requestAnimationFrame(() => delete el.dataset.dragged);
  };

  const onHold = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") m.held++;
  };
  const onLet = (e: PointerEvent) => {
    if (e.pointerType === "mouse") return;
    m.held = Math.max(0, m.held - 1);
    // The last scroll event may already have gone by; arm it again.
    if (!m.held) onSettle();
  };

  const swallowClick = (e: MouseEvent) => {
    if (el.dataset.dragged === undefined) return;
    e.preventDefault();
    e.stopPropagation();
  };

  return { onDown, onMove, onUp, onCancel, onHold, onLet, swallowClick };
}
