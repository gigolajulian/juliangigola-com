/* Is this Apple song the release on the cover? Used by `scripts/cover-art-sound.mjs`.
   A wrong song is worse than silence, so both names have to be equal, not close:
   - title: equal once a "(feat. X)" is dropped. No prefix match, and a remix only matches a remix.
   - artist: Apple's whole artist name equals the release's, or its first-named artist.
   "confirm" is the same title where the artist is one of several Apple names ("Ericalisa & Mayzin"):
   probably right, listed for Julian instead of taken, because "BANX" is also half of "Banx & Ranx". */

const feat = /\s*[([]?\s*\b(feat|ft|featuring)\b\.?\s[^)\]]*[)\]]?/gi;
export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const title = (s: string) => norm(s.replace(feat, ""));
/** The first-named artist: "The Szns ft. Swavie" is The Szns, "Imanemun × Pooyan Ardalan" is Imanemun. */
export const leadArtist = (artist: string) => artist.split(/\s+(?:ft\.?|feat\.?|×|x)\s+/i)[0];

export type Song = { trackName: string; artistName: string };

export function matchSong(release: { title: string; artist: string }, song: Song): "match" | "confirm" | null {
  if (title(release.title) !== title(song.trackName)) return null;
  const want = [norm(release.artist), norm(leadArtist(release.artist))];
  if (want.includes(norm(song.artistName))) return "match";
  return song.artistName.split(/\s*(?:,|&)\s*/).some((a) => want.includes(norm(a))) ? "confirm" : null;
}
