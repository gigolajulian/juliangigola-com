/**
 * Reading a pasted video link.
 *
 * The reason this file exists: a YouTube link has six shapes in the wild and
 * a Vimeo one four, the id that comes out goes inside an iframe `src`, and
 * the thing doing the pasting is a person in a hurry. A parser that quietly
 * returns the wrong eleven characters publishes a tile that plays somebody
 * else's video.
 *
 * Runs the real `lib/videos.ts`, which has no React and no imports for
 * exactly this reason.
 *
 *   node --experimental-strip-types scripts/check-videos.mjs
 */

import assert from "node:assert/strict";
import {
  SECTIONS,
  embedUrl,
  inSection,
  isValidId,
  parseVideoUrl,
  posterFor,
  sectionName,
  watchUrl,
  youtubeStills,
} from "../lib/videos.ts";

let n = 0;
const eq = (a, b, what) => {
  assert.deepEqual(a, b, what);
  n++;
};
const ok = (cond, what) => {
  assert.ok(cond, what);
  n++;
};

const YT = "dQw4w9WgXcQ";
const VM = "76979871";

/* ── YouTube, every shape ─────────────────────────────────────── */
{
  const yt = { provider: "youtube", videoId: YT };

  eq(parseVideoUrl(`https://www.youtube.com/watch?v=${YT}`), yt, "watch");
  eq(parseVideoUrl(`https://youtube.com/watch?v=${YT}`), yt, "without www");
  eq(parseVideoUrl(`http://www.youtube.com/watch?v=${YT}`), yt, "http");
  eq(parseVideoUrl(`youtube.com/watch?v=${YT}`), yt, "no scheme at all");
  eq(parseVideoUrl(`https://youtu.be/${YT}`), yt, "short link");
  eq(parseVideoUrl(`https://youtu.be/${YT}?t=42`), yt, "short link with a time");
  eq(parseVideoUrl(`https://www.youtube.com/embed/${YT}`), yt, "embed");
  eq(parseVideoUrl(`https://www.youtube.com/shorts/${YT}`), yt, "a short");
  eq(parseVideoUrl(`https://www.youtube.com/live/${YT}`), yt, "a stream");
  eq(parseVideoUrl(`https://www.youtube.com/v/${YT}`), yt, "the old flash path");
  eq(parseVideoUrl(YT), yt, "a bare id, which people do paste");
  eq(
    parseVideoUrl(`  https://www.youtube.com/watch?v=${YT}  `),
    yt,
    "surrounded by the whitespace a paste brings",
  );

  // The share link carries a playlist and a referrer; neither is the video.
  eq(
    parseVideoUrl(
      `https://www.youtube.com/watch?v=${YT}&list=PLabc&index=2&si=xyz`,
    ),
    yt,
    "extra query parameters are ignored",
  );
}

/* ── Vimeo, every shape ───────────────────────────────────────── */
{
  const vm = { provider: "vimeo", videoId: VM };

  eq(parseVideoUrl(`https://vimeo.com/${VM}`), vm, "plain");
  eq(parseVideoUrl(`https://player.vimeo.com/video/${VM}`), vm, "the player");
  eq(
    parseVideoUrl(`https://vimeo.com/channels/staffpicks/${VM}`),
    vm,
    "in a channel",
  );
  eq(parseVideoUrl(`https://vimeo.com/album/123/video/${VM}`), vm, "in an album");

  // An unlisted link is the id then a privacy hash. The hash is not the id,
  // and getting that the wrong way round embeds nothing.
  eq(
    parseVideoUrl(`https://vimeo.com/${VM}/3b5d1f9a2c`),
    vm,
    "unlisted: the id comes first, the hash second",
  );
  eq(parseVideoUrl(`vimeo.com/${VM}`), vm, "no scheme");
}

/* ── what must not parse ──────────────────────────────────────── */
{
  const nothing = [
    ["", "an empty string"],
    ["   ", "whitespace"],
    ["not a url at all", "prose"],
    ["https://example.com/watch?v=dQw4w9WgXcQ", "the right shape, wrong host"],
    ["https://vimeo.com/", "no id"],
    ["https://vimeo.com/channels/staffpicks", "a channel, not a video"],
    ["https://www.youtube.com/watch?v=short", "an id that is too short"],
    ["https://www.youtube.com/watch?v=waaaaaaytoolongforyoutube", "too long"],
    ["https://www.youtube.com/@juliangigola", "a channel page"],
    ["https://vimeo.com/12345", "fewer digits than Vimeo issues"],
    ["javascript:alert(1)", "a scheme that executes"],
    ["https://www.youtube.com/watch?v=../../etc/passwd", "path traversal"],
    ['https://youtu.be/abc"onload="x', "an attempt to break out of an attribute"],
  ];

  for (const [input, what] of nothing) {
    eq(parseVideoUrl(input), null, `refused: ${what}`);
  }
}

