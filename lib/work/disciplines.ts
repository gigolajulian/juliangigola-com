/**
 * The disciplines: the homepage's cycle (`DISCIPLINES`), the frame each category is shown by (`categoryFrame`)
 * and the homepage's discipline tiles (`DISCIPLINE_TILES`). Built over the project list in `work.ts`.
 */
import type { Project, Category, Frame } from "./work-types";
import { CONTENT } from "../content";
import { REEL } from "./videos";
import { DISCIPLINE_COVERS } from "./added";
import {
  getProject,
  projectsIn,
  CATEGORIES,
  PROJECTS,
  COVER_RELEASES,
  FEATURED,
  categoryLabel,
  categoryHref,
  altContext,
  isOwnGallery,
  withBlur,
  type BandTile,
} from "./work";

/**
 * The disciplines the homepage cycles through, each with a frame to show for
 * it.
 *
 * This is what the cover is *for*: "photographer" is a job title, whereas
 * editorial, campaigns, portraits, artist presskits and cover art are the
 * things somebody might actually be here to commission. Switching between them
 * says the range in the first few seconds, which one static cover cannot.
 *
 * Built from the nav's own category order rather than a hand-written list, so
 * it cannot drift out of step with the work. Each one takes its frame from the
 * first project filed under it — Julian's own ordering, so the lead project is
 * already his pick — preferring a portrait frame, because the cover sits in a
 * tall column and `object-cover` on a landscape frame there crops away both
 * sides.
 */
export type Discipline = {
  slug: string;
  name: string;
  /** How many projects are filed under it, for the index. */
  count: number;
  /** Where the row goes when clicked. */
  href: string;
  /**
   * What the frame on screen is, and where it goes.
   *
   * A project, for every discipline whose frame comes out of the archive.
   * Video's frame can be a film's poster instead, and then the thing to
   * credit is the film — so this is a name and an href rather than a
   * `Project`, and it is optional: a frame nobody can be credited for draws
   * no label, which the cover already handled (`if (!project) return null`)
   * before there was a case that reached it.
   */
  credit?: { name: string; href: string };
  frame: Frame;
};

/**
 * Hand-picked cover frames, overriding the one derived from the archive.
 *
 * These live in `public/hero/` rather than in `public/work/`, because they are
 * chosen to be a cover — a specific frame Julian wants leading the site —
 * rather than being part of a project's sequence. That also keeps them clear
 * of `scripts/harvest.mjs`, which owns everything under `public/work/`.
 *
 * `color` is the mat drawn behind the picture where the column is wider or
 * taller than the frame. It is the image's mean, not its dominant: on a
 * sunset frame the dominant bucket comes back near-black, which reads as a
 * letterbox bar instead of a mount.
 *
 * Add a full-resolution original to `PICS/`, then process it the same way the
 * archive is processed — 2500px wide, mozjpeg q82 — and add an entry here.
 */

/**
 * An override that names a frame already in the archive.
 *
 * Dimensions are read from the manifest rather than written here, so a
 * re-harvest cannot leave a stale copy: a wrong `width`/`height` on a `fill`
 * image reserves the wrong aspect ratio, and the cover column jumps when the
 * picture arrives.
 *
 * Only `alt` is stated, because that is the one thing the harvest genuinely
 * does not know: 1,084 frames came across with none.
 */
const archiveFrame = (src: string, alt: string): Frame => {
  const project = PROJECTS.find((p) => p.images.some((f) => f.src === src));
  const found = project?.images.find((f) => f.src === src);
  // Naming a frame that does not exist is an editorial mistake, not a runtime
  // condition to paper over — and a silent fallback here would put the wrong
  // photograph at the top of the homepage.
  if (!project || !found) throw new Error(`Cover override names a frame not in the archive: ${src}`);
  return { ...found, alt: `${alt}. ${altContext(project)}` };
};

