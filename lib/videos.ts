/* ── video ────────────────────────────────────────────────────────
 * The moving work: music videos and commercials, embedded from YouTube or
 * Vimeo rather than hosted here.
 *
 * Not hosted here for the obvious reason — a 200MB master on a static host is
 * a bandwidth bill and a buffering visitor — and for a less obvious one: the
 * clients these are for already have them on their own channels, and an embed
 * plays the copy that has the client's view count on it.
 *
 * What this site owns is the poster and the arrangement. Nothing from YouTube
 * or Vimeo loads until somebody presses play: a video page that mounts eight
 * iframes has fetched a megabyte of somebody else's JavaScript, set their
 * cookies and lost its LCP before a visitor has decided to watch anything.
 * So each tile is a still with a play button, and the iframe replaces it on
 * the click that asks for it.
 *
 * This module is the part with no React in it — parsing what Julian pastes,
 * working out where the still lives, building the embed URL — so
 * `scripts/check-videos.mjs` can run the real functions. Which matters most
 * for the parsing: a YouTube link has six shapes in the wild and a Vimeo one
 * four, and the id ends up inside an iframe's `src`.
 * ─────────────────────────────────────────────────────────────── */

export type Provider = "youtube" | "vimeo";

/** The two halves of the page. `id` is what the content file stores. */
export type VideoSection = "music" | "commercial";

export type Video = {
  /** Stable across edits, so reordering and React keys have something real. */
  id: string;
  title: string;
  provider: Provider;
  /** The provider's own id, validated — it goes into an iframe `src`. */
  videoId: string;
  section: VideoSection;
  /** The artist or the brand. Printed under the title where it is set. */
  client?: string;
  year?: number;
  /**
   * The still to show before play.
   *
   * YouTube publishes four of them at predictable URLs, so a YouTube video
   * needs this only when Julian prefers a different one to the default.
   * Vimeo's are behind their API, so a Vimeo video always carries the URL the
   * admin panel looked up when the link was pasted.
   */
  poster?: string;
};

export const SECTIONS: { id: VideoSection; name: string }[] = [
  { id: "music", name: "Music video" },
  { id: "commercial", name: "Commercial" },
];

export const sectionName = (id: VideoSection): string =>
  SECTIONS.find((s) => s.id === id)?.name ?? "Video";

/* ── what may be in an id ─────────────────────────────────────────
 * Both of these end up inside a URL that becomes an iframe's `src`, and the
 * value arrives from a form in a browser. So they are matched against what
 * the provider actually issues rather than escaped and hoped for: eleven
 * characters of YouTube's alphabet, or Vimeo's digits.
 *
 * This is the same hole already closed on Instagram handles and on
 * `bookingUrl` — a content file edited through a form is not the last line of
 * defence for what lands in an attribute.
 * ─────────────────────────────────────────────────────────────── */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;

export const isValidId = (provider: Provider, id: string): boolean =>
  provider === "youtube" ? YOUTUBE_ID.test(id) : VIMEO_ID.test(id);

/**
 * What Julian pasted, as a provider and an id.
 *
 * Every shape either site hands out when you press Share or copy the address
 * bar, plus the bare id, because pasting `dQw4w9WgXcQ` is a thing people do.
 * Returns null rather than guessing: a link that cannot be read has to be
 * said so, or the tile is a dead player nobody notices until a client does.
 */
export function parseVideoUrl(
  raw: string,
): { provider: Provider; videoId: string } | null {
  const text = raw.trim();
  if (!text) return null;

  // A bare id, which is unambiguous only for YouTube — Vimeo's are digits and
  // so is half of everything else somebody might paste.
  if (YOUTUBE_ID.test(text)) return { provider: "youtube", videoId: text };

  let url: URL;
  try {
    url = new URL(text.startsWith("http") ? text : `https://${text}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  // Path segments, empty ones dropped, so a trailing slash changes nothing.
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") {
    const id = parts[0] ?? "";
    return YOUTUBE_ID.test(id) ? { provider: "youtube", videoId: id } : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    // /watch?v=ID, and /embed/ID, /v/ID, /shorts/ID, /live/ID
    const fromQuery = url.searchParams.get("v") ?? "";
    if (YOUTUBE_ID.test(fromQuery))
      return { provider: "youtube", videoId: fromQuery };

    const known = ["embed", "v", "shorts", "live"];
    if (parts.length >= 2 && known.includes(parts[0])) {
      const id = parts[1];
      return YOUTUBE_ID.test(id) ? { provider: "youtube", videoId: id } : null;
    }
    return null;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    /* Vimeo hands out five shapes and two of them have more than one number
       in the path, pointing opposite ways:

         /123456789                       the id
         /123456789/3b5d1f9a2c            unlisted — id, then a privacy hash
         /channels/staffpicks/123456789   the id is last
         /album/123/video/123456789       an album id, *then* the video id
         player.vimeo.com/video/123456789

       So "the first number" is wrong for an album and "the last" is wrong for
       an unlisted link. `video` names the thing that follows it in both album
       and player URLs; everywhere else the first number is the id. */
    const after = parts.indexOf("video");
    const id =
      after !== -1
        ? (parts[after + 1] ?? "")
        : (parts.find((p) => VIMEO_ID.test(p)) ?? "");
    return VIMEO_ID.test(id) ? { provider: "vimeo", videoId: id } : null;
  }

  return null;
}

/**
 * The stills YouTube publishes for a video, best first.
 *
 * `maxresdefault` is the uploaded thumbnail at full size and does not exist
 * for every video; `hqdefault` always does. `1/2/3.jpg` are frames the
 * encoder grabbed at a quarter, a half and three quarters of the way
 * through — which is what "pick the best screenshot" means for a video whose
 * own thumbnail is a title card.
 */
export const youtubeStills = (videoId: string): string[] => [
  `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  `https://i.ytimg.com/vi/${videoId}/1.jpg`,
  `https://i.ytimg.com/vi/${videoId}/2.jpg`,
  `https://i.ytimg.com/vi/${videoId}/3.jpg`,
];

/** Where the poster for a tile comes from. */
export const posterFor = (v: Video): string | null =>
  v.poster ??
  (v.provider === "youtube"
    ? `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
    : // Vimeo's stills are not at a guessable URL. Without one looked up, the
      // tile draws its own ground rather than a broken image.
      null);

/**
 * The iframe source, for the click that asks to play.
 *
 * `youtube-nocookie.com` because the ordinary domain sets an advertising
 * cookie on load, and this site has no cookie banner to justify. `dnt=1` on
 * Vimeo for the same reason. Autoplay is on because the click *was* the
 * press of play — a second one would be the site not listening.
 */
export const embedUrl = (v: Video): string =>
  v.provider === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${v.videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`
    : `https://player.vimeo.com/video/${v.videoId}?autoplay=1&dnt=1&title=0&byline=0&portrait=0`;

/** Where the video lives, for the visitor who would rather watch it there. */
export const watchUrl = (v: Video): string =>
  v.provider === "youtube"
    ? `https://www.youtube.com/watch?v=${v.videoId}`
    : `https://vimeo.com/${v.videoId}`;

/** Everything in one section, in the order the content file holds them. */
export const inSection = (videos: Video[], section: VideoSection): Video[] =>
  videos.filter((v) => v.section === section);
