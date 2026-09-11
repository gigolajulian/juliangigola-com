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

const credit = (v: unknown, path: string): Credit => {
  if (!isRecord(v)) return fail(path, "an object", v);
  return {
    role: str(v.role, `${path}.role`),
    name: str(v.name, `${path}.name`),
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

function parse(v: unknown): AddedProject[] {
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

  return projects;
}

export const ADDED: AddedProject[] = parse(raw);

/** Where the editor writes. Shown in the editor so it is not a mystery. */
export const ADDED_PATH = "content/projects.json";
