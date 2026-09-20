import { COVER_RELEASES } from "@/lib/cover-art-data";
import { CONTENT } from "@/lib/content";
import { filmCount, REEL } from "@/lib/videos";
import {
  COVER_ART,
  WORK_CATEGORY_LINKS,
  commissionsIn,
  indexRow,
  isDisciplineGallery,
  projectsIn,
} from "@/lib/work";
import type { Frame, Project } from "@/lib/work-types";
import type { ListRow } from "@/components/work-list";

/* ── the whole archive as lines ───────────────────────────────────
 * What the list view draws and the search reads: one lean row per
 * project, built on the server because a `Project` must never cross into
 * a client component.
 *
 * A module and not a page's own working, because every page under
 * `(index)` needs the same set. Julian: the search is kept across the
 * filters — typing on Portraits searches the whole archive, and the
 * answer is the same answer it would be on All — so a discipline page has
 * to carry the same rows as All does.
 *
 * `find` is everything somebody might type — the name, the discipline, who
 * it was for, and every credit's role, name and handle — folded once, here,
 * so a keystroke is a substring test per row and not a walk through the
 * archive.
 * ─────────────────────────────────────────────────────────────── */
const lineFor = (p: Project, discipline: string): ListRow => {
  const row = indexRow(p);
  return {
    ...row,
    href: `/work/${p.slug}`,
    discipline,
    find: [
      p.name,
      discipline,
      row.credit,
      ...p.credits.map((c) => `${c.role} ${c.name} ${c.instagram ?? ""}`),
    ]
      .join(" ")
      .toLowerCase(),
  };
};

const build = (): ListRow[] => {
  const rows: ListRow[] = [];
  for (const c of WORK_CATEGORY_LINKS) {
    if (c.slug === "video") {
      rows.push({
        slug: "video",
        name: c.name,
        href: c.href,
        discipline: c.name,
        credit: `${filmCount(CONTENT.videos)} films`,
        cover: {
          src: REEL.poster,
          width: 1280,
          height: 720,
          color: "#111111",
        } as Frame,
        find: [c.name, REEL.title, ...CONTENT.videos.map((v) => v.title)]
          .join(" ")
          .toLowerCase(),
      });
      continue;
    }
    /* A discipline shot straight onto the page is one line standing for
       the whole of it, the way it is one cell on the index. */
    const gallery = projectsIn(c.slug).find(isDisciplineGallery);
    if (gallery) {
      const isCoverArt = gallery.slug === COVER_ART?.slug;
      const frames = isCoverArt ? COVER_RELEASES : gallery.images;
      rows.push({
        slug: gallery.slug,
        name: c.name,
        href: c.href,
        discipline: c.name,
        credit: `${frames.length} ${isCoverArt ? "releases" : "frames"}`,
        cover: indexRow(gallery).cover,
        find: `${c.name} ${gallery.name}`.toLowerCase(),
      });
      continue;
    }
    for (const p of commissionsIn(c.slug)) rows.push(lineFor(p, c.name));
  }
  return rows;
};

export const WORK_ROWS: ListRow[] = build();
