import data from "./frame-twins.json";

/* ── near-twin frames, for the sequence editor ────────────────────
 * `frame-twins.json` holds CLIP ViT-B-32 cosine scores for every pair of
 * frames in a set that scored 0.80 or more, keyed by image src so a
 * reorder never breaks it. Regenerated offline with the scripts in
 * `frame-twins-data/` (clip.py, sheet.py); nothing here runs a model.
 *
 * Two readings of it, both on the sequence as it stands in the draft, so
 * they follow every reorder and cut:
 *  - groups: average-linkage clusters above the threshold, the same as
 *    sheet.py's groups(), lettered A, B… in order of first appearance.
 *  - back-to-back: a frame that plays straight after one it scores above
 *    the threshold with.
 * ─────────────────────────────────────────────────────────────── */

export const TWIN_THRESHOLD: number = data.threshold;

const PAIRS: Record<string, number> = Object.assign(
  {},
  ...Object.values(data.sets as Record<string, { pairs: Record<string, number> }>).map(
    (s) => s.pairs,
  ),
);

/** A pair's score. Pairs under 0.80 are not stored and read as 0.
 * ponytail: sheet.py averages the true sub-0.80 scores, so a three-frame
 * group can come out a hair stricter here; store the full matrix if a
 * group ever disagrees with the contact sheet. */
export const twinScore = (a: string, b: string): number =>
  PAIRS[`${a}|${b}`] ?? PAIRS[`${b}|${a}`] ?? 0;

const cache = new Map<string, Map<string, string>>();

/** Each frame in a near-twin group, mapped to its group's letter. */
export function twinGroups(srcs: string[]): Map<string, string> {
  const key = srcs.join("\n");
  const hit = cache.get(key);
  if (hit) return hit;

  /* Only a frame with a partner above the threshold can join a group: an
     average of scores that are all under it stays under it. Clustering the
     few candidates keeps eighty rows of counts cheap. */
  const cand = srcs.filter((a) =>
    srcs.some((b) => b !== a && twinScore(a, b) > TWIN_THRESHOLD),
  );
  const C = cand.map((s) => [s]);
  for (;;) {
    let best: [number, number, number] | null = null;
    for (let a = 0; a < C.length; a++)
      for (let b = a + 1; b < C.length; b++) {
        let sum = 0;
        for (const i of C[a]) for (const j of C[b]) sum += twinScore(i, j);
        const s = sum / (C[a].length * C[b].length);
        if (s > TWIN_THRESHOLD && (!best || s > best[0])) best = [s, a, b];
      }
    if (!best) break;
    C[best[1]].push(...C.splice(best[2], 1)[0]);
  }

  const order = new Map(srcs.map((s, i) => [s, i]));
  const out = new Map<string, string>();
  C.filter((g) => g.length > 1)
    .map((g) => g.sort((x, y) => order.get(x)! - order.get(y)!))
    .sort((x, y) => order.get(x[0])! - order.get(y[0])!)
    .forEach((g, n) => g.forEach((s) => out.set(s, String.fromCharCode(65 + n))));
  cache.set(key, out);
  return out;
}

/** Frames that play straight after a frame they score above the threshold
 * with. An empty src (a passage) breaks the run: text sits between them. */
export function backToBack(srcs: string[]): Set<string> {
  const out = new Set<string>();
  srcs.forEach((s, i) => {
    const prev = srcs[i - 1];
    if (s && prev && twinScore(prev, s) > TWIN_THRESHOLD) out.add(s);
  });
  return out;
}

/** Twins left (frames past the first in each group) and back-to-back pairs. */
export function twinStats(srcs: string[]) {
  const photos = srcs.filter(Boolean);
  const groups = twinGroups(photos);
  return {
    twins: groups.size - new Set(groups.values()).size,
    backToBack: backToBack(srcs).size,
  };
}
