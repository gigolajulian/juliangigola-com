import type { SiteContent } from "@/lib/content";
import type { AdminProject } from "@/components/admin/admin-projects";
import type { PickerItem } from "@/components/admin/admin-picker";
import type { Draft } from "@/lib/admin/publish";
import type { TrashedProject } from "@/lib/work/added";
import type { Bts } from "@/lib/work-types";

/** The per-project overrides a build applies, one map per kind. */
export type Overrides = Pick<Draft, "categories" | "frames" | "credits" | "copy" | "slugs">;

/** What the editor is handed by `app/admin/page.tsx` (`admin-editor.tsx`). */
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
  /** Which slugs the last build was hiding. */
  initialHidden: string[];
  initialUnlisted: string[];
  /** Disciplines for the sitemap, each under the page it hangs off. */
  categoryLinks: {
    slug: string;
    name: string;
    href: string;
    branch: string;
  }[];
  /** Removed projects awaiting their week. */
  initialTrash: TrashedProject[];
  /** The per-project overrides the last build applied, each slug-keyed:
      refilings (category slug), re-sequenced galleries, rewritten credits,
      rewritten titles and intents, and renamed slugs. */
  initialOverrides: Overrides;
  /** The running order the last build applied, by slug. */
  initialOrder: string[];
  /** Discipline covers the last build applied, category slug to frame path. */
  initialCovers: Record<string, string>;
  /** Collaborators' faces the last build applied, handle to picture path. */
  initialAvatars: Record<string, string>;
  /** BTS the last build applied, slug → `{ by, frames }`. */
  initialBts: Record<string, Bts>;
  /** Every cover-art release, for the homepage rack picker. */
  releases: PickerItem[];
  /**
   * Disciplines the cover could show, which is not all of them.
   *
   * `DISCIPLINES` in `lib/work/work.ts` drops any category with no lead project or
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
