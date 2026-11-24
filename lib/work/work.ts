/**
 * The one way the app reads the archive.
 *
 * `work-data.ts` is the archive the retired harvester (`scripts/harvest.mjs`)
 * wrote, now edited by hand; this file is the stable surface over it and
 * `content/projects.json`, so every page imports from here. It
 * also holds the editorial decisions the raw data cannot make — what is
 * featured, what leads the homepage, and how the old site's three nav groups
 * collapse into the new two. The disciplines are built on it in `disciplines.ts`,
 * the client marks are in `press.ts`.
 */
import {
  PROJECTS as HARVESTED,
  CATEGORIES as HARVESTED_CATEGORIES,
} from "./work-data";
import type { Project, Category, Frame, TextBlock } from "./work-types";
import { COVER_RELEASES as RELEASES } from "./cover-art-data";
import type { CoverRelease } from "./cover-art-types";
import { CONTENT } from "../content";
import { ALT } from "./alt-text";
import type { WallTile } from "./wall-tile";
import {
  ADDED,
  HIDDEN,
  UNLISTED,
  SLUGS,
  RECATEGORISED,
  REFRAMED,
  RECREDITED,
  RECOPIED,
  BTS,
  ORDER,
  ADDED_DISCIPLINES,
  AVATARS,
  isTextRef,
  type AddedProject,
} from "./added";

export type { Project, Category, Frame, TextBlock };
/**
 * Every discipline: the ones the old nav had, plus any added in /admin.
 *
 * Appended rather than merged in place, so the harvested order — which is the
 * old site's nav order and what the work index reads — is untouched. A slug
 * that already exists is dropped: `content/projects.json` is edited through a
 * browser form, and a duplicate there should cost the new entry rather than
 * put two rows with one slug into every index on the site.
 *
 * Declared here, above the consts that read it, rather than left as the
 * re-export it used to be.
 */
export const CATEGORIES: Category[] = [
  ...HARVESTED_CATEGORIES,
  ...ADDED_DISCIPLINES.filter(
    (d) => !HARVESTED_CATEGORIES.some((c) => c.slug === d.slug),
  ),
];

/**
 * The cover-art gallery in Julian's order.
 *
 * `lib/work/cover-art-data.ts` is generated and its order is the script's; which
 * release the gallery opens on is an editorial decision and belongs in
 * /admin. Partial and stable, exactly like the work's own running order: a
 * named release takes its place, an unnamed one keeps the place the script
 * gave it, and an empty list is the gallery as generated.
 */
const releaseRank = new Map(
  CONTENT.coverArtOrder.map((slug, i) => [slug, i] as const),
);

export const COVER_RELEASES: CoverRelease[] = [...RELEASES].sort(
  (a, b) =>
    (releaseRank.get(a.slug) ?? Infinity) -
    (releaseRank.get(b.slug) ?? Infinity),
);

/**
 * The cover-art gallery, with the harvest's pictures replaced by Julian's own
 * masters (`scripts/cover-art.mjs`).
 *
 * Same reason the homepage cover is overridden: the harvested copies are the
 * old site's 1600px re-compressions, with the release titles buried in alt
 * text and zero-width spaces baked into them, where the masters run to
 * 7952px and are correctly named. The delivered set also holds a release the
 * old site never published.
 *
 * Substituted into `PROJECTS` rather than exported alongside it, so the work
 * index, the route, the lightbox and the discipline list cannot end up
 * showing two different versions of the same gallery.
 */
const withCoverArt = (project: Project): Project => {
  const images = COVER_RELEASES.flatMap((r) => r.frames);
  if (!images.length) return project;

  return {
    ...project,
    // "COVERART" was one word on the old site and reads as a typo set large —
    // on the project page it is printed as the category too, so both go.
    name: "Cover Art",
    // The category used to be renamed here too. `relabel` does it now, for
    // this category and every other one, from `CATEGORY_LABELS`.
    cover: { ...images[0], src: "/covers/cover.jpg", width: 600, height: 600 },
    images,
  };
};

/** The width `scripts/harvest.mjs` cuts every cover derivative to. */
const COVER_WIDTH = 600;

/**
 * Projects whose opener is not the frame the archive happens to lead with.
 *
 * The archive's order is the old site's order, and in a few places the frame
 * that should introduce a project is not the one sitting first in it. Naming
 * the frame here moves it to the front of the gallery *and* makes it the
 * cover, because those are the same decision: the cover is the opener,
 * and a project whose card shows one
 * photograph and whose page opens on another reads as a mistake.
 *
 * The derivative lives in `public/hero/` rather than beside the frame it came
 * from. `harvest.mjs` owns `public/work/` and rebuilds `cover.jpg` from
 * whatever is first in the archive whenever it is missing — so a cover put
 * there would survive today and quietly revert to the wrong photograph on the
 * next clean harvest.
 */