const COVER_OVERRIDES: Record<string, Frame> = {
  /* FAUXTOPIA's opening frame. It was a copy in `/hero/`, which has no
     project in its path, so the credit fell back to the first portrait
     project and the cover linked to OPAL. Pointing at the archive frame lets
     `frameProject` name the shoot the photograph is from. */
  portraits: archiveFrame("/work/fauxtopia/01.jpg", "Model in a fur-trimmed hooded coat on the shoreline at sunset"),
  // Exactly 4:5, so it fills the cover column with nothing cropped at all —
  // the only frame in the archive that does.
  editorial: archiveFrame(
    "/work/i-wanna-be-a-human/01.jpg",
    "Model in a sculptural black PVC and tulle look, flanked by motion-blurred figures",
  ),
  // Already in the archive, so it points there rather than getting a copy in
  // `/hero/` — the override exists to name the frame, and the frame is a
  // UKIYOSUNKNOWN one rather than the first of the first project filed under
  // campaigns, which is what it would otherwise be. The credit follows the
  // frame, via `frameProject` below.
  campaigns: archiveFrame(
    "/work/ukiyosunknown/01.jpg",
    "Model crouched on a studio floor beside a CRT television, looking away from camera",
  ),
  /* The one frame on the cover that is not a photograph at all: a still from
     the Director's Reel, which is what MOTION is actually an index of.
     Without it the row fell back to the first film's YouTube thumbnail, which
     is 216x162 and was being drawn at 797x997, a four and a half times
     upscale of a postage stamp, and it looked it. Cropped to 4:5 from the
     3840x2160 master and sized the way `coverart` below is. */
  video: {
    src: "/hero/motion.jpg",
    width: 2500,
    height: 3125,
    color: "#80888B",
    alt: "Two lowriders on the waterfront at golden hour, the Bay Bridge and the downtown skyline behind them",
  },
  coverart: {
    // The one discipline whose work is not a photograph but a released object,
    // so it is shown as one: sleeves laid out as prints, the lead release
    // square to camera and the rest running off the edges. A single sleeve
    // pulled from the archive says "here is a picture"; the spread says "here
    // is a body of covers", which is the claim the row is making.
    src: "/hero/coverart.jpg",
    width: 2500,
    height: 3125,
    color: "#65696A",
    alt: "Album sleeves laid out as prints, EST MODVS IN REBVS square to camera at the centre",
  },
};

/**
 * The photograph that stands for a category.
 *
 * Shared by the cover's index and the discipline page's header, so the frame
 * a visitor sees for CAMPAIGNS on the homepage is the same one they land on
 * when they click it. Overridden by hand where the derived choice is not the
 * right one, and otherwise the opening frame of whatever project leads the
 * category — Julian's own ordering, so it is already his pick.
 *
 * Prefers a portrait frame: both places put this in a tall column, where
 * `object-cover` on a landscape frame crops away both sides.
 */
export const categoryFrame = (categorySlug: string): Frame | null => {
  // Picked in /admin, and it wins: `COVER_OVERRIDES` below is the default
  // somebody committed by hand, and a choice made in the editor should not
  // lose to one made in code months ago.
  //
  // A path here rather than a whole frame, so the dimensions and mat colour
  // come from the archive — and `?? null` rather than a throw, because
  // `archiveFrame` throwing is right for a typo in code and wrong for a
  // browser form: a frame that has since been removed from a gallery should
  // cost this discipline its picked cover, not the whole build.
  const picked = DISCIPLINE_COVERS[categorySlug];
  if (picked) {
    const found = PROJECTS.flatMap((p) => p.images).find((f) => f.src === picked);
    if (found) return found;
  }

  const override = COVER_OVERRIDES[categorySlug];
  if (override) return override;

  const project = projectsIn(categorySlug)[0];
  if (!project) return null;

  return project.images.find((f) => f.height > f.width) ?? project.images[0] ?? null;
};

/**
 * The project a frame belongs to, read off the frame's own path.
 *
 * An override changes which photograph stands for a discipline, so the
 * credit is derived from the path rather than from the project that leads
 * the category: the caption cannot disagree with the picture.
 *
 * Frames outside `/work/<slug>/` — the hand-made ones in `/hero/` — have no
 * project, and the caller falls back to the category's lead.
 */
const frameProject = (frame: Frame): Project | undefined => getProject(frame.src.split("/")[2] ?? "");

/**
 * The disciplines the cover cycles through, in order.
 *
 * Named explicitly rather than taken as the first N categories. The nav order
 * puts `video` fifth, and `video` has no projects at all — which ones lead the
 * site is an editorial call, not something to be decided by a `slice`.
 *
 * A category with no lead project or no frame is dropped below, so this list
 * cannot put an empty discipline on the cover even if one is added to it.
 */
const DEFAULT_DISCIPLINE_SLUGS = [
  "editorial",
  "campaigns",
  "portraits",
  "mixed-media",
  "artist-presskit",
  "coverart",
  // The moving work, added last so the six the cover has always opened with
  // keep their numbers. It carries its own frame rather than one from the
  // archive — see `videoFrame`.
  "video",
];

/**
 * What the cover actually runs through.
 *
 * Curated in /admin now, falling back to the six above when nothing has been
 * chosen — so the homepage is unchanged until somebody decides otherwise, and
 * emptying the list in the editor restores the original rather than producing
 * a cover with no disciplines on it.
 *
 * Which disciplines exist and which the cover shows are two different
 * questions, and this is the second one. Every discipline gets a page and a
 * row in the work index regardless; seven of the thirteen were already on the
 * site without being on the cover before any of this was editable.
 */
