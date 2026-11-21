/**
 * The song preview for each cover: `node scripts/cover-art-sound.mjs` writes `lib/work/cover-art-sound.json`.
 *
 * Apple first: the public iTunes Search API (no key), matched on title AND artist
 * (`lib/work/cover-art-match.ts`). A release already in the file keeps its Apple track id and only has
 * its preview URL refreshed, so a hand-pinned id is never searched again. To pin one, add
 * `"<slug>": { "id": <Apple track id> }` to the file and run this.
 * Only on SoundCloud: add `"<slug>": { "soundcloud": "<track url>" }` by hand. It plays through SoundCloud's player,
 * and only when the release has no Apple preview and no clip of Julian's.
 * Julian's own clip: drop `public/covers/sound/<slug>.m4a` (or .mp3) and run this. It is used when
 * Apple has no match.
 *
 * Prints every release as matched, confirm (same title, artist is one of several: pin it if right),
 * clip, or unmatched. Nothing is guessed.
 * Apple allows about 20 calls a minute, so this takes a few minutes.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { COVER_RELEASES } from "../lib/work/cover-art-data.ts";
import { lead, matchSong, norm } from "../lib/work/cover-art-match.ts";

const OUT = new URL("../lib/work/cover-art-sound.json", import.meta.url);
const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

let last = 0;
async function apple(path, params) {
  const wait = last + 3200 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const res = await fetch(`https://itunes.apple.com/${path}?${new URLSearchParams({ country: "US", ...params })}`);
  if (!res.ok) throw new Error(`Apple ${path} ${res.status}`);
  return (await res.json()).results;
}
const songs = (rows) => rows.filter((x) => x.wrapperType === "track" && x.kind === "song" && x.previewUrl);
const entry = (x) => ({ id: x.trackId, preview: x.previewUrl, link: x.trackViewUrl.replace(/[?&]uo=\d+/, "") });

async function find(release) {
  const first = lead(release.artist);
  const pools = [
    () => apple("search", { term: `${release.title} ${first}`, entity: "song", limit: "25" }),
    () => apple("search", { term: release.title, entity: "song", limit: "200" }),
    // Every song by each artist with exactly this name: the term search misses small catalogues.
    async () => {
      const artists = (await apple("search", { term: first, entity: "musicArtist", limit: "25" })).filter((a) => norm(a.artistName) === norm(first));
      const all = [];
      for (const a of artists.slice(0, 4)) all.push(...(await apple("lookup", { id: String(a.artistId), entity: "song", limit: "200" })));
      return all;
    },
  ];
  const confirm = [];
  for (const pool of pools) {
    const rows = songs(await pool());
    // Lowest track id first: of two identical releases, the earlier one, the same one every run.
    const hit = rows.filter((x) => matchSong(release, x) === "match").sort((a, b) => a.trackId - b.trackId)[0];
    if (hit) return { hit };
    confirm.push(...rows.filter((x) => matchSong(release, x) === "confirm"));
  }
  return { confirm: [...new Map(confirm.map((x) => [x.trackId, x])).values()] };
}

const out = {};
const report = [];
for (const release of COVER_RELEASES) {
  const { slug } = release;
  const file = ["m4a", "mp3"].map((ext) => `/covers/sound/${slug}.${ext}`).find((p) => existsSync(new URL(`../public${p}`, import.meta.url)));
  let got = null, note = "";
  try {
    if (old[slug]?.id) {
      const [x] = songs(await apple("lookup", { id: String(old[slug].id) }));
      // No preview any more: the id stays, so a pin is never lost, and the page is silent for it.
      got = x ? entry(x) : { id: old[slug].id };
      if (!x) note = `track ${old[slug].id} has no preview now`;
    } else {
      const { hit, confirm } = await find(release);
      if (hit) got = entry(hit);
      else if (confirm.length) note = "confirm: " + confirm.map((x) => `${x.trackId} "${x.trackName}" by ${x.artistName}`).join("; ");
    }
  } catch (e) {
    // Apple down or rate-limited: keep what the file had, never drop a match over a failed call.
    got = old[slug]?.preview ? { id: old[slug].id, preview: old[slug].preview, link: old[slug].link } : null;
    note = String(e.message);
  }
  // A SoundCloud link is put in by hand and kept: `"<slug>": { "soundcloud": "<track url>" }`.
  const sc = old[slug]?.soundcloud;
  if (got || file || sc) out[slug] = { ...got, ...(file ? { clip: file } : {}), ...(sc ? { soundcloud: sc } : {}) };
  report.push(`${got?.preview ? "matched  " : file ? "clip     " : sc ? "soundcloud" : note.startsWith("confirm") ? "confirm  " : "unmatched"} | ${release.title} | ${release.artist}${got?.id ? ` | ${got.id}` : ""}${note ? ` | ${note}` : ""}`);
}
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(report.join("\n"));