const LEAD_FRAMES: Record<string, string> = {
  // Julian's pick: the second frame, not the first.
  "luxe-meets-future": "/work/luxe-meets-future/02.jpg",
  // Julian's pick: the glass sculpture, frame twelve.
  metamorphosis: "/work/metamorphosis/12.jpg",
  // Julian's pick: on the floor by the television, frame eleven.
  sage: "/work/sage/11.jpg",
  // Julian's pick: the hair in the air, frame six.
  nyx: "/work/nyx/06.jpg",
};

const withLeadFrame = (project: Project): Project => {
  const wanted = LEAD_FRAMES[project.slug];
  const lead = wanted
    ? project.images.find((f) => f.src === wanted)
    : undefined;
  // Silently unchanged if the named frame is gone, rather than throwing a
  // build that is otherwise fine — a re-harvest can renumber a gallery.
  if (!lead) return project;

  return {
    ...project,
    images: [lead, ...project.images.filter((f) => f.src !== lead.src)],
    cover: {
      ...lead,
      /* Named for the frame, so a new pick is a new address: the files
         are cached for a day and served stale for a week, and a cover
         changed under the same name kept showing the old one. */
      src: `/hero/${project.slug}-${lead.src.split("/").pop()}`,
      width: COVER_WIDTH,
      height: Math.round((COVER_WIDTH / lead.width) * lead.height),
    },
  };
};

/**
 * A project added through `/admin`, in the shape the rest of the site reads.
 *
 * The editor stores one category slug; everything downstream wants the whole
 * `Category`, so it is looked up here against the manifest rather than being
 * duplicated into the JSON where it could drift.
 *
 * An unknown slug throws. The alternative — filing the project under nothing —
 * would put it in the archive but in no index, which is the kind of failure
 * somebody only finds weeks later while wondering where a shoot went.
 */
const fromAdded = (p: AddedProject): Project => {
  const category = CATEGORIES.find((c) => c.slug === p.categorySlug);
  if (!category) {
    throw new Error(
      `content/projects.json: "${p.slug}" is filed under "${p.categorySlug}", which is not a category.`,
    );
  }

  return {
    slug: p.slug,
    name: p.name,
    headline: p.headline ?? null,
    intent: null,
    credits: p.credits,
    categories: [category],
    cover: p.cover,
    images: p.images,
  };
};

/**
 * Gives a project the address /admin gave it.
 *
 * First in the pipeline, before anything looks a project up by slug, so
 * the new slug is its identity everywhere downstream: the overrides, the
 * running order, the indexes, the route. The editor writes those maps
 * under the new slug when it publishes a rename (`remapSlugs` in
 * `components/admin/editor/editor.tsx`), so a renamed project is one project and not two
 * halves of one. The original is kept as `origin` for the redirect.
 */
const reslug = (project: Project): Project => {
  const to = SLUGS[project.slug];
  return to && to !== project.slug
    ? { ...project, slug: to, origin: project.slug }
    : project;
};

/**
 * Refiles a project under the discipline `/admin` chose for it.
 *
 * Applied after the merge so it reaches harvested projects as well as added
 * ones: their categories come from `lib/work/work-data.ts`, which `/admin` does
 * not write.
 *
 * An unknown category slug is left alone rather than throwing. This map is
 * keyed by project slug, and a re-harvest can retire a project entirely; a
 * stale key should not be able to fail a build that is otherwise fine.
 */
const refile = (project: Project): Project => {
  const wanted = RECATEGORISED[project.slug];
  if (!wanted) return project;

  const category = CATEGORIES.find((c) => c.slug === wanted);
  if (!category) return project;

  return { ...project, categories: [category] };
};

/** Rewritten title and intent from `/admin`; see `AddedFile.copy`. */
const recopy = (project: Project): Project => {
  const c = RECOPIED[project.slug];
  return c
    ? { ...project, name: c.title, headline: null, intent: c.intent }
    : project;
};

/** Behind-the-scenes frames, where a project has any; see `AddedFile.bts`. */
const withBts = (project: Project): Project =>
  BTS[project.slug] ? { ...project, bts: BTS[project.slug] } : project;

/**
 * Replaces the credits `/admin` has rewritten.
 *
 * A map for the same reason `refile` uses one: the harvested projects keep
 * their credits in `lib/work/work-data.ts`, which `/admin` does not write.
 *
 * Checked with `in` rather than by truthiness, so an empty array is honoured.
 * "This project's harvested credits are wrong, publish none" is a real
 * instruction and the only way to say it.
 */
const recredit = (project: Project): Project =>
  project.slug in RECREDITED
    ? { ...project, credits: RECREDITED[project.slug] }
    : project;

