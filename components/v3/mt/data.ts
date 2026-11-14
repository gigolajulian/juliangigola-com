/* v4 homepage (`?mtscroll=1`, SPEC-home-scroll.md): the copy and picks this
   screen owns. Client-safe: no lib/work import. Frames that need project data
   (names, ratios) are resolved on the server in `app/page.tsx` (`mtData`). */
import type { SessionSlug } from "@/lib/v3";

/** A photo with its caption: `r` is height / width. */
export type MtFrame = { src: string; name: string; meta: string; slug: string; r: number };
export type MtFilm = { id: string; title: string; kind: string; client: string; poster: string | null; href: string; preview?: string };
export type MtData = { hero: MtFrame[]; extras: MtFrame[]; comm: MtFrame[]; films: MtFilm[]; does: string[]; reply: string | null; stills: Record<string, string> };

/* Julian's arranger save (save.json), in order. Key `<slug>/<NN>`. */
export const HERO_KEYS = ["threshold/05", "i-wanna-be-a-human/01", "wired-magazine/01", "astral-allure/04", "wrapped-up/02", "sago/01", "valgur/02", "vigil/05", "ukiyosunknown/01", "nyx/06", "oakley-x-nike/01", "liminal/01"];
export const COMM_KEYS = ["cyber1a/01", "goodcult/01", "gilt/01", "jubo/03", "paranoia/13", "the-den-talkshow/06", "iris/03", "ukiyosunknown/03", "celestis/03"];
export const COVER_KEYS = ["the-description", "the-river", "problem-child", "your-way", "est-modvs-in-rebvs", "jahannam", "whole-summer"];
/* save.json `films` (on), matched to content/site.json by title; kind is this screen's label. */
export const FILM_PICKS: [title: string, kind: string][] = [
  ["Director's Reel", "Reel"],
  ["Clean", "Music video"],
  ["Ladera Granola", "Commercial"],
  ["The Description", "Music video"],
  ["Purgation", "Fashion film"],
  ["Pear VC Campaign", "Commercial"],
  ["Wonderland", "Music video"],
  ["Dide O Del", "Music video"],
];

/* ── Book online: the four sessions the home sells, each with the $100 deposit. Model test books on /book. ── */
export type BookRow = {
  key: "portraits" | "headshots" | "graduation" | "studio-digitals";
  /** The live session it books; Test shoot has none yet (no SESSIONS / EVENTS entry). */
  slug: SessionSlug | null;
  group: "s" | "a";
  name: string;
  len: string;
  what: string;
  price: string;
  detail: string;
  btn: string;
  ready: string | null;
  photo: string;
  /** object-position in the 3:4 frame. */
  at: string;
};
export const BOOK_ROWS: BookRow[] = [
  { key: "portraits", slug: "portraits", group: "s", name: "Portraits", len: "60 min", what: "Two looks", price: "$100 deposit", detail: "Studio or location. Retouched selects for web and print.", btn: "Book portraits", ready: "1 week", photo: "", at: "50% 50%" },
  { key: "headshots", slug: "headshots", group: "s", name: "Headshots", len: "30 min", what: "LinkedIn, corporate", price: "$100 deposit", detail: "For LinkedIn, company sites and press. Retouched selects. Booking a team? Ask for a day rate.", btn: "Book headshots", ready: "3 business days", photo: "", at: "50% 40%" },
  { key: "graduation", slug: "graduation", group: "s", name: "Graduation", len: "90 min", what: "On campus", price: "$100 deposit", detail: "Two outfits. Edited gallery, print release. Booking spring {year} now.", btn: "Book graduation", ready: "1 week", photo: "", at: "50% 18%" },
  { key: "studio-digitals", slug: "studio-digitals", group: "a", name: "Studio digitals", len: "45 min", what: "Unretouched", price: "$100 deposit", detail: "Full length, three-quarter, close. Front and profile.", btn: "Book digitals", ready: "2 business days", photo: "", at: "50% 50%" },
];
export { gradYear } from "@/lib/grad-year";

/* ── By quote (spec 3.5, SZQ) ── */
export type QuoteOpt = { key: "music" | "fashion" | "commercial" | "weddings"; name: string; holds: string[]; detail: string; chips: string[]; call: string; photo: string };
export const QUOTE_OPTS: QuoteOpt[] = [
  { key: "music", name: "Music", holds: ["Cover art", "Artist presskits", "Music videos"], detail: "Artwork, press and video for a release. Concept to final files.", chips: ["Cover art", "Artist presskit", "Music video"], call: "/book/music-photography", photo: "/work/valgur/02.jpg" },
  { key: "fashion", name: "Fashion", holds: ["Editorial"], detail: "Stories for print and online.", chips: [], call: "/book/editorial", photo: "/work/threshold/05.jpg" },
  { key: "commercial", name: "Commercial", holds: ["Brand campaigns", "Lookbooks", "Product"], detail: "Concept, art direction, shoot, retouch. Usage is in the quote.", chips: ["Brand campaign", "Lookbook", "Product"], call: "/book/brand-photography", photo: "/work/oakley-x-nike/01.jpg" },
  { key: "weddings", name: "Weddings", holds: ["Full day", "Couples, engagements"], detail: "", chips: ["Wedding", "Couples", "Engagement"], call: "/book/weddings", photo: "/work/weddings/02.jpg" },
];
/** The enquiry type each chip posts (lib/inbox.ts SHOOT_TYPES). */
export const CHIP_TYPE: Record<string, string> = {
  "Cover art": "coverart",
  "Artist presskit": "presskit",
  "Music video": "video",
  Editorial: "editorial",
  "Brand campaign": "campaign",
  Lookbook: "campaign",
  Product: "campaign",
  Wedding: "session",
  Couples: "session",
  Engagement: "session",
};
/* SZV: the client proof, in order. `wide` is the 2:1 frame for the phone. */
export type QuoteClient = { name: string; photos: { src: string; alt: string }[]; wide?: string };
export const QUOTE_CLIENTS: QuoteClient[] = [
  { name: "WIRED", photos: [{ src: "/work/wired-magazine/cover.jpg", alt: "WIRED" }], wide: "/v3/wired-18-wide.jpg" },
  { name: "Sago", photos: [{ src: "/work/sago/02.jpg", alt: "Sago" }] },
  { name: "Jubo", photos: [{ src: "/work/jubo/cover.jpg", alt: "Jubo" }] },
  { name: "Ukiyo", photos: [{ src: "/work/ukiyosunknown/02.jpg", alt: "Ukiyo" }] },
  { name: "Goodcult", photos: [{ src: "/work/goodcult/cover.jpg", alt: "Goodcult" }] },
  { name: "Paradox", photos: [{ src: "/work/paradox/cover.jpg", alt: "Paradox" }] },
  { name: "Pear VC | Ladera Granola", photos: [{ src: "film:pear-vc", alt: "Pear VC" }, { src: "film:ladera", alt: "Ladera Granola" }] },
];

/* ── About (spec 3.9) ── */
export const ABOUT_SENTENCE = "I help emerging labels, musicians and technology brands find the image that feels most like them.";
export const ABOUT_FACTS: [string, string][] = [
  ["Shooting", "12 years"],
  ["Based in", "SF Bay Area"],
  ["Roles", "Photo / AD / Director"],
];
