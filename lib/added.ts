/**
 * Projects added through `/admin`, rather than harvested from the old site.
 *
 * They live in their own file for one reason: `lib/work-data.ts` is generated,
 * and `scripts/harvest.mjs` overwrites it wholesale. A project written there
 * by hand — or by the editor — survives exactly until the next harvest, and
 * then disappears without anything failing. This file is never touched by the
 * harvester, and `lib/work.ts` merges the two.
 *
 * The frames are real files under `public/work/<slug>/`, committed alongside
 * this manifest in the same commit. The editor resizes and re-encodes them in
 * the browser first, to the same 2500px/q82 the harvester uses, so a photo
 * added here is indistinguishable from one that came across in the migration.
 *
 * Validated as strictly as `content/site.json` and for the same reason: it
 * arrives over the GitHub API from a browser form, so it is not well-formed
 * merely because it parses. Every failure throws at build time, which fails
 * the deploy and leaves the last good build serving.
 */

// Relative, not `@/`: `next.config.ts` reaches this module through `work.ts`
// and is transpiled outside the app's path mapping.
import raw from "../content/projects.json";
import type { Credit, Frame } from "./work-types";

export type AddedProject = {
  slug: string;
  name: string;
  /** One category slug, matching `CATEGORIES` in the manifest. */
  categorySlug: string;
  credits: Credit[];
  /** A 600px derivative of the opening frame, for indexes and previews. */
  cover: Frame;
  images: Frame[];
};

const fail = (path: string, wanted: string, got: unknown): never => {
  throw new Error(
    `content/projects.json: ${path} should be ${wanted}, got ${JSON.stringify(got) ?? "undefined"}`,
  );
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown, path: string): string =>
  typeof v === "string" && v.trim() !== ""
    ? v
    : fail(path, "a non-empty string", v);

/** Alt may legitimately be empty — 1,084 harvested frames have none. */
const text = (v: unknown, path: string): string =>
  typeof v === "string" ? v : fail(path, "a string", v);

const num = (v: unknown, path: string): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0
    ? v
    : fail(path, "a positive number", v);

/**
 * A path under `public/`, and nothing else.
 *
 * This value is written straight into `src` on a `next/image`, from a file the
 * editor commits. Refusing anything that is not a rooted, traversal-free path
 * keeps a malformed or hostile entry from pointing the site at another origin.
 */
const src = (v: unknown, path: string): string => {
  if (typeof v !== "string" || !v.startsWith("/work/") || v.includes("..")) {
    return fail(path, "a path under /work/", v);
  }
  return v;
};

const colour = (v: unknown, path: string): string =>
  typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)
    ? v
    : fail(path, "a #rrggbb colour", v);

const frame = (v: unknown, path: string): Frame => {
  if (!isRecord(v)) return fail(path, "an object", v);
  return {
    src: src(v.src, `${path}.src`),
    width: num(v.width, `${path}.width`),
    height: num(v.height, `${path}.height`),
    color: colour(v.color, `${path}.color`),
    alt: text(v.alt ?? "", `${path}.alt`),
  };
};

/**
 * A frame in a re-sequenced gallery: a path, or a whole frame.
 *
 * The path form is the common one by far — reordering a harvested gallery
 * names frames that are already in `lib/work-data.ts`, and copying their
 * dimensions here would be duplicating numbers that the next harvest can
 * change. See `frames` on `AddedFile`.
 */
export type FrameRef = string | Frame | TextRef;

/**
 * A passage of writing sitting in a stored sequence.
 *
 * No position field: where it sits *is* its position. `/admin` sequences
 * photographs and text in one list, so a block's place comes free with the
 * order — and a stored index would be a second source of truth able to
 * disagree with the list it sits in. `lib/work.ts` counts the frames before
 * it and hands the render a number.
 *
 * `kind` is what tells the three arms of `FrameRef` apart. A bare string is a
 * path, an object with `src` is a whole frame, and this is the only one
 * carrying a tag — cheap to check and impossible to confuse with a frame.
 */
export type TextRef = {
  kind: "text";
  heading: string | null;
  body: string;
};

export const isTextRef = (f: FrameRef): f is TextRef =>
  typeof f !== "string" && "kind" in f && f.kind === "text";

/** Optional prose: absent and empty both mean "no heading". */
const maybe = (v: unknown, path: string): string | null => {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return fail(path, "a string or null", v);
  return v.trim() === "" ? null : v;
};

