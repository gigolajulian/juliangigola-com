/**
 * Lift and insert: `items` with the one keyed `from` taken out and put where
 * the one keyed `to` is. A forward move lands after `to`, a backward one
 * before it, so a drop always puts the dragged item on the spot it was
 * dropped on. Null when nothing moves: the same key, or a key not in the list.
 */
export function moveBefore<T>(items: readonly T[], from: string, to: string, keyOf: (item: T) => string): T[] | null {
  if (from === to) return null;
  const next = [...items];
  const at = next.findIndex((x) => keyOf(x) === from);
  const onto = next.findIndex((x) => keyOf(x) === to);
  if (at === -1 || onto === -1) return null;
  const [held] = next.splice(at, 1);
  // The target is found again after the removal: taking the dragged item out
  // shifts everything after it, so the index read before the splice is one
  // too high for any forward move.
  next.splice(next.findIndex((x) => keyOf(x) === to) + (onto > at ? 1 : 0), 0, held);
  return next;
}
