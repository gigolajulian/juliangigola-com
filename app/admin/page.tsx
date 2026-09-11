import type { Metadata } from "next";
import { AdminEditor } from "@/components/admin-editor";
import { CONTENT, CONTENT_PATH } from "@/lib/content";
import { PROJECTS, CATEGORIES, categoryLabel } from "@/lib/work";

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
      />
    </div>
  );
}
