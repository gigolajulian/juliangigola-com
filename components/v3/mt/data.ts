/* v4 homepage (`?mtscroll=1`, SPEC-home-scroll.md): the copy and picks this
   screen owns. Client-safe: no lib/work import. Frames that need project data
   (names, ratios) are resolved on the server in `app/page.tsx` (`mtData`). */
import { rate, SESSIONS, type SessionSlug } from "@/lib/v3";
import { DEPOSIT } from "@/lib/booking/paid";

/** A photo with its caption: `r` is height / width. */
export type MtFrame = { src: string; name: string; meta: string; slug: string; r: number };
export type MtFilm = { id: string; title: string; kind: string; client: string; poster: string | null; href: string; preview?: string; file?: string };
/** A count as two digits: 01, 02. */
export const pad = (n: number) => String(n).padStart(2, "0");

export type MtData = { hero: MtFrame[]; extras: MtFrame[]; comm: MtFrame[]; films: MtFilm[]; does: string[]; reply: string | null; stills: Record<string, string> };

/* Julian's arranger save (save.json), in order. Key `<slug>/<NN>`. */
export const HERO_KEYS = ["threshold/05", "i-wanna-be-a-human/01", "wired-magazine/01", "wrapped-up/02", "sago/01", "valgur/02", "vigil/05", "ukiyosunknown/01", "nyx/06", "oakley-x-nike/01", "astral-allure/04", "liminal/01"];
export const COMM_KEYS = ["cyber1a/01", "goodcult/01", "gilt/01", "jubo/03", "paranoia/13", "the-den-talkshow/06", "iris/03", "ukiyosunknown/03", "celestis/03"];
/* Julian's eight, in his order from Home Picks (2026-11-19). The rest are on /portfolio?d=coverart. */
export const COVER_KEYS = ["the-river", "in-the-hoodie-on-your-sleeve", "the-description", "your-way", "problem-child", "est-modvs-in-rebvs", "whole-summer", "jahannam"];
/* v1: one pressing color per release, taken from its cover by eye from the sampled palette (2026-11-14). */
export const COVER_PRESS: Partial<Record<string, string>> = {
  "the-description": "#c9c5bd",
  "the-river": "#5a6b33",
  "problem-child": "#24475a",
  "your-way": "#d2622a",
  "est-modvs-in-rebvs": "#8fb4c6",
  "jahannam": "#c8964e",
  "whole-summer": "#b02a2e",
  "in-the-hoodie-on-your-sleeve": "#d4483c",
};
/* Four films on the home (Julian, 2026-11-14): Purgation, Pear VC, Wonderland and Dide O Del stay on /portfolio/video.
   Matched to content/site.json by title; kind is this screen's label. */
/* Films the site hosts itself (public/films, 1080p, no sound, under the host's 25 MB a file): Vimeo refused its player (401) and could not
   be preloaded (Julian sent the files, 2026-11-17). The home plays these; the link still opens the film's page. */
export const FILM_FILES: Record<string, string> = { "Director's Reel": "/films/directors-reel.mp4", "Ladera Granola": "/films/ladera-granola.mp4" };
export const FILM_PICKS: [title: string, kind: string][] = [
  ["Director's Reel", "Reel"],
  ["Clean", "Music video"],
  ["Ladera Granola", "Commercial"],
  ["The Description", "Music video"],
];

/* Per-film dressing on the home (Julian, 2026-11-14). `zoom`: the frame is pushed in from its top left corner, poster and
   preview alike, so the mark burnt into the bottom right corner of the video is cut. `mark`: the client logo, top right.
   `at`: the second the home's preview starts at, when it is not the film's own previewAt (picked in the Film start picker artifact). */
