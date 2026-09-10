/**
 * The shape of the cover-art set.
 *
 * Kept separate from `cover-art-data.ts` because that file is generated and
 * gets overwritten by `scripts/cover-art.mjs`.
 */

import type { Frame } from "./work-types";

/** A frame of a sleeve. `side` is set only where a release has more than one. */
export type CoverFrame = Frame & { side: string | null };

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
