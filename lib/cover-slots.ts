/* A plain module, not the client component's, so the cover (a server
   component) gets the values and the "Photo layout" panel
   (`hero-dials.tsx`) starts from the same ones. */

/** Where each frame sits: left and top as a share of the cover, width in
    vw; each keeps its own photograph's proportions. Julian: laid out like
    basis's cover, his reference: upright cards in a loose, staggered field
    with room between them, some running off the edges, the middle left
    clear for the name. A little depth each (`z`, pixels toward the
    viewer) so the pointer moves them apart. Places, widths and depths set
    by Julian on the "Photo layout" panel. Screens 1280px wide and up;
    the smaller ones and phones have their own, below. */
export const SLOTS: {
  x: number;
  y: number;
  w: number;
  z: number;
}[] = [
  { x: 17.5, y: 12.5, w: 12, z: -19 },
  { x: 68.5, y: 13, w: 10.5, z: 30 },
  { x: 33.5, y: 7, w: 11, z: -10 },
  { x: 53.5, y: 73, w: 9.5, z: 16 },
  { x: 23, y: 61.5, w: 11.5, z: 25 },
  { x: 50.5, y: 11, w: 9.5, z: -26 },
  { x: 83, y: 37, w: 12, z: -10 },
  { x: 37.5, y: 72, w: 9.5, z: 27 },
  { x: 5.5, y: 39.5, w: 13.5, z: 45 },
  { x: 64.5, y: 59, w: 12.5, z: -47 },
];

/** A place in one of the smaller screens' own layouts: left, top, width
    in vw and depth as `SLOTS` has them, and whether the card shows. */
export type Place = { x: number; y: number; w: number; z: number; show: boolean };

/* Julian: the arrangement was not the best on smaller screens, so each
   shape gets its own. `UPRIGHT` is a tablet held upright, `LANDSCAPE` a
   short landscape screen, both from 640 to 1279px wide (`globals.css`);
   1280 and up keeps `SLOTS`. Each starts from the large layout: two cards
   dropped, the rest larger, spread wider when upright. Set on the
   "Photo layout, upright" and "Photo layout, landscape" panels. */
export const UPRIGHT: Place[] = [
  { x: 20, y: 16.5, w: 18.5, z: 13, show: true },
  { x: 69, y: 13.5, w: 20, z: 30, show: true },
  { x: 28.5, y: 0.5, w: 18.5, z: -2, show: false },
  { x: 64.5, y: 67, w: 18.5, z: 50, show: true },
  { x: 21, y: 66.5, w: 18.5, z: 80, show: true },
  { x: 42.5, y: 6.5, w: 20, z: -50, show: true },
  { x: 81, y: 42, w: 18.5, z: 5, show: true },
  { x: 43, y: 74.5, w: 18.5, z: 45, show: true },
  { x: 3.5, y: 41.5, w: 17.5, z: 40, show: true },
  { x: 56, y: 70, w: 21, z: -25, show: false },
];
export const LANDSCAPE: Place[] = [
  { x: 16, y: 13, w: 13.5, z: 24, show: true },
  { x: 76.5, y: 7, w: 14.5, z: 30, show: true },
  { x: 31.5, y: 0.5, w: 13.5, z: -2, show: false },
  { x: 43.5, y: 77.5, w: 13, z: 50, show: true },
  { x: 22.5, y: 73.5, w: 13.5, z: 28, show: true },
  { x: 42.5, y: 5, w: 14.5, z: -18, show: true },
  { x: 82, y: 45.5, w: 13.5, z: 59, show: true },
  { x: 67.5, y: 74, w: 13.5, z: 45, show: true },
  { x: 5.5, y: 46.5, w: 15, z: 38, show: true },
  { x: 55, y: 70, w: 15, z: -25, show: false },
];

/** A phone, under 640px wide: six cards above and below the name, pushed
    to the ends so a short phone's window keeps them clear of it. Width in
    vw, held to the same share of the window's height a short phone allows
    (28vw is 13svh; `globals.css`). On "Photo layout, phone". */
