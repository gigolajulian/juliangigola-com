import * as React from "react";

/* ── what kind of device ──────────────────────────────────────────
 * The pointer and window queries the scripts ask, in one place. They are
 * the queries listed at the top of `app/globals.css`, written the same
 * way, so a script and a stylesheet never disagree about a device.
 *
 * `MEDIA` names each query. `media()` gives its MediaQueryList, for code
 * that listens for a change itself; `matches()` answers it once; and
 * `useDevice()` is the hook, which follows it as the window changes.
 * ─────────────────────────────────────────────────────────────── */

export const MEDIA = {
  /** A mouse or trackpad: something that hovers and aims finely. */
  fine: "(hover: hover) and (pointer: fine)",
  /** A touch screen with room: an iPad, either way up. */
  tablet: "(pointer: coarse) and (min-width: 40rem)",
  /** The same, held upright. */
  tabletUpright: "(pointer: coarse) and (min-width: 40rem) and (orientation: portrait)",
  /** The same, held sideways. */
  tabletSideways: "(pointer: coarse) and (min-width: 40rem) and (orientation: landscape)",
  /** A phone, either way up (the older spelling, as the rules that match it). */
  phone: "(max-width: 39.99rem)",
  /** A phone held upright. */
  phoneUpright: "(max-width: 39.99rem) and (orientation: portrait)",
  /** Tablet and up: the `sm` breakpoint, where a strip becomes a strip. */
  wide: "(min-width: 40rem)",
  /** The `lg` breakpoint, where the sidebar and the chip row appear. */
  large: "(min-width: 64rem)",
  /** A landscape window with room in it, where the ruler runs in chapters. */
  desk: "(min-aspect-ratio: 5 / 4) and (min-width: 48rem)",
} as const;

export type Device = keyof typeof MEDIA;

/** The MediaQueryList for a query, to listen to. */
export const media = (name: Device) => window.matchMedia(MEDIA[name]);

/** Whether the query matches now. */
export const matches = (name: Device) => media(name).matches;

/* One subscribe function per query, so `useSyncExternalStore` sees the
   same function on every render and does not resubscribe. */
const subscribers = new Map<Device, (onChange: () => void) => () => void>();
const subscribe = (name: Device) => {
  let fn = subscribers.get(name);
  if (!fn) {
    fn = (onChange) => {
      const mq = media(name);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    };
    subscribers.set(name, fn);
  }
  return fn;
};

/** Whether the query matches, kept current as the window changes. The
    server has no window, so it answers `server`, and the client corrects
    itself on hydration. */
export const useDevice = (name: Device, server = false) =>
  React.useSyncExternalStore(
    subscribe(name),
    () => matches(name),
    () => server,
  );
