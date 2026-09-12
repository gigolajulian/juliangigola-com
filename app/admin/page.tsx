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
  categoryFrame,
} from "@/lib/work";
import {
  ADDED,
  TRASH,
  RECATEGORISED,
  REFRAMED,
  RECREDITED,
  ORDER,
  DISCIPLINE_COVERS,
} from "@/lib/added";

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
    /* Full bleed, and as little of it spent on chrome as possible.
       
       The reading pages are measured — a column of prose has a right width
       and it is nowhere near the width of a monitor — but this is a
       workbench: three panels side by side, one of them a grid of
       photographs. Capping it at 64rem left the sitemap four thumbnails wide
       on a display with room for twelve.

       One screen from `xl` up, with each of the three columns scrolling its
       own contents, so the sitemap does not leave the top of the screen while
       you edit the thing it points at. `data-workbench` is what hides the
       site footer here (see `globals.css`); without it the footer alone would
       still make the document scrollable.

       The top padding was `pt-36` — inherited from the reading pages, where
       it clears the fixed bar under a full masthead. Measured here it put the
       first editable thing 324px down a 982px screen: a third of a
       single-screen tool spent on a title and an explainer read once. `pt-20`
       clears the bar and nothing more, and the title is a line rather than a
       block.

       Below `xl` the columns stack, and a stack in a fixed box is three
       scrollers in a phone screen. There it stays an ordinary page. */
    <div
      data-workbench
      className="w-full px-6 pb-24 pt-20 sm:px-10 xl:flex xl:h-dvh xl:flex-col xl:overflow-hidden xl:pb-0"
    >
      {/* One line. The paragraph that used to be here said where edits are
          committed, which matters at the moment you publish and not at the
          moment you arrive — so it lives beside Publish now, where it is
          actually load-bearing. */}
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border pb-3 xl:shrink-0">
        <h1 className="font-display text-xl uppercase tracking-[0.02em]">
          Content
        </h1>
        <p className="label text-muted-foreground">
          commits to <code className="text-foreground">{CONTENT_PATH}</code>{" "}
          &middot; live a couple of minutes after the deploy
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
          /* The frame this discipline is showing right now, whether that was
             picked in here or derived from its lead project.

             Without it the editor could only draw a cover it had been told
             about — so a discipline nobody had picked for showed an empty grey
             box, which is all thirteen of them. "Change the cover" is not a
             question you can answer without seeing the cover. */
          cover: categoryFrame(c.slug)?.src,
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
        /* The running order and the picked discipline covers, as the last
           build applied them. Spread rather than passed through, because
           both are frozen reads of the content file and the editor holds
           them as ordinary state it can edit. */
        initialOrder={[...ORDER]}
        initialCovers={{ ...DISCIPLINE_COVERS }}
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
        /* Every discipline, with the branch of the site it hangs off.
           This used to filter SESSIONS out, which was right while the
           sitemap was a flat list of links — the sessions are samples inside
           one page rather than pages of their own. Drawn as a tree they have
           somewhere to be: under /sessions, which is exactly what they are. */
        categoryLinks={CATEGORIES.map((c) => ({
          slug: c.slug,
          name: categoryLabel(c),
          href: categoryHref(c.slug),
          branch: c.section === "SESSIONS" ? "/sessions" : "/work",
        }))}
      />
    </div>
  );
}
