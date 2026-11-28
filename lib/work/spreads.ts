import SEED from "@/lib/work/spreads.json";

/* Edited project spreads (design system preview, DESIGN.md "No Singles"). A project page is its frames in
   the site's order, cut into blocks: the hero (always frame 1), then pairs, rows of three and fulls.
   The layouts are Julian's hand picks, not rules. One letter per block after the hero: f full, p pair,
   r row. "pfr" on a 7-frame set reads hero | pair 2·3 | full 4 | row 5·6·7. There is no single.

   lib/work/spreads.json holds the picks by slug. A project with no entry, or whose entry no longer
   covers its frames (a photo was added or removed since), keeps today's layout: nothing is dropped
   and nothing breaks. */

export type SpreadKind = "pair" | "row" | "full";
/** A block after the hero; `frames` are indexes into the project's images. */
export type SpreadBlock = { kind: SpreadKind; frames: number[] };

const KIND: Record<string, [SpreadKind, number]> = { f: ["full", 1], p: ["pair", 2], r: ["row", 3] };

/** The blocks for a code, or null unless the code covers frames 2 to `count` exactly, once each, in order. */
export function spreadBlocks(code: string | null | undefined, count: number): SpreadBlock[] | null {
  if (!code || count < 2) return null;
  const blocks: SpreadBlock[] = [];
  let at = 1;
  for (const ch of code) {
    const k = KIND[ch];
    if (!k) return null;
    blocks.push({ kind: k[0], frames: Array.from({ length: k[1] }, (_, i) => at + i) });
    at += k[1];
  }
  return at === count ? blocks : null;
}

/** The code back from blocks (the admin's arrange control writes this). */
export const spreadCode = (blocks: SpreadBlock[]): string => blocks.map((b) => b.kind[0]).join("");

export const SPREAD_SEED: Record<string, string> = SEED;

/** A project's blocks: its override if it has one that fits, else the hand pick, else null (today's layout). */
export const spreadFor = (slug: string, count: number, override?: string | null): SpreadBlock[] | null =>
  spreadBlocks(override, count) ?? spreadBlocks(SPREAD_SEED[slug], count);
