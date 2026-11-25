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
  /**
   * Where a hover preview starts, in seconds: a few seconds of the film's
   * best passage, muted, under the pointer on the motion page. Set per film
   * in `content/site.json`; a film without one starts a little way in,
   * past the slate.
   */
  previewAt?: number;
};

/**
 * The reel that opens /work/video.
 *
 * Named here rather than held in `content/site.json` with the rest, because
 * it is not one of the films in a section — it is the argument for the page,
 * and there is exactly one of it. Changing it is changing this line.
 */
export const REEL = {
  provider: "vimeo" as const,
  videoId: "895502238",
  /* The title without the year in it, because the year is its own field now
     and printing 2023 twice on one line is how a caption looks careless. */
  title: "Director's Reel",
  /* Julian's pick: the opening aerial over the interchange, a 1920
     still from his own export of the reel, kept with the app. */
  poster: "/films/directors-reel.jpg",
};

export const SECTIONS: { id: VideoSection; name: string }[] = [
  { id: "music", name: "Music video" },
  { id: "commercial", name: "Commercial" },
];

export const sectionName = (id: VideoSection): string => SECTIONS.find((s) => s.id === id)?.name ?? "Video";

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

export const isValidId = (provider: Provider, id: string): boolean => (provider === "youtube" ? YOUTUBE_ID.test(id) : VIMEO_ID.test(id));

/**
 * What Julian pasted, as a provider and an id.
 *
 * Every shape either site hands out when you press Share or copy the address
 * bar, plus the bare id, because pasting `dQw4w9WgXcQ` is a thing people do.
 * Returns null rather than guessing: a link that cannot be read has to be
 * said so, or the tile is a dead player nobody notices until a client does.
 */
export function parseVideoUrl(raw: string): { provider: Provider; videoId: string } | null {
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
    if (YOUTUBE_ID.test(fromQuery)) return { provider: "youtube", videoId: fromQuery };

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
    const id = after !== -1 ? (parts[after + 1] ?? "") : (parts.find((p) => VIMEO_ID.test(p)) ?? "");
    return VIMEO_ID.test(id) ? { provider: "vimeo", videoId: id } : null;
  }

  return null;
}

/**
 * The title, and for Vimeo the poster, from the provider's oEmbed endpoint.
 *
 * Both endpoints are public, take no key, and are named in `connect-src`. A
 * failure is not an error: the title comes back empty, to be typed instead.
 */
export async function lookupVideo(parsed: { provider: Provider; videoId: string }): Promise<{ title: string; poster?: string }> {
  let title = "";
  let poster: string | undefined;
  try {
    const endpoint =
      parsed.provider === "youtube"
        ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${parsed.videoId}`)}`
        : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${parsed.videoId}`)}`;
    // Plain fetch with its own timeout: scripts/check-videos.mjs runs this file under bare node, where "@/lib" does not resolve.
    const res = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const body = (await res.json()) as {
        title?: string;
        thumbnail_url?: string;
      };
      title = typeof body.title === "string" ? body.title : "";
      // Only Vimeo's is kept: YouTube's oEmbed hands back the small
      // `hqdefault`, which `posterFor` already derives, and storing it would
      // pin the tile to the one still rather than leaving the choice open.
      if (parsed.provider === "vimeo" && body.thumbnail_url?.startsWith("https://i.vimeocdn.com/")) poster = body.thumbnail_url;
    }
  } catch {
    // Offline, or the provider is having a day. The link is still good.
  }
  return { title, poster };
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

/** A film under the pointer: muted, no chrome, looping from its best
    passage. Both players take a start time; Vimeo's background mode has no
    controls to hide, YouTube's are switched off and its loop needs the
    film named as its own playlist. */