/* ── ids, held to what the providers issue ────────────────────── */
{
  ok(isValidId("youtube", YT), "a real YouTube id");
  ok(!isValidId("youtube", "dQw4w9WgXc"), "ten characters is not one");
  ok(!isValidId("youtube", "dQw4w9WgXcQ!"), "nor is one with punctuation");
  ok(!isValidId("youtube", "../../secrets"), "nor a path");
  ok(isValidId("vimeo", VM), "a real Vimeo id");
  ok(!isValidId("vimeo", "abc"), "letters are not a Vimeo id");
  ok(!isValidId("vimeo", "123"), "and neither are three digits");
}

/* ── stills ───────────────────────────────────────────────────── */
{
  const stills = youtubeStills(YT);
  eq(stills.length, 5, "five stills to choose from");
  ok(
    stills.every((s) => s.startsWith(`https://i.ytimg.com/vi/${YT}/`)),
    "all on the host the CSP allows",
  );
  ok(stills[0].includes("maxresdefault"), "the uploaded thumbnail first");
  ok(
    stills.slice(2).every((s) => /\/[123]\.jpg$/.test(s)),
    "then the three frames the encoder grabbed",
  );

  // A YouTube video needs no poster stored; a Vimeo one does, and says so by
  // returning null rather than a URL that would 404.
  const yt = { id: "a", title: "t", provider: "youtube", videoId: YT, section: "music" };
  const vm = { id: "b", title: "t", provider: "vimeo", videoId: VM, section: "music" };
  ok(posterFor(yt).includes("hqdefault"), "YouTube falls back to one that always exists");
  eq(posterFor(vm), null, "Vimeo has no guessable still");
  eq(
    posterFor({ ...yt, poster: "https://i.ytimg.com/vi/x/2.jpg" }),
    "https://i.ytimg.com/vi/x/2.jpg",
    "a chosen still wins",
  );
}

/* ── the embed, and where it points ──────────────────────────── */
{
  const yt = { id: "a", title: "t", provider: "youtube", videoId: YT, section: "music" };
  const vm = { id: "b", title: "t", provider: "vimeo", videoId: VM, section: "commercial" };

  // The no-cookie domain, because this site has no cookie banner to justify
  // the ordinary one's advertising cookie — and it is the host the CSP names.
  ok(
    embedUrl(yt).startsWith(`https://www.youtube-nocookie.com/embed/${YT}?`),
    "YouTube plays from the no-cookie domain",
  );
  ok(embedUrl(vm).includes("dnt=1"), "Vimeo is asked not to track");
  ok(
    embedUrl(yt).includes("autoplay=1") && embedUrl(vm).includes("autoplay=1"),
    "the click was the press of play, so it plays",
  );
  ok(embedUrl(yt).includes("playsinline=1"), "and does not take over an iPhone");

  eq(watchUrl(yt), `https://www.youtube.com/watch?v=${YT}`, "watch there instead");
  eq(watchUrl(vm), `https://vimeo.com/${VM}`, "or there");
}

/* ── the two sections ─────────────────────────────────────────── */
{
  eq(SECTIONS.map((s) => s.id), ["music", "commercial"], "two, in this order");
  eq(sectionName("music"), "Music video", "as Julian named them");
  eq(sectionName("commercial"), "Commercial", "and the other one");

  const list = [
    { id: "1", title: "a", provider: "youtube", videoId: YT, section: "music" },
    { id: "2", title: "b", provider: "vimeo", videoId: VM, section: "commercial" },
    { id: "3", title: "c", provider: "youtube", videoId: YT, section: "music" },
  ];
  eq(inSection(list, "music").map((v) => v.id), ["1", "3"], "split by section");
  eq(
    inSection(list, "commercial").map((v) => v.id),
    ["2"],
    "and the file's order is kept inside each",
  );
  eq(inSection([], "music"), [], "an empty page is not an error");
}

console.log(`videos: ${n} cases pass`);