const textRef = (v: Record<string, unknown>, path: string): TextRef => ({
  kind: "text",
  heading: maybe(v.heading, `${path}.heading`),
  // A block with nothing in it would render as a gap in the sequence that
  // nobody put there on purpose.
  body: str(v.body, `${path}.body`),
});

const frameRef = (v: unknown, path: string): FrameRef => {
  if (typeof v === "string") return src(v, path);
  if (!isRecord(v)) return fail(path, "a path, a frame or a text block", v);
  return v.kind === "text" ? textRef(v, path) : frame(v, path);
};

/**
 * An Instagram handle, from whatever was typed into the box.
 *
 * People paste three different things and mean one: `@rice666s`, `rice666s`,
 * and the whole address off the browser bar. All three are the same account,
 * so all three are accepted and stored the same way — bare, lowercase, no
 * decoration — and the link is built from that rather than from the paste.
 *
 * Anything that survives is then held to Instagram's own alphabet: letters,
 * digits, dots and underscores. That is a validation rule and a safety one at
 * the same time — the result goes into an `href`, and refusing everything but
 * those characters is what stops a pasted `javascript:` or a path of its own
 * from ever reaching one. Nothing usable is returned as null.
 */
export const instagramHandle = (raw: string): string | null => {
  const bare = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@+/, "")
    .toLowerCase();
  // The first character must be a letter, digit or underscore. Instagram
  // allows none of its handles to open with a dot, and neither does this —
  // which is also what stops a bare `..` getting through and pointing the
  // link at Instagram's own root.
  return /^[a-z0-9_][a-z0-9._]{0,29}$/.test(bare) ? bare : null;
};

const credit = (v: unknown, path: string): Credit => {
  if (!isRecord(v)) return fail(path, "an object", v);
  return {
    role: str(v.role, `${path}.role`),
    name: str(v.name, `${path}.name`),
    // Absent and unusable are the same answer here, and both mean "print the
    // name as text". A handle is a nicety on a credit, not a reason to fail a
    // build that is otherwise fine.
    instagram:
      typeof v.instagram === "string" ? instagramHandle(v.instagram) : null,
  };
};

const project = (v: unknown, path: string): AddedProject => {
  if (!isRecord(v)) return fail(path, "an object", v);

  const slug = str(v.slug, `${path}.slug`);
  // The slug becomes a route and a directory name, so it is held to what can
  // safely be both.
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return fail(`${path}.slug`, "lowercase letters, digits and hyphens", slug);
  }

  const images = Array.isArray(v.images)
    ? v.images.map((f, i) => frame(f, `${path}.images[${i}]`))
    : fail(`${path}.images`, "an array", v.images);

  // A project with no frames renders as a title over nothing.
  if (!images.length)
    return fail(`${path}.images`, "at least one frame", images);

  return {
    slug,
    name: str(v.name, `${path}.name`),
    categorySlug: str(v.categorySlug, `${path}.categorySlug`),
    credits: Array.isArray(v.credits)
      ? v.credits.map((c, i) => credit(c, `${path}.credits[${i}]`))
      : [],
    cover: frame(v.cover, `${path}.cover`),
    images,
  };
};

/**
 * A removed project, kept for a week before its photographs go.
 *
 * Removal is not deletion. The entry leaves `projects` — so the route stops
 * being built and the work leaves every index immediately — but the files
 * stay in the repository, which makes recovery a matter of moving the entry
 * back rather than of finding the originals again.
 *
 * The clean-up is not a timer. Nothing runs on a schedule here: the site is
 * static and there is no server to tick. Anything past its week is purged the
 * next time `/admin` is opened with a working token, which means "a week" is
 * a floor, not a deadline — and that is the safer direction for the one
 * operation that cannot be undone.
 */
export type TrashedProject = AddedProject & {
  /** ISO 8601, set by the browser that removed it. */
  deletedAt: string;
};

/** How long a removed project is recoverable. */
export const TRASH_DAYS = 7;

