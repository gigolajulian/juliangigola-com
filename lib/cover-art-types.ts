/**
 * The shape of the cover-art set.
 *
 * Kept separate from `cover-art-data.ts` because that file is generated and
 * gets overwritten by `scripts/cover-art.mjs`.
 */

import type { Frame } from "./work-types";

/**
 * A frame of a sleeve.
 *
 * `thumb` is the copy the grids use. A static host has no image optimiser, so
 * the only way a 285px cell does not download a 1600px master is to point it
 * at a smaller file — `src` stays the full-size one, for the lightbox.
 *
 * `side` is set only where a release has more than one.
 */
export type CoverFrame = Frame & { thumb: string; side: string | null };

export type CoverRelease = {
  slug: string;
  title: string;
  artist: string;
  /**
   * One frame for a single square cover; two for a sleeve with a front and a
   * back, which the grid shows as one double-wide cell rather than two
   * unrelated squares.
   */
  frames: CoverFrame[];
};