export const PHONE: Place[] = [
  { x: 10.5, y: 22.5, w: 28, z: -1, show: true },
  { x: 68, y: 21, w: 28, z: 38, show: true },
  { x: 35.5, y: 8, w: 31.5, z: 61, show: true },
  { x: 40.5, y: 76, w: 30, z: 52, show: true },
  { x: 10, y: 67.5, w: 31, z: 27, show: true },
  { x: 69, y: 68, w: 28, z: 3, show: true },
  { x: 50, y: 40, w: 28, z: -10, show: false },
  { x: 50, y: 40, w: 28, z: 45, show: false },
  { x: 50, y: 40, w: 28, z: 40, show: false },
  { x: 50, y: 40, w: 28, z: -25, show: false },
];

/** A phone on its side, or any landscape window under 512px tall: an
    iPhone at 844 by 390, the iPhone Duo folded and turned (678 by 466).
    Starts from the large layout with smaller cards and three dropped. On
    "Photo layout, sideways". */
export const SIDEWAYS: Place[] = [
  { x: 13, y: 50, w: 9.5, z: 72, show: true },
  { x: 74, y: 11, w: 10.5, z: -20, show: true },
  { x: 31.5, y: 0.5, w: 9.5, z: -2, show: false },
  { x: 18, y: 11, w: 9.5, z: 43, show: true },
  { x: 23, y: 72.5, w: 9.5, z: 86, show: true },
  { x: 72.5, y: 69, w: 10.5, z: -50, show: true },
  { x: 81.5, y: 44, w: 9.5, z: 16, show: true },
  { x: 35.5, y: 67, w: 9.5, z: 45, show: false },
  { x: 2.5, y: 38.5, w: 11, z: 40, show: false },
  { x: 55, y: 70, w: 11, z: -25, show: false },
];

/** A big screen that is wide and short, 1.75 to 2.2 to 1 (a laptop at
    1515 by 785 with the browser's bars, Julian, 2026-10-07): the large
    field ran its bottom row under the rail there. Arranged by Julian in
    the 3D view on "Photo layout, wide short" (`?arrange`), 2026-10-07. */
export const SHORT: Place[] = [
  { x: 20.5, y: 15, w: 11.5, z: 85, show: true },
  { x: 48.5, y: 12, w: 9.5, z: 65, show: true },
  { x: 33, y: 12, w: 10, z: 3, show: true },
  { x: 51, y: 78, w: 9, z: 47, show: true },
  { x: 21.5, y: 62.5, w: 11.5, z: 129, show: true },
  { x: 64, y: 13.5, w: 10.5, z: 108, show: true },
  { x: 77.5, y: 38, w: 12, z: 58, show: true },
  { x: 35, y: 72.5, w: 8.5, z: 95, show: true },
  { x: 6.5, y: 41, w: 13.5, z: 52, show: true },
  { x: 65, y: 68, w: 11.5, z: 8, show: true },
];

/** Which place each photograph takes, in the order the cover lists them:
    the first photograph at `SLOTS[DEAL[0]]`, and so on. The "Photo layout"
    panel's Shuffle deals them again. */
export const DEAL: number[] = SLOTS.map((_, i) => i);

/** Julian: the middle (name, role, location and buttons) sized and moved
    for each screen shape, arranged by hand like the cards. Sizes are a
    share of the cover's own (1: as it is); the move is in vw across and
    svh down. `globals.css` picks the set by the same queries as the cards. */
export type Middle = { name: number; role: number; where: number; buttons: number; x: number; y: number };
export const MIDDLE: Record<"large" | "short" | "upright" | "landscape" | "sideways" | "phone", Middle> = {
  large: { name: 1.04, role: 1, where: 1, buttons: 1, x: 0, y: 3 },
  short: { name: 1.04, role: 1, where: 1, buttons: 1, x: 0, y: 3 },
  upright: { name: 1.08, role: 1.08, where: 1.1, buttons: 1, x: 0, y: 0 },
  landscape: { name: 0.98, role: 1.08, where: 1.2, buttons: 1, x: 0, y: 5 },
  sideways: { name: 1, role: 1.08, where: 1.14, buttons: 0.84, x: 0, y: 3.5 },
  phone: { name: 1.38, role: 0.98, where: 1.12, buttons: 0.88, x: 0, y: -0.5 },
};

/** Every set as variables for the cover: `--m-phone-name` and so on. */
export const middleVars = (sets: Record<string, Middle>) =>
  Object.fromEntries(
    Object.entries(sets).flatMap(([shape, m]) =>
      Object.entries(m).map(([k, v]) => [`--m-${shape}-${k}`, `${v}`]),
    ),
  );