export type AddedFile = {
  projects: AddedProject[];
  trash: TrashedProject[];
  /**
   * Projects filed under a different discipline than they arrived with.
   *
   * A map rather than a field on the project, because it has to work for the
   * 74 harvested projects too — their categories live in `lib/work-data.ts`,
   * which the harvester regenerates, so an edit there would last exactly
   * until the next run. Keyed by slug, valued by category slug; applied in
   * `lib/work.ts` after both sources are merged.
   */
  categories: Record<string, string>;
  /**
   * Projects whose gallery has been re-sequenced by hand.
   *
   * A map for the same reason `categories` is one: it has to work for the 74
   * harvested projects, whose frames live in the generated manifest. The value
   * is the whole gallery in order — what is absent from it is not shown, which
   * is how a frame is removed, and an entry not in the archive is a photograph
   * added here.
   *
   * An entry is a bare path where the frame already exists — its dimensions
   * and mat colour are read from the archive, so a re-harvest at a new
   * resolution cannot leave a stale width behind — and a whole `Frame` only
   * for a photograph added here, which exists nowhere else to be read from.
   */
  frames: Record<string, FrameRef[]>;
  /**
   * Projects whose credits have been edited by hand.
   *
   * A map for the same reason `categories` and `frames` are maps: the 74
   * harvested projects keep their credits in the generated manifest, where
   * `scripts/harvest.mjs` would overwrite an edit on the next run. The value
   * replaces the list outright rather than merging into it — a crew changes
   * by losing people as well as gaining them, and a merge could not express
   * a removal.
   *
   * An empty array is meaningful and kept: it says "this project's harvested
   * credits are wrong, publish none".
   */
  credits: Record<string, Credit[]>;
  /**
   * The running order of the work, by slug.
   *
   * One order for the whole site rather than one per discipline. A project
   * filed under two disciplines has one position, `/work` and every discipline
   * page agree, and there is a single list to reason about instead of nine
   * that can disagree with each other.
   *
   * Partial on purpose. It names only what has been dragged; anything absent
   * keeps the order the manifest gave it, after everything named here. So an
   * empty list is the site as harvested, and moving one project to the front
   * costs one entry rather than a snapshot of all seventy-three.
   */
  order: string[];
  /**
   * The photograph that stands for a discipline, by category slug.
   *
   * A frame path, not a whole `Frame`: the dimensions and mat colour are read
   * back out of the archive when it is applied, the same way `frames` does it,
   * so a re-harvest at a new resolution cannot leave a stale width behind.
   *
   * These used to be `COVER_OVERRIDES` in `lib/work.ts` — code, so choosing
   * the picture that opens the site meant a commit by hand. That map is still
   * there and still the default; this one wins over it.
   */
  covers: Record<string, string>;
  /**
   * Slugs to leave off the site.
   *
   * Harvested projects cannot be deleted: `lib/work-data.ts` is regenerated
   * from the old site, so a removal there comes back on the next harvest with
   * nothing to indicate it ever went. Suppressing them here is the only kind
   * of removal that survives, and it has the advantage of being reversible —
   * the work is still in the archive, it is simply not published.
   *
   * Applies to added projects too, so "take this down for now" is one
   * mechanism rather than two with different consequences.
   */
  hidden: string[];
};

