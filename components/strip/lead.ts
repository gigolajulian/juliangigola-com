import { openFrom } from "@/components/lead-window";
import { filterPaths } from "@/lib/utils";
import type { Mover } from "./motion";
import { DEAL_MS, markFilter, nav } from "./shared";

/** Preview (`?cards`): the next discipline's card comes over this one
    under the hand, as the chapters do on All, rather than on its own in 640ms.
    Once the push past the end has led on, the trip's own animations
    (`jg-deal-*` in `globals.css`) are held and run by the wheel, six tenths of
    a screen of wheel to cover it, and play out once the wheel goes quiet. The
    navigation has already happened, so wheeling back slides the card back but
    cannot undo it; quiet, it finishes.

    A swipe that led on (`touchX`, where the finger is) drives it the
    same way for as long as the finger stays down, and it plays out on
    the lift. A touch's events go to the element the finger came down on,
    which leaves the page with the strip it was in, and a node out of the
    page does not pass them up to the window: they are listened for on
    that element (`touch`). Should they stop anyway, it plays out after
    three seconds still. */
function scrubDeal(
  dir: 1 | -1,
  touch: { x: number; on: EventTarget } | null = null,
) {
  const span = window.innerWidth * 0.6;
  let p = 0;
  let quiet = 0;
  let raf = 0;
  const trip = () =>
    document
      .getAnimations()
      .filter((a) =>
        (a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition"),
      );
  const end = () => {
    window.removeEventListener("wheel", onWheel, true);
    touch?.on.removeEventListener("touchmove", onTouch as EventListener);
    touch?.on.removeEventListener("touchend", end);
    touch?.on.removeEventListener("touchcancel", end);
    cancelAnimationFrame(raf);
    window.clearTimeout(quiet);
    for (const a of trip()) a.play();
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    const d =
      (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) *
      (e.deltaMode === 1 ? 40 : 1);
    p = Math.min(1, Math.max(0, p + (d * dir) / span));
    window.clearTimeout(quiet);
    if (p >= 1) return end();
    quiet = window.setTimeout(end, 180);
  };
  let lastX = touch?.x ?? 0;
  const onTouch = (e: TouchEvent) => {
    const x = e.touches[0]?.clientX;
    if (x === undefined) return;
    p = Math.min(1, Math.max(0, p + ((lastX - x) * dir) / span));
    lastX = x;
    window.clearTimeout(quiet);
    if (p >= 1) return end();
    quiet = window.setTimeout(end, 3000);
  };
  const hold = () => {
    for (const a of trip()) {
      a.pause();
      a.effect?.updateTiming({ easing: "linear" });
      a.currentTime = p * Number(a.effect?.getComputedTiming().endTime ?? 0);
    }
    raf = requestAnimationFrame(hold);
  };
  raf = requestAnimationFrame(hold);
  if (touch) {
    touch.on.addEventListener("touchmove", onTouch as EventListener, { passive: true });
    touch.on.addEventListener("touchend", end);
    touch.on.addEventListener("touchcancel", end);
    quiet = window.setTimeout(end, 3000);
    return;
  }
  window.addEventListener("wheel", onWheel, { capture: true, passive: false });
  // Led on with no more wheel to come: it plays out as it always has.
  quiet = window.setTimeout(end, 400);
}

/**
 * Leads on to `href`, the page that way (`dir`), once the band has
 * decided to go (`leave` in `band.ts`). `door` says whether that end is
 * the window into the work.
 */
export function leadOn(
  m: Mover,
  dir: 1 | -1,
  href: string,
  door: (dir: 1 | -1) => boolean,
) {
  const { el } = m;
  /* Dealt at the ends (`deck="leads"`, `lib/deck.ts`): the next page's
     strip comes in as a card over this one while this one recedes,
     and backwards this one goes off the way it came and the one
     before comes up from behind. The trip is the page transition's
     (`deal` in `globals.css`); this strip names itself so it is
     snapshotted apart from the page, and the root says which way. */
  if (m.deck === "leads") {
    nav.dealtAt = Date.now();
    nav.cameBack = dir < 0 && !m.prevStart;
    nav.arriveDir = dir;
    el.style.setProperty("view-transition-name", "strip");
    const root = document.documentElement;
    root.dataset.nav = "deal";
    root.dataset.navWay = dir > 0 ? "on" : "back";
    /* The strip that arrives takes this off when its trip lands. This
       is only for a push that never lands. */
    window.setTimeout(() => {
      if (root.dataset.nav !== "deal") return;
      delete root.dataset.nav;
      delete root.dataset.navWay;
    }, DEAL_MS);
    if ("cards" in root.dataset)
      scrubDeal(dir, m.touchX !== null && m.touchOn ? { x: m.touchX, on: m.touchOn } : null);
    m.go(href);
    return;
  }
  /* Places to Motion was a page leaving and a page arriving: the strip
     slid off, and for the 260ms it took the screen was bare paper -
     measured on production, mean brightness at 235.8 with nothing on
     it from 457ms to 718ms. Between two filters the head and the chip
     row do not change, so there is nothing to leave: the row is
     swapped where it stands, the way a chip press does it, and the
     push goes out at once. */
  const index = filterPaths();
  if (index.has(window.location.pathname) && index.has(href)) {
    markFilter(dir);
    nav.cameBack = dir < 0 && !m.prevStart;
    nav.arriveDir = dir;
    m.go(href);
    return;
  }
  /* Julian: keep the stack when scrolling past a page into the next
     one. Any other page is dealt whole, as the bar deals it (`nav-side`
     in `globals.css`): the next page in as a card from the right over
     this one, which recedes, and back the one before from the left.
     Only the strip, as on the work's pages, left the next page's head
     popping in over this one (home into the work index, Julian: very
     glitchy). The arrival clears it (`page-transition.tsx`). */
  nav.cameBack = dir < 0 && !m.prevStart;
  nav.arriveDir = dir;
  const root = document.documentElement;
  root.dataset.nav = "in";
  /* The window into the work, opened the rest of the way from where
     the pull left it, and back from the work the door shutting into
     the homepage's right edge (`lead-window.tsx`). */
  if (door(dir)) {
    if (dir > 0 && m.win) openFrom(m.win);
    root.dataset.navSide = dir > 0 ? "open" : "shut";
    window.setTimeout(() => {
      if (root.dataset.navSide === undefined) return;
      delete root.dataset.nav;
      delete root.dataset.navSide;
    }, DEAL_MS);
    m.go(href);
    return;
  }
  /* Julian: back is the stack scrolled backwards, so this page, the
     card on top, goes off to the right and the one before comes up
     from behind (`back` in `globals.css`), not in over it from the
     left as the bar deals it. */
  root.dataset.navSide = dir > 0 ? "right" : "back";
  window.setTimeout(() => {
    if (root.dataset.navSide === undefined) return;
    delete root.dataset.nav;
    delete root.dataset.navSide;
  }, DEAL_MS);
  m.go(href);
}
