/* The credits fold (DESIGN.md "Credits Fold"). Credits sit on the first screen of every project.
   Four or fewer show in full. More: the model (or "In frame") first, the photo credit last, two more
   shown, the rest behind "+ N more", which opens in place. */

const FACE = /^(model|models|in frame|talent|artist|muse)\b/i;

export type Fold<T> = { shown: T[]; folded: T[]; last: T | null };

/** `credits` arrive with the photo credit already last (lib/work/work.ts `ownLast`). */
export function creditsFold<T extends { role: string }>(credits: T[]): Fold<T> {
  if (credits.length <= 4) return { shown: credits, folded: [], last: null };
  const last = credits[credits.length - 1];
  const rest = credits.slice(0, -1);
  const face = rest.find((c) => FACE.test(c.role.trim())) ?? rest[0];
  const mid = rest.filter((c) => c !== face);
  return { shown: [face, ...mid.slice(0, 2)], folded: mid.slice(2), last };
}
