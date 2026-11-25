import type { SiteContent } from "@/lib/content";
import type { Draft } from "@/lib/admin/publish";
import { sameJson, withOverride } from "@/lib/admin/admin-payload";
import { isTextRef } from "@/lib/work/added";
import { FIELD_TAB, type View } from "@/components/admin/editor/tabs";
import type { AdminEditorProps, ListDraft, Overrides } from "@/components/admin/editor/props";
import type { Bts } from "@/lib/work/work-types";

/** What the repository holds, as far as the editor knows: the content and the manifest. */
export type Baseline = { content: SiteContent; manifest: Draft };

/** One project's entry in one override map. */
export type OverrideOf<K extends keyof Overrides> = Overrides[K][string];
/** The editor's one setter for the override maps, handed to the project list and the page editor. */
export type SetOverride = <K extends keyof Overrides>(kind: K, slug: string, next: OverrideOf<K> | null) => void;

/** The overrides with one project's entry changed. Null is no edit: frames, credits and copy fall back to what is
    published (`withOverride`), a category drops its entry. A slug renamed back to its original is no rename at all. */
export function withProjectOverride<K extends keyof Overrides>(
  o: Overrides,
  kind: K,
  slug: string,
  next: OverrideOf<K> | null,
  published: Overrides,
): Overrides {
  const now = o[kind] as Record<string, OverrideOf<K>>;
  let out: Record<string, OverrideOf<K>>;
  if (kind === "frames" || kind === "credits" || kind === "copy")
    out = withOverride(now, slug, next, published[kind] as Record<string, OverrideOf<K>>);
  else {
    out = { ...now };
    if (next === null || (kind === "slugs" && next === slug)) delete out[slug];
    else out[slug] = next;
  }
  return { ...o, [kind]: out };
}

/** One project's entry in the list draft: whether it is in the set, or its BTS. */
export type ListDraftOf<K extends keyof ListDraft> = K extends "bts" ? Bts : boolean;
/** The editor's one setter for the list draft, handed to the project list. */
export type SetListDraft = <K extends keyof ListDraft>(kind: K, slug: string, next: ListDraftOf<K>) => void;

/** The list draft with one project's entry changed. A BTS with no frames and no credit is no entry, not an empty one. */
export function withListDraft<K extends keyof ListDraft>(d: ListDraft, kind: K, slug: string, next: ListDraftOf<K>): ListDraft {
  if (kind === "bts") {
    const b = next as Bts;
    const bts = { ...d.bts };
    if (!b.frames.length && !b.by) delete bts[slug];
    else bts[slug] = b;
    return { ...d, bts };
  }
  const set = new Set(d[kind as "hidden" | "unlisted"]);
  if (next) set.add(slug);
  else set.delete(slug);
  return { ...d, [kind]: set };
}

/** Which tabs hold unpublished edits, one field at a time. */
export function movedTabs(draft: SiteContent, manifest: Draft, baseline: Baseline) {
  const tabs = new Set<View>();
  for (const key of Object.keys(draft) as (keyof SiteContent)[])
    if (!sameJson(draft[key], baseline.content[key])) tabs.add(FIELD_TAB[key] ?? "home");
  for (const key of Object.keys(manifest) as (keyof Draft)[])
    if (!sameJson(manifest[key], baseline.manifest[key])) tabs.add(key === "order" || key === "covers" ? "disciplines" : "projects");
  return tabs;
}

/** The rows with unpublished edits, for the Projects filter. */
export function changedSlugs(manifest: Draft, baseline: Baseline) {
  const out = new Set<string>();
  const maps = ["categories", "frames", "credits", "copy", "slugs", "bts"] as const;
  for (const key of maps) {
    const a = manifest[key] as Record<string, unknown>;
    const b = baseline.manifest[key] as Record<string, unknown>;
    for (const slug of new Set([...Object.keys(a), ...Object.keys(b)])) if (!sameJson(a[slug], b[slug])) out.add(slug);
  }
  for (const key of ["hidden", "unlisted"] as const) {
    const a = new Set(manifest[key]);
    const b = new Set(baseline.manifest[key]);
    for (const slug of [...a, ...b]) if (a.has(slug) !== b.has(slug)) out.add(slug);
  }
  return out;
}

/**
 * The projects as the draft has them: refiled, and in running order.
 *
 * One derivation, because there were three and they disagreed. `projects`
 * arrives as the last build published it, and the draft can move a project
 * two ways, refiling it into another discipline, and dragging it to another
 * position, so every view that groups or orders projects has to apply both
 * or contradict the ones that do.
 *
 * They did contradict. The select said Editorial while the row beside it
 * said Unfiled; filing a project left the row stale; and the sitemap, whose
 * own job is to show "the draft as it would publish", kept a refiled
 * project under its old discipline, because it read the server's label. Each
 * was a small lie in a different place and they were all the same bug.
 *
 * Mirrors `relabel`, `withSequence` and `byRunningOrder` in `lib/work/work.ts`:
 * the same operations the build applies, applied here so the editor shows
 * what publishing would produce rather than what the last deploy did.
 */
export function draftProjects(
  projects: AdminEditorProps["projects"],
  order: string[],
  recategorised: Overrides["categories"],
  categories: AdminEditorProps["categories"],
  reframed: Overrides["frames"],
) {
  const rank = new Map(order.map((slug, i) => [slug, i]));
  const named = new Map(categories.map((c) => [c.slug, c.name]));

  return [...projects]
    .map((p) => {
      const filed = recategorised[p.slug] ?? p.categorySlug;
      /* The frame the gallery now opens on.
       *
       * `withSequence` in `lib/work/work.ts` makes the first frame of a
       * resequenced gallery its cover, the card and the discipline are
       * meant to show what you actually opened on. The editor was not
       * applying that half, so dragging a frame to the front changed the
       * published cover and nothing here moved: the sitemap, the project
       * row and the discipline all kept drawing the old opener, which reads
       * as the edit not having taken. */
      const opener = reframed[p.slug]?.flatMap((f) =>
        // A passage is not a photograph, so it cannot be the opener.
        isTextRef(f) ? [] : [typeof f === "string" ? f : f.src],
      )[0];

      if (filed === p.categorySlug && (!opener || opener === p.images[0])) return p;

      return {
        ...p,
        categorySlug: filed,
        // "Unfiled" is the same string `app/admin/page.tsx` uses for a
        // project the manifest gives no category at all, so the sitemap can
        // group both kinds under one heading.
        category: named.get(filed) ?? "Unfiled",
        /* Dimensions and mat carried over from the old cover rather than
           looked up. The archive's numbers do not travel to the browser
           (see `app/admin/page.tsx`), every thumbnail in here sits in a
           fixed box under `object-cover`, and the mat is only what shows
           for the instant before the frame paints. The build reads the
           real frame. */
        cover: opener && opener !== p.images[0] ? { ...p.cover, src: opener } : p.cover,
      };
    })
    .sort((a, b) => (rank.get(a.slug) ?? Infinity) - (rank.get(b.slug) ?? Infinity));
}
