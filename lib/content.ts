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
import {
  isValidId,
  type Provider,
  type Video,
  type VideoSection,
} from "./videos";

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
  /**
   * Cover-art releases to lead the homepage rack, in order.
   *
   * May be shorter than the rack — `components/cover-art.tsx` fills the
   * remainder from the manifest, so the grid is always full and an empty list
   * means exactly what it did before this existed.
   */
  coverArt: string[];
  /**
   * Which disciplines the cover cycles through, in order.
   *
   * Separate from which disciplines exist, because the two questions are
   * different: every discipline gets a page and a row in the work index, and
   * the cover shows a handful. Seven of the thirteen are already on the site
   * without being on the cover — video, event coverage, music video and the
   * four session types.
   *
   * Empty means the six `lib/work.ts` has always led with, so the homepage is
   * unchanged until somebody decides otherwise. A slug naming a discipline
   * with no work, or none at all, is dropped when the list is built: the
   * cover needs a photograph to show for a discipline and cannot invent one.
   */
  heroDisciplines: string[];
  testimonials: Testimonial[];
  sessions: SessionType[];
  /**
   * The moving work, in the order the page shows it.
   *
   * Absent in files written before there was a video page, which is not an
   * error — it means nothing has been added yet, and the page says so.
   */
  videos: Video[];
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
  typeof v === "string" && v.trim() !== ""
    ? v
    : fail(path, "a non-empty string", v);

/** A string, or null for "not set yet" — which several fields treat as meaningful. */
const strOrNull = (v: unknown, path: string): string | null =>
  v === null ? null : str(v, path);

const strList = (v: unknown, path: string): string[] =>
  Array.isArray(v)
    ? v.map((x, i) => str(x, `${path}[${i}]`))
    : fail(path, "an array", v);

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

const list = <T>(
  v: unknown,
  path: string,
  each: (x: unknown, p: string) => T,
): T[] =>
  Array.isArray(v)
    ? v.map((x, i) => each(x, `${path}[${i}]`))
    : fail(path, "an array", v);

/**
 * A link, held to a scheme a browser may safely follow.
 *
 * `bookingUrl` is printed straight into an `href` on the contact page and
 * beside every session, and it was validated only as "a string" — so
 * `javascript:` in that field would have been a script that runs on click.
 * Reaching the field needs write access to the repo, so this was never the
 * easy way in; it is also the exact shape of the hole already closed on
 * Instagram handles, and a content file edited through a browser form should
 * not be the last line of defence for what lands in an attribute.
 *
 * http and https only. Not a parser for what Google Calendar accepts — the
 * hint beside the field does that — just a refusal of the schemes that
 * execute.
 */
function httpUrlOrNull(value: unknown, path: string): string | null {
  const raw = strOrNull(value, path);
  if (raw === null) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return fail(path, "a full URL beginning http:// or https://", raw);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return fail(path, "an http or https URL", raw);
  }
  return raw;
}

/* ── a video ──────────────────────────────────────────────────────
 * Stricter than the rest of this file, because two of these fields end up
 * inside a URL that becomes an iframe `src` and an `img` `src`. The id is
 * matched against what the provider actually issues, and the poster is held
 * to https on the two hosts that serve provider stills — the same two the
 * Content-Security-Policy allows, so anything else would have been a broken
 * image at best and is refused outright here.
 *
 * Every failure throws, like the rest: a bad field fails the build and the
 * live site keeps serving the last good one.
 * ─────────────────────────────────────────────────────────────── */

const PROVIDERS: Provider[] = ["youtube", "vimeo"];
const VIDEO_SECTIONS: VideoSection[] = ["music", "commercial"];

/** The hosts that serve provider stills. Nothing else may be a poster. */
const POSTER_HOSTS = ["i.ytimg.com", "i.vimeocdn.com"];

function posterOrUndefined(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const url = str(value, path);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return fail(path, "a full https URL", url);
  }
  if (parsed.protocol !== "https:") return fail(path, "an https URL", url);
  if (!POSTER_HOSTS.includes(parsed.hostname))
    return fail(path, `a still on ${POSTER_HOSTS.join(" or ")}`, url);

  return url;
}

function year(value: unknown, path: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1990 &&
    value <= 2100
    ? value
    : fail(path, "a four-digit year", value);
}

function video(v: unknown, path: string): Video {
  if (!isRecord(v)) return fail(path, "an object", v);

  const provider = PROVIDERS.includes(v.provider as Provider)
    ? (v.provider as Provider)
    : fail(path + ".provider", PROVIDERS.join(" or "), v.provider);

  const videoId = str(v.videoId, `${path}.videoId`);
  if (!isValidId(provider, videoId))
    fail(`${path}.videoId`, `a ${provider} id`, videoId);

  const section = VIDEO_SECTIONS.includes(v.section as VideoSection)
    ? (v.section as VideoSection)
    : fail(path + ".section", VIDEO_SECTIONS.join(" or "), v.section);

  return {
    // Falls back to the provider's id, so a file hand-edited without one
    // still has something stable per row.
    id: v.id === undefined ? `${provider}-${videoId}` : str(v.id, `${path}.id`),
    title: str(v.title, `${path}.title`),
    provider,
    videoId,
    section,
    client: optional(v.client, `${path}.client`),
    year: year(v.year, `${path}.year`),
    poster: posterOrUndefined(v.poster, `${path}.poster`),
  };
}

function parse(v: unknown): SiteContent {
  if (!isRecord(v)) return fail("the file", "an object", v);

  return {
    responseTime: strOrNull(v.responseTime, "responseTime"),
    bookingUrl: httpUrlOrNull(v.bookingUrl, "bookingUrl"),
    coverSlug: str(v.coverSlug, "coverSlug"),
    featured: strList(v.featured, "featured"),
    // Absent in files written before the rack could be curated, which is not
    // an error — it simply means nothing has been picked.
    coverArt: strList(v.coverArt ?? [], "coverArt"),
    heroDisciplines: strList(v.heroDisciplines ?? [], "heroDisciplines"),
    testimonials: list(v.testimonials, "testimonials", testimonial),
    sessions: list(v.sessions, "sessions", session),
    videos: list(v.videos ?? [], "videos", video),
  };
}

export const CONTENT: SiteContent = parse(raw);

/** Where the editor reads and writes. Shown in the editor so it is not a mystery. */
export const CONTENT_PATH = "content/site.json";