export const previewUrl = (v: Video): string => {
  const at = Math.max(0, Math.round(v.previewAt ?? 8));
  return v.provider === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${v.videoId}?autoplay=1&mute=1&controls=0&start=${at}&loop=1&playlist=${v.videoId}&rel=0&modestbranding=1&playsinline=1&disablekb=1&cc_load_policy=0&iv_load_policy=3`
    : `https://player.vimeo.com/video/${v.videoId}?background=1&autoplay=1&loop=1&muted=1&dnt=1#t=${at}s`;
};

/** YouTube shows captions whenever the visitor's own account or browser has them on, whatever the URL says.
    These player commands switch them off; send them once the player listens and again when it starts playing
    (the captions module loads late). */
// The captions module can load a few seconds after the first command, and a command sent before it loads does nothing: say it again.
const AGAIN = [0, 400, 1200, 2500, 5000];
// A new message set for a frame drops the repeats still pending from the last one, so a quick
// off then on (the film player's CC button) is not undone by the off's late repeats.
const pending = new WeakMap<Window, ReturnType<typeof setTimeout>[]>();
const say = (w: Window | null | undefined, msgs: object[]) => {
  if (!w) return;
  pending.get(w)?.forEach(clearTimeout);
  pending.set(
    w,
    AGAIN.map((ms) =>
      setTimeout(() => {
        try {
          for (const m of msgs) w.postMessage(JSON.stringify(m), "*");
        } catch {}
      }, ms),
    ),
  );
};
export const captionsOff = (w: Window | null | undefined) =>
  say(w, [
    { event: "command", func: "unloadModule", args: ["captions"] },
    { event: "command", func: "unloadModule", args: ["cc"] },
    { event: "command", func: "setOption", args: ["captions", "track", {}] },
  ]);

/** The film player's captions button: YouTube loads its captions module and picks the English track
    (auto-generated counts; after captionsOff, loading the module alone shows nothing: real Safari,
    2026-11-25), Vimeo turns on its English track. A film with no captions shows none either way. */
export const captionsOn = (w: Window | null | undefined, provider: Provider) =>
  say(
    w,
    provider === "youtube"
      ? [
          { event: "command", func: "loadModule", args: ["captions"] },
          { event: "command", func: "setOption", args: ["captions", "track", { languageCode: "en" }] },
        ]
      : [{ method: "enableTextTrack", value: { language: "en", kind: "captions" } }],
  );
export const vimeoCaptionsOff = (w: Window | null | undefined) => say(w, [{ method: "disableTextTrack" }]);

/** Vimeo: ask the player to report playback. It only answers once it is really playing, so a block page or an
    error inside the frame (Vimeo's "couldn't verify the security of your connection") never counts as a film.
    Captions go off here too: Vimeo shows them when the visitor's own Vimeo setting has them on. */
export const vimeoListen = (w: Window | null | undefined) => {
  w?.postMessage(JSON.stringify({ method: "addEventListener", value: "playProgress" }), "*");
  say(w, [{ method: "disableTextTrack" }]);
};
/** true for the Vimeo message that says frames are moving */
export const vimeoPlays = (m: { event?: string; data?: { seconds?: number } } | null | undefined) =>
  m?.event === "playProgress" && (m.data?.seconds ?? 0) > 0;

/** Where the video lives, for the visitor who would rather watch it there. */
export const watchUrl = (v: Video): string =>
  v.provider === "youtube" ? `https://www.youtube.com/watch?v=${v.videoId}` : `https://vimeo.com/${v.videoId}`;

/** Everything in one section, in the order the content file holds them. */
export const inSection = (videos: Video[], section: VideoSection): Video[] => videos.filter((v) => v.section === section);

/** How many films the motion page shows: the sections plus the reel. Every
    count on the site reads this, so adding a reel or a section is one edit. */
export const filmCount = (videos: readonly unknown[]): number => videos.length + 1;

/** The client as a credit, unless the title already names them ("Pear
    VC Campaign" under "Pear VC" said it twice). */
export const creditOf = (v: Pick<Video, "title" | "client">) =>
  v.client && !v.title.toLowerCase().startsWith(v.client.toLowerCase()) ? v.client : undefined;