/**
 * Re-sequences a gallery that `/admin` has reordered, trimmed or added to.
 *
 * Applied last, after the merge and after the lead-frame and cover-art
 * substitutions, because it is the most specific decision available: somebody
 * looked at this gallery and said what it should be.
 *
 * Most entries are bare paths, and the frame they name is looked up in the
 * archive so its dimensions and mat colour stay whatever the last harvest
 * made them. A path that is no longer there is dropped rather than throwing —
 * a re-harvest can renumber a gallery, and a stale entry should cost a frame
 * and not the build. If that leaves nothing at all the override is ignored
 * entirely, because a project rendering as a title over nothing is worse than
 * one rendering in its original order.
 *
 * A whole `Frame` is a photograph added through the editor: it exists nowhere
 * else, so its own numbers are the only ones there are.
 */
const reframe = (project: Project): Project => {
  const wanted = REFRAMED[project.slug];
  if (!wanted?.length) return project;

  const archive = new Map(project.images.map((f) => [f.src, f]));

  /* One pass, two outputs. The stored sequence interleaves photographs and
     writing; the site wants them apart — `images` feeds the gallery, the
     lightbox, the counts and the image sitemap, none of which have any use
     for a paragraph — so a block's position is recorded as the number of
     frames ahead of it and the lists part company here.

     Counted against surviving frames rather than against the stored list, so
     a frame dropped by a re-harvest pulls the writing after it up with it
     instead of leaving a block stranded past the end of the gallery. */
  const images: Frame[] = [];
  const blocks: TextBlock[] = [];

  for (const ref of wanted) {
    if (isTextRef(ref)) {
      blocks.push({
        heading: ref.heading,
        body: ref.body,
        after: images.length,
      });
      continue;
    }
    const found =
      typeof ref === "string"
        ? (archive.get(ref) ?? null)
        : (archive.get(ref.src) ?? ref);
    if (found) images.push(found);
  }

  if (!images.length) return project;

  return {
    ...project,
    images,
    blocks,
    // The cover is the opener, so a gallery that
    // now opens on a different photograph gets a card showing it. The full
    // frame rather than the 600px derivative, because the derivative was cut
    // from the frame that used to lead and still shows it.
    cover: images[0].src === project.images[0]?.src ? project.cover : images[0],
  };
};

/* Moved above the pipeline below, which now calls it. A `const` arrow is not
   hoisted, so `ALL_PROJECTS` evaluating at module load would reach into the
   temporal dead zone and throw on import. */
/** Display names, where the old site's nav label does not read well. */
const CATEGORY_LABELS: Record<string, string> = {
  // One word on the old site, and it looks like a typo set large.
  coverart: "Cover Art",
  // "Campaigns" alone is ambiguous next to EDITORIAL — it could as easily mean
  // a political or fundraising one. The client is a brand, and saying so is
  // what an art director is scanning the index for.
  campaigns: "Brand Campaigns",
  /* Julian: rename Video to Motion. "Video" names a file format; the row
     next to EDITORIAL and PORTRAITS should name a kind of work, and the
     moving work here is direction, not footage. The slug stays `video`, so
     /work/video and every link into it keep working — only the label
     moves. */
  video: "Motion",
};

/**
 * A category's name as a heading.
 *
 * The old nav set every label in caps, which is a styling decision baked into
 * the content: sentence case is what a page heading needs, and the `label`
 * class puts the caps back where the design wants them.
 */
export const categoryLabel = (category: Category): string =>
  CATEGORY_LABELS[category.slug] ??
  // Julian: every word capitalized, "Event Coverage", "Mixed Media".
  category.name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/**
 * A collaborator's face, by Instagram handle, or nothing.
 *
 * Saved with the site rather than fetched: Instagram's own picture URLs are
 * signed and expire, so what is kept is a copy, downloaded once in /admin
 * when the person was added. A handle with no picture on file is not a
 * failure — the card it feeds prints the handle on its own.
 */
export const avatarFor = (
  handle: string | null | undefined,
): string | undefined => (handle ? AVATARS[handle.toLowerCase()] : undefined);

/** Julian's own photo credit goes last, after the crew. */
const MINE = /^photo(grapher|graphy)?$/i;
const ownLast = (project: Project): Project => ({
  ...project,
  credits: [
    ...project.credits.filter((c) => !MINE.test(c.role.trim())),
    ...project.credits.filter((c) => MINE.test(c.role.trim())),
  ],
});

/**
 * The face and the handle on every credit, worked out here.
 *
 * Here and not in the card that draws it, because the card is a client
 * component: reaching for the archive from there would carry the whole
 * manifest into the browser to look up one path. This runs where the
 * archive is free to read, and a credit arrives knowing who it is.
 */
const withFaces = (project: Project): Project => ({
  ...project,
  credits: project.credits.map((c) => {
    // Six harvested credits carry the handle as the name ("@apricotsss3")
    // with no instagram field of their own; they link too.
    const handle =
      c.instagram ?? (c.name.startsWith("@") ? c.name.slice(1) : null);
    return { ...c, handle, avatar: avatarFor(handle) ?? null };
  }),
});

