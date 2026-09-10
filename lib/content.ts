/**
 * The content the admin editor writes.
 *
 * Everything here used to be a hand-edited literal in `site.ts`,
 * `sessions.ts`, `testimonials.ts` and `work.ts`. It moved into one JSON file
 * so that a form can change it: `/admin` commits this file to the repo and
 * the deploy rebuilds. Those modules still export the shapes the components
 * read, so nothing downstream knows the difference.
 *
 * The photographs are not here. They are files, they come from the harvester
 * and from `cover-art.mjs`, and a text field is the wrong instrument for
 * choosing one — what is editable here is the writing and the ordering.
 */

// Relative, not the `@/` alias: `next.config.ts` reaches this module (through
// `work.ts`, for the old category redirects) and is transpiled outside the
// app's path mapping, where `@/` does not resolve.
import raw from "../content/site.json";

export type Testimonial = {
  quote: string;
  name: string;
  /** Role and company, e.g. "Art Director, WIRED". */
  role?: string;
  /** Slug of a project this client is attached to, if any. */
  project?: string;
};

export type SessionType = {
  /** Matches a category slug in `work-data.ts`, so samples stay in sync. */
  slug: string;
  name: string;
  blurb: string;
  /** Starting price in USD. `null` renders as "On request". */
  from: number | null;
  /** What the client actually walks away with. */
  includes: string[];
  turnaround: string;
};

export type SiteContent = {
  responseTime: string | null;
  bookingUrl: string | null;
  coverSlug: string;
  featured: string[];
  testimonials: Testimonial[];
  sessions: SessionType[];
};

/* ── validation ───────────────────────────────────────────────────
 * This file arrives over the GitHub API from a browser form, so it is not
 * assumed to be well-formed just because it parses as JSON.
 *
 * Every failure throws rather than falling back to a default. The check runs
 * at build time, so a bad field fails the deploy and the live site keeps
 * serving the last good build — which is the safe direction to fail in. A
 * silent fallback would publish a page with a section quietly missing.
 * ─────────────────────────────────────────────────────────────── */

const fail = (path: string, wanted: string, got: unknown): never => {
  throw new Error(
    `content/site.json: ${path} should be ${wanted}, got ${JSON.stringify(got) ?? typeof got}`,
  );
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A non-empty string. Blank fields are a mistake, not a value. */
const str = (v: unknown, path: string): string =>
  typeof v === "string" && v.trim() !== "" ? v : fail(path, "a non-empty string", v);

/** A string, or null for "not set yet" — which several fields treat as meaningful. */
const strOrNull = (v: unknown, path: string): string | null =>
  v === null ? null : str(v, path);

const strList = (v: unknown, path: string): string[] =>
  Array.isArray(v) ? v.map((x, i) => str(x, `${path}[${i}]`)) : fail(path, "an array", v);

const money = (v: unknown, path: string): number | null => {
  if (v === null) return null;
  // Finite and non-negative: `Infinity` and `-1` both parse as numbers and
  // both would render as a price.
  return typeof v === "number" && Number.isFinite(v) && v >= 0
    ? v
    : fail(path, "a price in dollars or null", v);
};

/** An optional string field: absent, or present and real. Blank is dropped. */
const optional = (v: unknown, path: string): string | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  return str(v, path);
};

const testimonial = (v: unknown, path: string): Testimonial => {
  if (!isRecord(v)) return fail(path, "an object", v);
  return {
    quote: str(v.quote, `${path}.quote`),
    name: str(v.name, `${path}.name`),
    role: optional(v.role, `${path}.role`),
    project: optional(v.project, `${path}.project`),
  };
};

const session = (v: unknown, path: string): SessionType => {
  if (!isRecord(v)) return fail(path, "an object", v);
  return {
    slug: str(v.slug, `${path}.slug`),
    name: str(v.name, `${path}.name`),
    blurb: str(v.blurb, `${path}.blurb`),
    from: money(v.from, `${path}.from`),
    includes: strList(v.includes, `${path}.includes`),
    turnaround: str(v.turnaround, `${path}.turnaround`),
  };
};

const list = <T>(v: unknown, path: string, each: (x: unknown, p: string) => T): T[] =>
  Array.isArray(v) ? v.map((x, i) => each(x, `${path}[${i}]`)) : fail(path, "an array", v);

function parse(v: unknown): SiteContent {
  if (!isRecord(v)) return fail("the file", "an object", v);

  return {
    responseTime: strOrNull(v.responseTime, "responseTime"),
    bookingUrl: strOrNull(v.bookingUrl, "bookingUrl"),
    coverSlug: str(v.coverSlug, "coverSlug"),
    featured: strList(v.featured, "featured"),
    testimonials: list(v.testimonials, "testimonials", testimonial),
    sessions: list(v.sessions, "sessions", session),
  };
}

export const CONTENT: SiteContent = parse(raw);

/** Where the editor reads and writes. Shown in the editor so it is not a mystery. */
export const CONTENT_PATH = "content/site.json";