function parse(v: unknown): AddedFile {
  if (!isRecord(v)) return fail("the file", "an object", v);
  const list = v.projects;
  if (!Array.isArray(list)) return fail("projects", "an array", list);

  const projects = list.map((p, i) => project(p, `projects[${i}]`));

  // Two projects on one slug would collide on a route and in a directory, and
  // whichever lost would simply never appear.
  const seen = new Set<string>();
  for (const p of projects) {
    if (seen.has(p.slug))
      return fail(
        "projects",
        `unique slugs — "${p.slug}" appears twice`,
        p.slug,
      );
    seen.add(p.slug);
  }

  // Absent in files written before hiding existed, which is not an error.
  const hidden = v.hidden === undefined ? [] : v.hidden;
  if (!Array.isArray(hidden)) return fail("hidden", "an array", hidden);

  const rawTrash = v.trash === undefined ? [] : v.trash;
  if (!Array.isArray(rawTrash)) return fail("trash", "an array", rawTrash);

  const trash = rawTrash.map((t, i) => {
    const p = project(t, `trash[${i}]`);
    const at = isRecord(t) ? t.deletedAt : undefined;
    // A removed project with no timestamp would never age out and would sit
    // in the bin for good, so an unparseable date is treated as "just now"
    // rather than as a reason to fail the build.
    const when =
      typeof at === "string" && !Number.isNaN(Date.parse(at))
        ? at
        : new Date().toISOString();
    return { ...p, deletedAt: when };
  });

  // A slug cannot be live and in the bin at once: the bin holds the only copy
  // of its manifest entry, and two entries would make recovery ambiguous.
  const live = new Set(projects.map((p) => p.slug));
  for (const t of trash) {
    if (live.has(t.slug)) {
      return fail(
        "trash",
        `slugs not also in projects — "${t.slug}" is in both`,
        t.slug,
      );
    }
  }

  const rawCategories = v.categories === undefined ? {} : v.categories;
  if (!isRecord(rawCategories)) {
    return fail("categories", "an object", rawCategories);
  }
  const categories: Record<string, string> = {};
  for (const [slug, category] of Object.entries(rawCategories)) {
    categories[slug] = str(category, `categories["${slug}"]`);
  }

  const rawFrames = v.frames === undefined ? {} : v.frames;
  if (!isRecord(rawFrames)) return fail("frames", "an object", rawFrames);
  const frames: Record<string, FrameRef[]> = {};
  for (const [slug, list] of Object.entries(rawFrames)) {
    if (!Array.isArray(list))
      return fail(`frames["${slug}"]`, "an array", list);
    // An empty override would publish a project as a title over nothing, and
    // it is indistinguishable from "I removed every frame and meant it" — so
    // it fails here rather than on the page.
    if (!list.length)
      return fail(`frames["${slug}"]`, "at least one frame", list);
    const sequence = list.map((f, i) => frameRef(f, `frames["${slug}"][${i}]`));
    // Text alone is an essay, not a project, and `reframe` would discard the
    // whole override rather than publish one — better to say so at the build
    // than to silently restore the original sequence.
    if (sequence.every(isTextRef)) {
      return fail(
        `frames["${slug}"]`,
        "at least one photograph, not only text",
        list,
      );
    }
    frames[slug] = sequence;
  }

  const rawCredits = v.credits === undefined ? {} : v.credits;
  if (!isRecord(rawCredits)) return fail("credits", "an object", rawCredits);
  const credits: Record<string, Credit[]> = {};
  for (const [slug, list] of Object.entries(rawCredits)) {
    if (!Array.isArray(list))
      return fail(`credits["${slug}"]`, "an array", list);
    credits[slug] = list.map((c, i) => credit(c, `credits["${slug}"][${i}]`));
  }

  const rawOrder = v.order === undefined ? [] : v.order;
  if (!Array.isArray(rawOrder)) return fail("order", "an array", rawOrder);
  const order = rawOrder.map((slug, i) => str(slug, `order[${i}]`));
  // A slug listed twice has two positions, and which one wins would depend on
  // the sort — so it is a mistake to catch here rather than a tie to break.
  const seenInOrder = new Set<string>();
  for (const slug of order) {
    if (seenInOrder.has(slug))
      return fail("order", `each slug at most once — "${slug}" is twice`, slug);
    seenInOrder.add(slug);
  }

  const rawCovers = v.covers === undefined ? {} : v.covers;
  if (!isRecord(rawCovers)) return fail("covers", "an object", rawCovers);
  const covers: Record<string, string> = {};
  for (const [category, src] of Object.entries(rawCovers)) {
    covers[category] = str(src, `covers["${category}"]`);
  }

  return {
    projects,
    trash,
    categories,
    frames,
    credits,
    order,
    covers,
    hidden: hidden.map((s, i) => str(s, `hidden[${i}]`)),
  };
}

const FILE = parse(raw);

export const ADDED: AddedProject[] = FILE.projects;
export const TRASH: TrashedProject[] = FILE.trash;
export const RECATEGORISED: Readonly<Record<string, string>> = FILE.categories;
export const REFRAMED: Readonly<Record<string, FrameRef[]>> = FILE.frames;
export const RECREDITED: Readonly<Record<string, Credit[]>> = FILE.credits;

/** The running order of the work, by slug. Partial; see `AddedFile.order`. */
export const ORDER: readonly string[] = FILE.order;

/** Hand-picked discipline covers, by category slug. Frame paths. */
export const DISCIPLINE_COVERS: Readonly<Record<string, string>> = FILE.covers;
export const HIDDEN: ReadonlySet<string> = new Set(FILE.hidden);

/** Where the editor writes. Shown in the editor so it is not a mystery. */
export const ADDED_PATH = "content/projects.json";
