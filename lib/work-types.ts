/**
 * The shape of the work manifest.
 *
 * Kept separate from `work.ts` because that file is generated — the harvester
 * overwrites it, and a hand-written type would go with it.
 */

/**
 * The old site's three nav groups. Kept because they encode something real —
 * who the work is *for* — even though the new nav collapses MUSIC into Work
 * and gives Sessions its own path.
 */
export type Section = "WORK" | "SESSIONS" | "MUSIC";

export type Category = {
  /** Route segment, matching the old site so inbound links keep working. */
  slug: string;
  /** As it reads in the nav. Uppercase on the old site. */
  name: string;
  /** Null for a category the old nav never linked. */
  section: Section | null;
};

export type Frame = {
  /** Path under `public/`. */
  src: string;
  width: number;
  height: number;
  /**
   * The image's dominant colour, from Format's own analysis. Used as the
   * placeholder behind a frame while it decodes, which reads better than a
   * grey box: the page settles *into* the photograph rather than replacing a
   * different colour with it.
   */
  color: string;
  /** Empty on most frames — the old site never filled these in. */
  alt: string;
};

export type Credit = {
  /** "Photographer", "Client", "Styling"… */
  role: string;
  name: string;
};

export type Project = {
  slug: string;
  name: string;
  /** The heading from the old title block, where it differs from `name`. */
  headline: string | null;
  /** Prose left over after the credits were parsed out. Usually null. */
  intent: string | null;
  credits: Credit[];
  /** Every category this project is listed under, old-site order. */
  categories: Category[];
  /**
   * A 600px copy of the opening frame. The corridor and the work index show
   * dozens of frames at once and none of them large; pointing those at the
   * full-size originals costs megabytes before anything is visible.
   */
  cover: Frame;
  images: Frame[];
};