export type FilmDress = { zoom?: number; at?: number; mark?: { src: string; w: number; h: number; name: string } };
export const FILM_DRESS: Partial<Record<string, FilmDress>> = {
  "Director's Reel": { at: 4 },
  Clean: { at: 48 },
  "Ladera Granola": { zoom: 1.25, at: 17, mark: { src: "/clients/ladera-granola.webp", w: 432, h: 73, name: "Ladera" } },
  "The Description": { zoom: 1.1, at: 34, mark: { src: "/clients/empire.webp", w: 159, h: 160, name: "Empire" } },
};

/* ── Book online: the four sessions the home sells, each with its deposit (`lib/booking/paid.ts`). Model test books on /book. ── */
export type BookRow = {
  key: "portraits" | "headshots" | "graduation" | "studio-digitals";
  /** The live session it books. */
  slug: SessionSlug;
  name: string;
  len: string;
  /** What /book shows for it: "From $400", or "$250 deposit" where the price is quoted after (`rate`, lib/v3). */
  price: string;
  /** The deposit that books it. */
  dep: string;
  btn: string;
  /** object-position in the 3:4 frame. */
  at: string;
};
export const BOOK_ROWS: BookRow[] = [
  { key: "portraits", slug: "portraits", name: "Portraits", len: "60 min", price: rate(SESSIONS["portraits"]), dep: `$${DEPOSIT.portraits}`, btn: "Book portraits", at: "50% 50%" },
  { key: "headshots", slug: "headshots", name: "Headshots", len: "30 min", price: rate(SESSIONS["headshots"]), dep: `$${DEPOSIT.headshots}`, btn: "Book headshots", at: "50% 40%" },
  { key: "graduation", slug: "graduation", name: "Graduation", len: "90 min", price: rate(SESSIONS["graduation"]), dep: `$${DEPOSIT.graduation}`, btn: "Book graduation", at: "50% 18%" },
  { key: "studio-digitals", slug: "studio-digitals", name: "Studio digitals", len: "45 min", price: rate(SESSIONS["studio-digitals"]), dep: `$${DEPOSIT.digitals}`, btn: "Book digitals", at: "50% 50%" },
];

/* ── By quote (spec 3.5, SZQ) ── */
export type QuoteOpt = { key: "music" | "fashion" | "commercial" | "weddings"; name: string; holds: string[]; detail: string; chips: string[]; call: string; photo: string; wide?: [src: string, at?: string][] };
export const QUOTE_OPTS: QuoteOpt[] = [
  { key: "commercial", name: "Commercial", holds: ["Brand campaigns", "Lookbooks", "Product"], detail: "Concept, art direction, shoot, retouch. Usage is in the quote.", chips: ["Brand campaign", "Lookbook", "Product"], call: "/book/brand-photography", photo: "/work/oakley-x-nike/01.jpg", wide: [["/work/wired-magazine/14.jpg", "50% 35%"], ["/work/diesel/04.jpg", "50% 21%"], ["/work/stratus-lookbook-vol-1/12.jpg", "50% 42%"]] },
  { key: "music", name: "Music", holds: ["Cover art", "Artist presskits", "Music videos"], detail: "Artwork, press and video for a release. Concept to final files.", chips: ["Cover art", "Artist presskit", "Music video"], call: "/book/music-photography", photo: "/work/valgur/02.jpg", wide: [["/work/valgur/06.jpg", "50% 23%"]] },
  { key: "fashion", name: "Fashion", holds: ["Editorial"], detail: "Stories for print and online.", chips: [], call: "/book/editorial", photo: "/work/threshold/05.jpg", wide: [["/work/fauxtopia/06.jpg", "50% 61%"], ["/work/novocaine/14.jpg", "50% 79%"]] },
  { key: "weddings", name: "Weddings", holds: ["Full day", "Couples, engagements"], detail: "", chips: ["Wedding", "Couples", "Engagement"], call: "/book/weddings", photo: "/work/weddings/02.jpg", wide: [["/work/weddings/01.jpg", "50% 67%"], ["/work/diesel/03.jpg", "50% 55%"]] },
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
  { name: "Ukiyosunknown", photos: [{ src: "/work/ukiyosunknown/02.jpg", alt: "Ukiyo" }] },
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
