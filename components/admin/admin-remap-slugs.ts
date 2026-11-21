import type { Draft } from "@/lib/admin/publish";

/* ── a rename, carried through ────────────────────────────────────
 * Every override this editor holds is keyed by slug, and while the page
 * is open every row still wears the slug it was built with. So the draft
 * keeps its keys where the rows can find them, and the *published* draft
 * is this one: each key a rename applies to, moved under the new slug on
 * the way out. Idempotent - once the site has deployed the rename the
 * rows wear the new slug, the old key is absent, and there is nothing to
 * move - so it runs on every publish rather than remembering whether it
 * has. `lib/work/work.ts` renames first in its pipeline for the same reason:
 * the new slug is the one identity, and a renamed project is never two.
 * ─────────────────────────────────────────────────────────────── */
export function remapSlugs(draft: Draft, slugs: Record<string, string>): Draft {
  const renames = Object.entries(slugs).filter(([from, to]) => from !== to);
  if (!renames.length) return draft;
  const moveKeys = <T,>(map: Record<string, T>): Record<string, T> => {
    const next = { ...map };
    for (const [from, to] of renames) {
      if (from in next && !(to in next)) {
        next[to] = next[from];
        delete next[from];
      }
    }
    return next;
  };
  const moveList = (list: string[]): string[] =>
    list.map((s) => slugs[s] && slugs[s] !== s ? slugs[s] : s);
  return {
    ...draft,
    hidden: moveList(draft.hidden),
    unlisted: moveList(draft.unlisted),
    categories: moveKeys(draft.categories),
    frames: moveKeys(draft.frames),
    credits: moveKeys(draft.credits),
    copy: moveKeys(draft.copy),
    bts: moveKeys(draft.bts),
    order: moveList(draft.order),
  };
}
