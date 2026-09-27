/* A plain module, not the client component's, so the cover (a server
   component) gets the values and the "Hero layout" panel
   (`hero-dials.tsx`) starts from the same ones. */

/** Where each frame sits: left and top as a share of the cover, width in
    vw; each keeps its own photograph's proportions. Julian: laid out like
    basis's cover, his reference: upright cards in a loose, staggered field
    with room between them, some running off the edges, the middle left
    clear for the name. A little depth each (`z`, pixels toward the
    viewer) so the pointer moves them apart. The six with a `phone` place
    are the ones a phone shows, above and below the name. Places, widths
    and depths set by Julian on the "Hero layout" panel. */
export const SLOTS: {
  x: number;
  y: number;
  w: number;
  z: number;
  phone?: [number, number];
}[] = [
  { x: 14.5, y: 10, w: 12, z: 13, phone: [4, 8] },
  { x: 73.5, y: 12.5, w: 13, z: 30, phone: [68, 9] },
  { x: 31.5, y: 0.5, w: 12, z: -2, phone: [37, 3] },
  { x: 72.5, y: 57, w: 12, z: 50, phone: [68, 73] },
  { x: 20.5, y: 61, w: 12, z: 80, phone: [6, 74] },
  { x: 51, y: 4.5, w: 13, z: -50, phone: [37, 80] },
  { x: 86.5, y: 41.5, w: 12, z: -10 },
  { x: 35.5, y: 67, w: 12, z: 45 },
  { x: 2.5, y: 38.5, w: 13.5, z: 40 },
  { x: 55, y: 70, w: 13.5, z: -25 },
];

/** Which place each photograph takes, in the order the cover lists them:
    the first photograph at `SLOTS[DEAL[0]]`, and so on. The "Hero layout"
    panel's Shuffle deals them again. */
export const DEAL: number[] = SLOTS.map((_, i) => i);
