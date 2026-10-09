import * as React from "react";

/* ── what kind of window ──────────────────────────────────────────
 * The media queries the strip answers to, as hooks.
 * ─────────────────────────────────────────────────────────────── */

/** Where a strip stops being a strip. Under this the cells of a stacking
    page run down the screen and the machine is off; the value is the
    `sm` breakpoint, the same one `globals.css` unlocks the page at. */
const WIDE = "(min-width: 40rem)";
const subscribeWide = (onChange: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
export const useWide = () =>
  React.useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    // The server draws the wide page; a phone corrects itself on hydration.
    () => true,
  );
/** A touch screen with room, held upright: an iPad. Its grid is a sheet that runs down
    (Julian, 2026-10-08: the rack's covers were too small there, 210px
    across. Landscape keeps the rack sideways, Julian asked). */
const TABLET = "(pointer: coarse) and (min-width: 40rem) and (orientation: portrait)";
const subscribeTablet = (onChange: () => void) => {
  const mq = window.matchMedia(TABLET);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
export const useTablet = () =>
  React.useSyncExternalStore(
    subscribeTablet,
    () => window.matchMedia(TABLET).matches,
    () => false,
  );
/** The same question for what the page fetches, answered the other way
    round on the server: a frame marked eager in the HTML is requested as
    the parser meets it, before any script can take it back, so the HTML
    says lazy and a wide window turns the rest eager as it hydrates. A
    phone, where the page stacks ten screens tall, keeps them lazy. */
export const useWideNow = () =>
  React.useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );

/** A landscape window with room in it: where the ruler runs in chapters.
    It asked for a mouse as well, because a chapter only opened under a
    hover and a finger has none. It no longer needs one: the chapter you
    are standing in is open from the start and the rest are opened by
    dragging along the rail, which a finger does. Without this an iPad
    drew All work as a hundred and seventy seven ticks five pixels wide.
    A portrait window still has no width to open a chapter into, and
    neither has a phone held sideways. */
const DESK = "(min-aspect-ratio: 5 / 4) and (min-width: 48rem)";
const subscribeDesk = (onChange: () => void) => {
  const mq = window.matchMedia(DESK);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
export const useDesk = () =>
  React.useSyncExternalStore(
    subscribeDesk,
    () => window.matchMedia(DESK).matches,
    // The plain ruler on the server, and a desktop swaps to chapters on
    // hydration. It is `aria-hidden` decoration either way, so nothing a
    // reader is holding on to moves under it.
    () => false,
  );
