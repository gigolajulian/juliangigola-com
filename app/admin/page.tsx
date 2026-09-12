import type { Metadata } from "next";
import { AdminEditor } from "@/components/admin-editor";
import { CONTENT, CONTENT_PATH } from "@/lib/content";
import { SHOWN as HOMEPAGE_RELEASES } from "@/components/cover-art";
import {
  PROJECTS,
  ALL_PROJECTS,
  HIDDEN,
  CATEGORIES,
  COVER_RELEASES,
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
    /* Full bleed. The reading pages are measured — a column of prose has a
       right width and it is nowhere near the width of a monitor — but this is
       a workbench, not something to read: three panels side by side, one of
       them a grid of photographs. Capping it at 64rem left the sitemap four
       thumbnails wide on a display with room for twelve. */
    /* One screen, from `xl` up. A workbench that scrolls as one document
       means the sitemap leaves the top of the screen while you edit the
       thing it points at — so the page is pinned to the viewport and each
       of the three columns scrolls its own contents instead. `data-workbench`
       is what hides the site footer here (see `globals.css`); without that,
       the footer alone would still make the document scrollable.

       Below `xl` the columns stack, and a stack in a fixed box is three
       scrollers in a phone screen. There it stays an ordinary page. */
    <div
      data-workbench
      className="w-full px-6 pb-24 pt-28 sm:px-10 sm:pt-36 xl:flex xl:h-dvh xl:flex-col xl:overflow-hidden xl:pb-0"
    >
      <header className="xl:shrink-0">
        <h1 className="title">Content</h1>
        {/* The prose keeps its measure even though the page no longer has
            one — this paragraph is the one thing here that is read. */}
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
        /* Every category a shoot can be, sessions included. `WORK` and
           `MUSIC` both file under Work in the new nav, so they are one group
           here; `SESSIONS` is its own, because filing a project there moves
           it off /work and onto the session page as one of its samples.

           Sessions used to be excluded on the grounds that a commissioned
           project does not belong in one. True, but it is not the editor's
           place to decide which of the two a given shoot was — a graduation
           set is a real thing to have shot, and there was no way to say so. */
        categories={CATEGORIES.map((c) => ({
          slug: c.slug,
          name: categoryLabel(c),
          group: c.section === "SESSIONS" ? "Sessions" : "Work",
        }))}
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
        /* Imported from the section itself rather than restated, so the
           picker's limit cannot drift away from the number the grid is
           actually built around. */
        releaseLimit={HOMEPAGE_RELEASES}
        releases={COVER_RELEASES.map((r) => ({
          slug: r.slug,
          name: r.title,
          detail: r.artist,
          // The thumbnail, not the master: these are 40px rows and the full
          // sleeves are 1600px.
          cover: {
            src: r.frames[0]?.thumb ?? "",
            color: r.frames[0]?.color ?? "transparent",
          },
        }))}
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