const DISCIPLINE_SLUGS = CONTENT.heroDisciplines.length ? CONTENT.heroDisciplines : DEFAULT_DISCIPLINE_SLUGS;

/**
 * Where the unit of work is not a frame.
 *
 * Cover art is counted in releases: two of them are sleeves with a front and
 * a back, and counting those as two covers each both overstates the work and
 * disagrees with the number the section's own link shows.
 */
const DISCIPLINE_COUNTS: Record<string, number> = {
  coverart: COVER_RELEASES.length,
  // Films, not projects: Video has no projects in the archive at all.
  video: CONTENT.videos.length,
};

/**
 * The cover frame for Video, which has no work in the archive to derive one
 * from.
 *
 * A picked frame first — /admin's Disciplines tab writes one into
 * `DISCIPLINE_COVERS`, and a photograph of his own at full resolution with a
 * real mat colour is the better cover by a distance.
 *
 * Failing that, the first film's own still, so the row works the moment a
 * link is pasted rather than waiting on a second decision. `maxresdefault`
 * and not the default `hqdefault`: 1280x720 against 480x360, and this is the
 * largest paint on the page. The mat is left transparent because a provider
 * still comes with no colour analysis — the section's own ground shows
 * through while it decodes, which is the theme-appropriate answer rather than
 * a guessed one.
 *
 * The loader already handles the remote URL: "an absolute URL is somebody
 * else's and is already complete" (`image-loader.ts`), so it passes through
 * untransformed.
 */
const videoFrame = (): Frame | null => {
  const picked = categoryFrame("video");
  if (picked) return picked;

  const film = CONTENT.videos[0];
  if (!film) return null;

  const still = film.poster ?? (film.provider === "youtube" ? `https://i.ytimg.com/vi/${film.videoId}/maxresdefault.jpg` : null);
  if (!still) return null;

  return {
    src: still,
    width: 1280,
    height: 720,
    color: "transparent",
    alt: `${film.title}, a film by Julian Gigola`,
  };
};

export const DISCIPLINES: Discipline[] = DISCIPLINE_SLUGS.map((slug) => CATEGORIES.find((c) => c.slug === slug))
  .filter((c): c is Category => Boolean(c))
  .map((category) => {
    const inCategory = projectsIn(category.slug);
    const lead = inCategory[0];

    /* Video is the one discipline with no work in the archive: its films live
       on YouTube and Vimeo and its frame comes from `videoFrame`. So the
       "no lead project" test cannot be the gate for it — what gates it is
       having a film at all, which is the same rule the work index applies to
       its chip. */
    const isVideo = category.slug === "video";
    if (!lead && !isVideo) return null;
    if (isVideo && CONTENT.videos.length === 0) return null;

    const frame = isVideo ? videoFrame() : categoryFrame(category.slug);
    if (!frame) return null;

    // Whatever the frame actually came from, so the cover's credit names the
    // picture on screen. Only differs from the lead where an override has
    // reached into another project for the frame.
    const project = frameProject(frame) ?? lead;

    // Some nav leaves are a listing of many projects (EDITORIAL); others are
    // themselves a single gallery (COVERART, WEDDINGS). Counting projects for
    // the second kind always reports "1", which is true and useless — the
    // number a visitor wants is how much work is in there.
    const count =
      DISCIPLINE_COUNTS[category.slug] ??
      // `lead`, not `project`: where the category *is* a gallery, the number
      // is that gallery's size — not the size of whatever project an override
      // happened to borrow a frame from.
      (isOwnGallery(category.slug) ? lead!.images.length : inCategory.length);

    /* Credit the thing on screen. A photograph credits its project; a film's
       poster credits the film, and goes to the page it plays on. */
    const credit = project
      ? { name: project.name, href: `/portfolio/${project.slug}` }
      : isVideo
        ? // The reel, not `videos[0]`. The frame above is a still from it,
          // and the rule for this corner is that it credits what is on
          // screen: CLEAN printed under a frame from the reel is the kind of
          // caption nobody notices until they do.
          { name: REEL.title, href: "/portfolio/video" }
        : undefined;

    return {
      slug: category.slug,
      name: categoryLabel(category),
      count,
      href: categoryHref(category.slug),
      // Spread rather than assigned: `credit?:` means absent, and `strict`
      // will not take `undefined` for it.
      ...(credit ? { credit } : {}),
      frame,
    };
  })
  .filter((d): d is Discipline => d !== null);

