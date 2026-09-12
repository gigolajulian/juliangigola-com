import type { Metadata } from "next";
import { AdminEditor } from "@/components/admin-editor";
import { CONTENT, CONTENT_PATH } from "@/lib/content";
import {
  PROJECTS,
  ALL_PROJECTS,
  HIDDEN,
  CATEGORIES,
  categoryLabel,
  categoryHref,
} from "@/lib/work";
import { ADDED, TRASH, RECATEGORISED, REFRAMED, RECREDITED } from "@/lib/added";

/* ── admin ────────────────────────────────────────────────────────
 * Unlisted, not secret. Nothing in the nav points here and no crawler is
 * invited, but the page is served like any other and the repo is public — so
 * the page holds nothing worth reaching. Every write goes through a GitHub
 * token that only Julian has, and GitHub is what enforces it.
 *
 * Saves commit `content/site.json`, which the deploy rebuilds from. That is
 * the trade for staying on a static host: publishing takes a couple of
 * minutes instead of being instant, and in exchange there is no server to
 * secure, no database to pay for, and every change has a commit behind it.
 * ─────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Admin",
  // Out of the index, and out of the sitemap (see `sitemap.ts`). A page that
  // does nothing without a token is still not one to show a stranger.
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  const addedSlugs = new Set(ADDED.map((p) => p.slug));

  return (
    <div className="mx-auto w-full max-w-[64rem] px-6 pb-24 pt-28 sm:px-10 sm:pt-36">
      <header>
        <h1 className="title">Content</h1>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Edits are committed to{" "}
          <code className="text-foreground">{CONTENT_PATH}</code> and go live
          when the deploy finishes, a couple of minutes later. A new project is
          committed to{" "}
          <code className="text-foreground">content/projects.json</code> along
          with its photographs, in a single commit.
        </p>
      </header>

      <AdminEditor
        initial={CONTENT}
        slugs={PROJECTS.map((p) => p.slug)}
        // Only the disciplines that are real sections of the site. `WORK` and
        // `MUSIC` both file under Work; a session category is not somewhere a
        // commissioned project belongs.
        categories={CATEGORIES.filter((c) => c.section !== "SESSIONS").map(
          (c) => ({
            slug: c.slug,
            name: categoryLabel(c),
          }),
        )}
        /* Frames as paths, and nothing else about them. The sequence editor
           needs to show every frame of whichever gallery is opened, so the
           paths have to travel — but their dimensions and mat colours do not,
           since the thumbnails sit in a fixed box and `lib/work.ts` reads the
           real numbers back out of the archive when a sequence is applied. */
        projects={ALL_PROJECTS.map((p) => ({
          slug: p.slug,
          name: p.name,
          /* Through `categoryLabel`, the same as `categoryLinks` below.
             The raw manifest name is "EDITORIAL" and the label is
             "Editorial"; the sitemap counts its tiles by this string and
             looks them up by the label, so passing the raw name here made
             every discipline count read "—". */
          category: p.categories[0]
            ? categoryLabel(p.categories[0])
            : "Unfiled",
          categorySlug: p.categories[0]?.slug ?? "",
          images: p.images.map((f) => f.src),
          cover: {
            src: p.cover.src,
            width: p.cover.width,
            height: p.cover.height,
            color: p.cover.color,
          },
          // Only these have files of ours to delete; the rest can be hidden.
          added: addedSlugs.has(p.slug),
          // As published, so the editor can seed the form from what is live
          // and offer to put an edit back.
          credits: p.credits,
        }))}
        initialHidden={[...HIDDEN]}
        initialTrash={TRASH}
        initialRecategorised={RECATEGORISED}
        initialReframed={REFRAMED}
        initialRecredited={RECREDITED}
        categoryLinks={CATEGORIES.filter((c) => c.section !== "SESSIONS").map(
          (c) => ({
            slug: c.slug,
            name: categoryLabel(c),
            href: categoryHref(c.slug),
          }),
        )}
      />
    </div>
  );
}
