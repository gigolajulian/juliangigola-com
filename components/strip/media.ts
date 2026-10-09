import { useDevice } from "@/lib/device";

/* ── what kind of window ──────────────────────────────────────────
 * The media queries the strip answers to, as hooks.
 * ─────────────────────────────────────────────────────────────── */

/** Where a strip stops being a strip. Under this the cells of a stacking
    page run down the screen and the machine is off; the value is the
    `sm` breakpoint, the same one `globals.css` unlocks the page at
    (`wide` in `lib/device.ts`). The server draws the wide page; a phone
    corrects itself on hydration. */
export const useWide = () => useDevice("wide", true);
/** A touch screen with room, held upright: an iPad. Its grid is a sheet that runs down
    (Julian, 2026-10-08: the rack's covers were too small there, 210px
    across. Landscape keeps the rack sideways, Julian asked). */
export const useTablet = () => useDevice("tabletUpright");
/** The same question for what the page fetches, answered the other way
    round on the server: a frame marked eager in the HTML is requested as
    the parser meets it, before any script can take it back, so the HTML
    says lazy and a wide window turns the rest eager as it hydrates. A
    phone, where the page stacks ten screens tall, keeps them lazy. */
export const useWideNow = () => useDevice("wide");

/** A landscape window with room in it: where the ruler runs in chapters.
    It asked for a mouse as well, because a chapter only opened under a
    hover and a finger has none. It no longer needs one: the chapter you
    are standing in is open from the start and the rest are opened by
    dragging along the rail, which a finger does. Without this an iPad
    drew All work as a hundred and seventy seven ticks five pixels wide.
    A portrait window still has no width to open a chapter into, and
    neither has a phone held sideways. The plain ruler on the server, and
    a desktop swaps to chapters on hydration. It is `aria-hidden`
    decoration either way, so nothing a reader is holding on to moves
    under it. */
export const useDesk = () => useDevice("desk");