/* Julian: photo / design / video. Which of the three each discipline is,
   printed on its tile; mixed media is both of the first two. */
const MEDIUM: Record<string, string> = {
  "mixed-media": "Photo / Design",
  coverart: "Design",
  video: "Video",
};
const mediumOf = (disciplineSlug: string): string => MEDIUM[disciplineSlug] ?? "Photo";

/* The homepage's selected work, a tile a discipline (Julian: the best
   photo from each, leading to its project): the frame picked for it in
   /admin, the discipline's name on the plate, the project under it, and
   its medium on the last line. Julian's eight, in this order. Chroma took
   Studio digitals' place (Julian: a better one): his second largest body
   of work after Editorial, and one of his featured sets. It is not one
   of the cover's disciplines, so its tile is made here from the
   category, the same way.

   Julian: a hover shows my favorite set's best photo from the
   discipline: the cover of the first of his featured sets (/admin) filed
   under it, bar the set the tile already shows. With none, the next set
   filed there (Julian: a different project from Portraits). With none
   of those, a frame of the tile's own set it is not showing (a cover is
   its set's first frame again, so the first one past the tile's).
   Motion has no sets: Julian, the reel, muted, from three seconds in as
   on the motion page. */
/* Julian's order for the homepage's Commissions: event coverage in,
   Chroma out. */
const TILE_SLUGS = ["campaigns", "artist-presskit", "editorial", "portraits", "mixed-media", "events", "coverart", "video"];
/* Julian's picks: Cover Art keeps its photograph of the covers laid out
   and shows The River on hover; Mixed media shows Wrapped Up and
   Metamorphosis on hover; Artist presskit is Valgur; Chroma is Liminal,
   with a good blue one on hover (Julian: maybe Analogue Dreams): its
   frame 06, the bluest of the set with a subject in it. */
const TILE_PICKS: Record<string, { frame?: Frame; project?: string; hover?: string; hoverFrame?: Frame }> = {
  coverart: { hoverFrame: COVER_RELEASES.find((r) => r.slug === "the-river")?.frames[0] },
  "mixed-media": { project: "wrapped-up", hover: "metamorphosis" },
  "artist-presskit": { project: "valgur" },
  chroma: {
    project: "liminal",
    hoverFrame: getProject("analogue-dreams")?.images.find((f) => f.src.endsWith("/06.jpg")),
  },
};
const tileDiscipline = (slug: string): Discipline | undefined => {
  const found = DISCIPLINES.find((d) => d.slug === slug);
  if (found) return found;
  const category = CATEGORIES.find((c) => c.slug === slug);
  const frame = categoryFrame(slug);
  if (!category || !frame) return undefined;
  const project = frameProject(frame);
  return {
    slug,
    name: categoryLabel(category),
    count: projectsIn(slug).length,
    href: categoryHref(slug),
    ...(project ? { credit: { name: project.name, href: `/portfolio/${project.slug}` } } : {}),
    frame,
  };
};
export const DISCIPLINE_TILES: (BandTile & { medium: string; count: number; category: string })[] = TILE_SLUGS.map(tileDiscipline)
  .filter((d): d is Discipline => Boolean(d))
  .map((d) => {
    const pick = TILE_PICKS[d.slug] ?? {};
    const shown = pick.project ? getProject(pick.project) : undefined;
    const slug = shown?.slug ?? (d.credit?.href ?? `/portfolio/${d.slug}`).split("/")[2] ?? d.slug;
    const project = getProject(slug);
    const frame = pick.frame ?? shown?.cover ?? d.frame;
    const favorite =
      (pick.hover ? getProject(pick.hover) : undefined) ??
      FEATURED.find((p) => p.slug !== slug && p.categories.some((c) => c.slug === d.slug)) ??
      projectsIn(d.slug).find((p) => p.slug !== slug);
    const best = pick.hoverFrame ?? favorite?.cover ?? project?.images.find((f) => f.src !== frame.src);
    const client = shown?.name ?? d.credit?.name;
    return {
      slug,
      href: d.href,
      name: d.name,
      cover: withBlur(frame),
      frames: best ? [best] : [],
      total: project?.images.length ?? d.count,
      ...(client ? { client } : {}),
      discipline: mediumOf(d.slug),
      medium: mediumOf(d.slug),
      // How many projects the discipline holds (the homepage's index).
      count: d.count,
      // The discipline itself, where `slug` is the project on show.
      category: d.slug,
      ...(d.slug === "video"
        ? {
            reel: `https://player.vimeo.com/video/${REEL.videoId}?background=1&autoplay=1&loop=1&muted=1&dnt=1#t=3s`,
          }
        : {}),
    };
  });
