import type { SiteContent } from "@/lib/content";
import type { Draft } from "@/lib/admin/publish";
import type { TrashedProject } from "@/lib/work/added";
import type { Bts, Credit } from "@/lib/work/work-types";

/** One thing a picker offers (`admin-picker.tsx`): callers map their own data down to it. */
export type PickerItem = {
  slug: string;
  name: string;
  /** The second line: a discipline, or an artist. */
  detail: string;
  cover: { src: string; color: string };
};

/** A project as the editor lists it. */
export type AdminProject = {
  slug: string;
  /** What it was harvested or added as: the key of a rename. */
  origin: string;
  name: string;
  /** Display name of its discipline, for the row and the filter. */
  category: string;
  /** Its discipline's slug, for the refiling dropdown. */
  categorySlug: string;
  /**
   * Every frame in the gallery, in order — paths only.
   *
   * Paths and not whole frames: 1,152 of these ship with the page, and the
   * dimensions and mat colour would triple that to render thumbnails in a
   * fixed box that needs neither. `lib/work/work.ts` reads the real numbers back
   * out of the archive when the sequence is applied.
   */
  images: string[];
  /**
   * The same frames with their dimensions and mat colour, for the page
   * view — which lays them out at the page's own sizes and shapes, and so
   * needs both. It is the tripling the note above declined, accepted now
   * that there is a view that draws the frames as frames. Admin only.
   */
  frames: { src: string; width: number; height: number; color: string }[];
  cover: { src: string; width: number; height: number; color: string };
  /** The paragraph under the meta row, when the project has one. */
  intent: string | null;
  /** The heading the page shows — `headline ?? name`, as published. */
  title: string;
  /** Added through this editor, so its files are ours to remove. */
  added: boolean;
  /** As the last build has them, so an override can be compared and undone. */
  credits: Credit[];
};

/** The per-project overrides a build applies, one map per kind. */
export type Overrides = Pick<Draft, "categories" | "frames" | "credits" | "copy" | "slugs" | "spreads">;

/** The project list's other half of the draft: hidden and unlisted slugs, and BTS by slug. */
export type ListDraft = { hidden: Set<string>; unlisted: Set<string>; bts: Record<string, Bts> };

/** What the editor is handed by `app/admin/page.tsx` (`editor.tsx`). */
export type AdminEditorProps = {
  /** The content as it was at build time — what the live site is serving. */
  initial: SiteContent;
  /** Every project slug, so the cover and featured fields can be checked. */
  slugs: string[];
  /** Disciplines a shoot can be filed under, with the cover each shows. */
  categories: {
    slug: string;
    name: string;
    group: string;
    cover?: string;
  }[];
  /** Every project, hidden ones included, for the list and the preview. */
  projects: AdminProject[];
  /** Disciplines for the sitemap, each under the page it hangs off. */
  categoryLinks: {
    slug: string;
    name: string;
    href: string;
    branch: string;
  }[];
  /** Removed projects awaiting their week. */
  initialTrash: TrashedProject[];
  /**
   * The manifest the last build applied, in the draft's shape: hidden and
   * unlisted slugs, the per-project overrides (refilings, re-sequenced
   * galleries, rewritten credits, titles and intents, renamed slugs), the
   * running order, discipline covers, collaborators' faces and BTS.
   */
  published: Draft;
  /** Every cover-art release, for the homepage rack picker. */
  releases: PickerItem[];
  /**
   * Disciplines the cover could show, which is not all of them.
   *
   * `DISCIPLINES` in `lib/work/disciplines.ts` drops any category with no lead project or
   * no frame, because the cover has to show a photograph for each one and
   * cannot invent it. So Video and Music video, which have no work at all,
   * are absent here rather than offered and silently ignored.
   */
  heroChoices: PickerItem[];
  /** Every client with a mark on file, for the two wall pickers. */
  clients: PickerItem[];
  /** How many of them the homepage rack actually shows. */
  releaseLimit: number;
};