export const titleCase = (s: string) =>
  s.trim().toLowerCase().replace(/(^|[\s(/-])\S/g, (c) => c.toUpperCase());

/**
 * What the project page says about a photograph, as a sentence for its
 * alt: the project, its discipline, who photographed it, who is in it
 * and who it was for. The crew (gaffer, DIT, styling) stays on the page;
 * the alt says what the picture is.
 */
export const altContext = (project: Project): string => {
  const name = titleCase(project.name);
  const discipline = project.categories[0]?.name;
  const credit = (role: RegExp) =>
    project.credits.find((c) => role.test(c.role))?.name.trim();
  const same = (a?: string) => !a || a.toLowerCase() === project.name.trim().toLowerCase();
  const model = credit(/^models?$/i);
  const artist = credit(/^artists?$/i);
  const client = credit(/^client$/i);
  return [
    discipline && !same(discipline) ? `${name} (${discipline})` : name,
    `photographed by ${credit(/^photographer$/i) ?? "Julian Gigola"}`,
    !same(model) && `model ${model}`,
    !same(artist) && `artist ${artist}`,
    !same(client) && `for ${client}`,
  ]
    .filter(Boolean)
    .join(", ");
};

/**
 * A name for every picture. The harvest left `alt` empty on all but a
 * handful of frames, and an empty alt tells a screen reader the photograph
 * is decoration. On a photographer's site it is the content, so a frame
 * with no description of its own is named for the work it belongs to and
 * its place in it. Real descriptions written in /admin still win.
 */
const withAlt = (project: Project): Project => {
  const context = altContext(project);
  /* A written description (`lib/work/alt-text.ts`, or one the harvest kept)
     first, then the project's own words; without one, the project's words
     and where in the sequence the frame sits. */
  const alt = (f: Frame, i: number) => {
    const said = ALT[f.src] || f.alt;
    return said
      ? `${said.replace(/\.$/, "")}. ${context}`
      : `${context}, photo ${i + 1} of ${project.images.length}`;
  };
  const images = project.images.map((f, i) => ({ ...f, alt: alt(f, i) }));
  // `cover.jpg` is the harvest's copy of the opening frame, so it says what that frame says.
  const at = project.cover.src.endsWith("/cover.jpg")
    ? 0
    : project.images.findIndex((f) => f.src === project.cover.src);
  return {
    ...project,
    cover: { ...project.cover, alt: images[at]?.alt ?? alt(project.cover, 0) },
    images,
  };
};

/**
 * Prints every category under its display name, once, for good.
 *
 * The labels above were only being applied where somebody remembered to call
 * `categoryLabel`: the cover index, the nav, a page heading. Everywhere that
 * printed `project.categories[0].name` got the raw manifest name instead, so
 * `/portfolio` listed "CAMPAIGNS" while the nav above it said "Brand campaigns",
 * and the homepage tiles did the same. That was true before this function
 * existed and would have been true of every future rename.
 *
 * Fixed at the one place every consumer reads from rather than at each render
 * site, because the render sites are the part that keeps growing. `withCoverArt`
 * has been doing exactly this for `coverart` alone since the rebuild; this is
 * that, generalised.
 *
 * After `refile`, so a project moved to another discipline in /admin is
 * labelled by where it now is and not where it was.
 */
const relabel = (project: Project): Project => ({
  ...project,
  categories: project.categories.map((c) => ({ ...c, name: categoryLabel(c) })),
});

/**
 * The running order of the work, as dragged in /admin.
 *
 * `ORDER` is partial — it names only what has been moved. Anything absent
 * sorts after everything named, keeping the order the manifest gave it, so an
 * empty list is the site as harvested and moving one project to the front
 * costs one entry rather than a snapshot of all seventy-three.
 *
 * `Infinity` for the unnamed rather than a large number: it has to be greater
 * than every real index without anybody having to know how many there are.
 * Ties return 0, and `Array.prototype.sort` has been stable since ES2019, so
 * the unnamed keep their relative order instead of being shuffled.
 */
const rank = new Map(ORDER.map((slug, i) => [slug, i]));

const byRunningOrder = (a: Project, b: Project): number =>
  (rank.get(a.slug) ?? Infinity) - (rank.get(b.slug) ?? Infinity);

/**
 * Every project, added work first, and including what is hidden.
 *
 * `projectsIn()` takes the first project in a category as that category's
 * lead (the frame its row shows, and what the discipline page opens with),
 * so putting new work at the front means a shoot added today is what the site
 * leads with, rather than sinking beneath a migration ordered by the old
 * site. The hand-picked cover overrides still win where they exist.
 *
 * Exported unfiltered for `/admin` only: the editor has to be able to show a
 * hidden project in order to offer to bring it back, which is the one context
 * where the filter below is wrong.
 */
export const ALL_PROJECTS: Project[] = [
  ...ADDED.map(fromAdded),
  ...HARVESTED.map((p) =>
    p.slug === "coverart" ? withCoverArt(p) : withLeadFrame(p),
  ),
]
  .map((p) =>
    withBts(withFaces(ownLast(withAlt(relabel(reframe(recopy(recredit(refile(reslug(p)))))))))),
  )
  .sort(byRunningOrder);

/**
 * Filtered here, at the one place every consumer reads from, rather than at
 * each index. A hidden project has to be absent from the work index, the
 * discipline pages, the homepage band, `generateStaticParams`, the sitemap
 * and the old-URL redirects — and a list that has to be remembered in six
 * places is a list that will be forgotten in one.
 *
 * Everything that has a page: the archive less what has been unpublished.
 *
 * `generateStaticParams`, `getProject` and the bare-slug redirects read this
 * one, because an unlisted project is reachable by anybody holding the link
 * and all three are about whether a URL answers.
 */
export const LINKABLE: Project[] = ALL_PROJECTS.filter(
  (p) => !HIDDEN.has(p.slug),
);

/**
 * Everything that appears anywhere: the pages, less what has been unlisted.
 *
 * Every index reads this - the work index, the discipline pages, the homepage
 * band, the running order, the prev/next chain and the sitemap - so unlisting
 * is one entry in one file rather than a slug to be remembered in six places.
 */
export const PROJECTS: Project[] = LINKABLE.filter(
  (p) => !UNLISTED.has(p.slug),
);

export { HIDDEN, UNLISTED };

/** The listed projects that have BTS, in the running order: the /bts page. */
export const WITH_BTS: Project[] = PROJECTS.filter((p) => p.bts);

/**
 * The old nav split commissioned work across WORK and MUSIC, which asked a
 * visitor to know in advance whether a cover-art job files under "music" or
 * "work". Both are commissions, judged by the same people, so they merge.
 *
 * SESSIONS stays separate — a graduation client and an art director want
 * different things from the first screen (price and dates vs. clients and
 * credits), and that is the one split worth keeping.
 */
const inSessions = (p: Project) =>
  p.categories.some((c) => c.section === "SESSIONS");

/* Julian: studio digitals shows in the portfolio too, a chip and a page
   of its own there, and stays on /sessions. */
const IN_PORTFOLIO = new Set(["studio-digitals"]);
const inPortfolio = (p: Project) =>
  !inSessions(p) || p.categories.some((c) => IN_PORTFOLIO.has(c.slug));

export const projectsIn = (categorySlug: string): Project[] =>
  PROJECTS.filter((p) => p.categories.some((c) => c.slug === categorySlug));

/**
 * Whether a nav leaf is one gallery rather than a listing of projects.
 *
 * The old nav mixed the two without saying so: EDITORIAL is eighteen separate
 * projects, where COVERART and WEDDINGS are each a single gallery published
 * under the category's own slug.
 *
 * Moved up here from below `COMMISSIONS`, which now needs it. A `const` arrow
 * is not hoisted, so the definition has to precede the first use or the
 * module throws on import.
 */
export const isOwnGallery = (categorySlug: string): boolean => {
  const inCategory = projectsIn(categorySlug);
  return inCategory.length === 1 && inCategory[0].slug === categorySlug;
};

/**
 * Whether a project *is* a discipline rather than a piece of work in one.
 *
 * Cover art, Automotive, Places and Event coverage are published as a single
 * gallery under the discipline's own slug — twenty-four record sleeves in one
 * page, a folder of cars — because there are no separate commissions behind
 * them to list. They are the discipline, drawn as a gallery.
 *
 * Exported because the project page has to know. Dressed as an ordinary
 * project, one of these reads as a work called "Event coverage" filed under a
 * category called "Event coverage", with a "next project" that leaves the
 * subject entirely.
 */
export const isDisciplineGallery = (p: Project) =>
  p.categories.some((c) => c.slug === p.slug && isOwnGallery(c.slug));

/** Kept for the two uses below, which read better unqualified. */
const isDiscipline = isDisciplineGallery;

/**
 * Commissioned work: editorial, campaigns, portraits, music, film.
 *
 * Projects, and only projects. The four disciplines that are themselves one
 * gallery used to sit in here as a card apiece, so the index that says "59
 * commissioned projects" counted Cover art as one project and Editorial as
 * twenty-eight — and a grid of individual commissions had four whole
 * disciplines shuffled in among them, sorted by nothing a visitor could see.
 *
 * They keep their chip at the top of the index, which is where Julian wants
 * them and where they already went somewhere sensible: `categoryHref` sends a
 * one-gallery discipline straight to its gallery rather than to a listing
 * page with a single row on it.
 */
export const COMMISSIONS: Project[] = PROJECTS.filter(
  (p) => p.categories.length > 0 && inPortfolio(p) && !isDiscipline(p),
);

/** Client-session work: graduation, headshots, weddings, studio digitals. */
export const SESSIONS: Project[] = PROJECTS.filter(inSessions);

/**
 * Projects the old site published but never linked from its nav — older work,
 * tests, one-offs. They keep working as routes so nothing already linked or
 * indexed breaks, but they stay out of the indexes until Julian files one
 * under a category by hand.
 */
export const UNFILED: Project[] = PROJECTS.filter(
  (p) => p.categories.length === 0,
);

export const WORK_CATEGORIES: Category[] = CATEGORIES.filter(
  (c) => c.section !== "SESSIONS" || IN_PORTFOLIO.has(c.slug),
);

/* Built from `LINKABLE` and not from `PROJECTS`: an unlisted project is off
   every index and still has to resolve, or the page it kept would render
   as a 404 the moment somebody followed the link to it. */
const bySlug = new Map(LINKABLE.map((p) => [p.slug, p]));

export const getProject = (slug: string): Project | undefined =>
  bySlug.get(slug);

/**
 * Whether the Video discipline has anything behind it.
 *
 * Video is the one discipline whose work is not projects in the archive —
 * it is embeds, held in `content/site.json` and edited in /admin, because a
 * film lives on the client's channel and what this site owns is the poster
 * and the arrangement. So "does it have work" is a different question for
 * this one row, and this is it.
 */
const HAS_VIDEOS = CONTENT.videos.length > 0;

/** Whether a discipline gets a listing page: not Video (its page is
    the films), and not one with no work yet. Cover art has one again:
    its rack under the filters, scrolling sideways like every other
    discipline, rather than a page of its own scrolling down. */
const isListing = (slug: string): boolean =>
  slug !== "video" && projectsIn(slug).length > 0;

export const categoryHref = (categorySlug: string): string => {
  // Video's page is the work rather than a listing of it, like `/portfolio/coverart`
  // — and unlike every other discipline, what fills it is not in the archive.
  if (categorySlug === "video") return "/portfolio/video";

  if (!isListing(categorySlug)) return "/portfolio";
  /* The discipline pages are retired. A discipline is
     /portfolio with its chip on (`components/portfolio/work.tsx` reads `?d=`), and
     the old `/portfolio/<discipline>` addresses redirect there
     (`next.config.ts`). Automotive, Events, Places and Cover art share their
     slug with their one gallery, so those addresses are the project pages. */
  return `/portfolio?d=${categorySlug}`;
};

/** The disciplines with work of their own. Their retired `/portfolio/<slug>`
    listing addresses redirect to the filtered index (`next.config.ts`). */
export const LISTINGS: Category[] = WORK_CATEGORIES.filter((c) => isListing(c.slug));

/** A category as the index renders it: name plus where it goes. */
export type CategoryLink = {
  slug: string;
  name: string;
  href: string;
  /** Opens on the work index (the filters stay, the strip swaps), rather
      than on a page of its own; the client tells the two apart by this now
      that both live at /portfolio/<slug>. */
  filter: boolean;
};

/**
 * The category row on the work index, resolved.
 *
 * Prepared here rather than passed as a `categoryHref` function, because the
 * index is a client component and a server component cannot hand a function
 * across that boundary — the href each category needs is data, so it travels
 * as data.
 */
/** The front of the chip row, in the order Julian wants it read. */
const ROW_ORDER = [
  "editorial",
  "campaigns",
  "artist-presskit",
  "portraits",
  "chroma",
];

export const WORK_CATEGORY_LINKS: CategoryLink[] = WORK_CATEGORIES.filter(
  /* A row that navigates nowhere is worse than one that is absent, so a
     discipline waits until there is something to open.

     Which was all of VIDEO and MUSIC VIDEO until now: both were in the old
     nav with nothing behind them. Video has a page as soon as one link is
     pasted into /admin — its work is embeds, not projects, so it is asked a
     different question. Music video is not a row at all any more: it is a
     section *inside* that page, which is how Julian asked for it and how six
     films read better than two thin pages. */
  (c) =>
    c.slug === "video"
      ? HAS_VIDEOS
      : c.slug !== "music-video" && projectsIn(c.slug).length > 0,
)
  .map((c) => ({
    slug: c.slug,
    // Through `categoryLabel`, so "COVERART" reads as "COVER ART" once the
    // `label` class puts the caps back.
    name: categoryLabel(c),
    href: categoryHref(c.slug),
    filter: c.slug === "video" || isListing(c.slug),
  }))
  /* The row in Julian's order. The manifest's order is the old site's nav
     and a discipline added since lands at the end of it, which is no order
     at all: Chroma came out after Places and the presskits sat away from
     the portraits they read with. Named here, front of the row; anything
     not named keeps the place the manifest gave it, and Video stays last,
     the photographic disciplines first and the one that is not photographs
     after them. `nextDiscipline` follows this order too. */
  .map((c, i) => {
    const at = ROW_ORDER.indexOf(c.slug);
    return { c, rank: at < 0 ? ROW_ORDER.length + i : at };
  })
  .sort(
    (a, b) =>
      Number(a.c.slug === "video") - Number(b.c.slug === "video") ||
      a.rank - b.rank,
  )
  .map(({ c }) => c);

/* ── what a list is handed ────────────────────────────────────────
 * The index on /work and the band on the homepage are client components,
 * and a client component's props travel in the page: serialised into the
 * HTML as the hydration payload. Handing them whole `Project`s meant every
 * frame of every project went along — measured on /work: 55 projects, 772
 * frame references, every credit, every passage of writing, 111kB of inline
 * data on a page that shows a name and a client per row. Brotli takes most
 * of it back on the wire (the HTML is 13kB), but the browser still parses
 * all of it before the page is interactive.
 *
 * So each list gets a shape that is exactly what it renders, built here on
 * the server where the archive is free to read.
 * ─────────────────────────────────────────────────────────────── */

// Relative, not `@/`: `next.config.ts` imports this module for the redirect
// table, and Node loads that outside the bundler, where the alias does not
// exist and an aliased import is a module-not-found on `next dev`.
import COVER_BLUR from "../../public/work/blur.json";

/** The cover with its blur-up attached, when the generator made one. */
export const withBlur = (cover: Frame): Frame => {
  const blur = (COVER_BLUR as Record<string, string>)[cover.src];
  return blur ? { ...cover, blur } : cover;
};

/** A credit by role, unless it only repeats the project's own name
    (SAGO, credited to SAGO): under the name, that line said the same
    thing twice. */
export const credited = (p: Project, role: RegExp): string | undefined => {
  const name = p.credits.find((c) => role.test(c.role))?.name.trim();
  return name && name.toLowerCase() !== p.name.trim().toLowerCase()
    ? name
    : undefined;
};

/** The person or company a project is credited to, when there is one: the
    client, or the model or artist in front of the lens. */
export const billing = (p: Project): string | undefined =>
  credited(p, /client|model|artist/i);

/**
 * One tile of the homepage band: the cover, the three frames it scrubs
 * through, and the words on its plate.
 *
 * Three, after the cover: Julian asked for the top three photographs and
 * nothing more, and three is enough to answer "what is the range of this
 * set" without a tile becoming a slideshow. They start at the *second*
 * frame because the first is the cover again — measured on all seven
 * featured projects, `images[0]` is the same picture as `cover` (a 16px
 * greyscale difference of 0.4–2.7, against 20–105 for every other frame),
 * so scrubbing onto it would be a transition to nothing.
 */
export type BandTile = {
  slug: string;
  name: string;
  cover: Frame;
  frames: Frame[];
  /** How many frames the project has in all, for the label. */
  total: number;
  client?: string;
  discipline: string;
  /** Photo, design or video, printed under the name at every size (the
      homepage's discipline tiles). */
  medium?: string;
  /** A film to play under the pointer in place of the frames: the reel,
      on the homepage's Motion tile. */
  reel?: string;
  /** Where the tile goes, when not its project: a homepage discipline
      tile opens the portfolio on that discipline (Julian). */
  href?: string;
};

/**
 * The frame a project is represented by elsewhere on the site — the small
 * derivative of its opening image.
 *
 * The opener, because Julian already sequences his galleries and the first
 * frame is a deliberate choice; second-guessing it with "the widest" or "the
 * darkest" would override an edit he already made.
 */

/**
 * Homepage order. Named explicitly rather than derived, because "what leads"
 * is the most editorial decision on the site — which is also why it is in
 * `content/site.json` and editable in `/admin` rather than in this file.
 *
 * WIRED first: it is the strongest credential, and the thing a new visitor
 * should see before anything else.
 *
 * A slug that does not match a project is dropped rather than rendered as a
 * hole, so a typo in the editor costs a card and not the section.
 */
const FEATURED_SLUGS: string[] = CONTENT.featured;

export const FEATURED: Project[] = FEATURED_SLUGS.map((s) =>
  bySlug.get(s),
).filter((p): p is Project => Boolean(p));

export type { WallTile };
const wallTile = (src: string, title: string, href: string): WallTile => ({ src, title, href });

/**
 * The drifting wall on the intro and the 404: the featured work first, then
 * every other project in the site's order. Julian: fill the page with work,
 * each card a different project. With every project on it, each column
 * holds several and no card on screen repeats another. Built here, on the
 * server, so a client component is handed three strings a tile and never
 * the projects; its image URLs are made where it is drawn (`wall-tile.ts`).
 */
export const WALL: WallTile[] = [
  ...FEATURED,
  ...PROJECTS.filter((p) => !FEATURED.includes(p)),
].map((p) => wallTile(p.cover.src, p.name, `/portfolio/${p.slug}`));

/**
 * The same wall for one kind of session, behind its booking page's
 * questions: every frame of its gallery, or of every project in its
 * discipline, each opening the project it is from.
 */
export const wallOf = (slug: string): WallTile[] => {
  const one = getProject(slug);
  return (one ? [one] : projectsIn(slug)).flatMap((p) =>
    p.images.map((f) => wallTile(f.src, p.name, `/portfolio/${p.slug}`)),
  );
};

/**
 * The discipline after this one, for a page that *is* a discipline.
 *
 * A gallery published under its own slug has no sibling project to go to —
 * `nextAfter` would hand it whatever happens to sit next in the running
 * order, which from Event coverage was a mixed-media project called
 * ÆRA:WRAITH. Following the chips instead keeps a visitor moving through the
 * work the way the index presents it, and wraps at the end so there is always
 * somewhere to go.
 *
 * Declared after `WORK_CATEGORY_LINKS`, whose order it follows.
 */
export const nextDiscipline = (
  slug: string,
): { href: string; name: string } | undefined => {
  const at = WORK_CATEGORY_LINKS.findIndex((c) => c.slug === slug);
  if (at === -1 || WORK_CATEGORY_LINKS.length < 2) return undefined;
  const next = WORK_CATEGORY_LINKS[(at + 1) % WORK_CATEGORY_LINKS.length];
  return { href: next.href, name: next.name };
};

/**
 * The discipline a project belongs to, for the purpose of what follows it.
 *
 * The first of its categories that the index actually shows a chip for, so a
 * project filed under two is walked once and not twice. Seventy-two of the
 * seventy-three carry exactly one category, so this is a tie-break rather
 * than a policy.
 */
const disciplineOf = (p: Project): string | undefined =>
  (
    p.categories.find((c) =>
      WORK_CATEGORY_LINKS.some((l) => l.slug === c.slug),
    ) ?? p.categories[0]
  )?.slug;

/**
 * The commissions filed under one discipline, in Julian's running order.
 *
 * By `disciplineOf` rather than by membership, so the buckets divide the
 * commissions up rather than overlapping: every project is in exactly one,
 * which is what makes the walk below a walk and not a set of loops.
 */
export const commissionsIn = (categorySlug: string): Project[] =>
  COMMISSIONS.filter((p) => disciplineOf(p) === categorySlug);

/**
 * The project after this one, for the end of a sequence.
 *
 * It stays inside the discipline you are looking at. Someone who opens an
 * editorial story and keeps going is looking at editorial work, and handing
 * them a wedding next because it happens to sit there in the running order
 * answers a question they did not ask. So: the next project in this
 * discipline, in the order the category page shows them, and when the
 * discipline runs out the one closest to it. Julian asked for this.
 *
 * "Closest" is the order he has already set. `WORK_CATEGORY_LINKS` is hand
 * ordered — the photographic disciplines first and the reel last — it is the
 * chip row a visitor has already read on /work, and `nextDiscipline` walks
 * it as an adjacency too. A second table of what relates to what would say
 * the same thing twice and drift the first time a discipline is added; if a
 * pair ever reads wrong, reorder that one list and everything follows.
 *
 * It wraps, because a dead end is an exit. And it runs both ways: the same
 * walk backwards is the project before, for a wheel pushed past the start.
 */
const neighbour = (p: Project, dir: 1 | -1): Project | undefined => {
  /* Sessions keep their own pool, unchanged. A graduation client and an art
     director are not looking at the same thing, and a headshot should not
     lead into a campaign. */
  if (p.categories.some((c) => c.section === "SESSIONS")) {
    const i = SESSIONS.findIndex((x) => x.slug === p.slug);
    const n = SESSIONS.length;
    return i === -1 ? SESSIONS[0] : SESSIONS[(i + dir + n) % n];
  }

  const here = disciplineOf(p);
  const siblings = here ? commissionsIn(here) : [];
  const i = siblings.findIndex((x) => x.slug === p.slug);
  if (i !== -1 && siblings[i + dir]) return siblings[i + dir];

  /* The discipline has run out, so the next one along the row — hopping any
     that has a chip but no projects behind it, which is how a one-gallery
     discipline like Cover art is filed. Going back, it is the last project
     of the discipline before. An unfiled project starts the walk at the
     first discipline, which is where the old running order put it too. */
  const at = WORK_CATEGORY_LINKS.findIndex((l) => l.slug === here);
  const n = WORK_CATEGORY_LINKS.length;
  for (let hop = 1; hop <= n; hop++) {
    const run = commissionsIn(
      WORK_CATEGORY_LINKS[(at + dir * hop + 2 * n) % n].slug,
    );
    const found = run[dir > 0 ? 0 : run.length - 1];
    if (found) return found;
  }
  return COMMISSIONS[0];
};
export const nextAfter = (p: Project) => neighbour(p, 1);

/**
 * The cover-art work.
 *
 * It sits apart from the rest of the archive because its format does: every
 * frame is exactly 1:1, because that is what a release needs. Shown in a
 * square grid rather than folded into the portrait-shaped selected-work grid,
 * where squares would have to be cropped to fit.
 */
export const COVER_ART: Project | undefined = getProject("coverart");
