/* v4 homepage (docs/mt-decisions.md): the copy and picks this
   screen owns. Client-safe: no lib/work import. Frames that need project data
   (names, ratios) are resolved on the server in `lib/home/server.ts` (`HOME_DATA`). */
import { priceLabel, SESSIONS, type SessionSlug } from "@/lib/booking/catalog";
import { DEPOSIT } from "@/lib/leads/deposit-terms";
import type { SHOOT_TYPES } from "@/lib/leads/enquiry";

/** A photo with its caption: `ratio` is height / width. */
export type HomeFrame = { src: string; name: string; meta: string; slug: string; ratio: number };
export type HomeFilm = {
  id: string;
  title: string;
  kind: string;
  client: string;
  poster: string | null;
  href: string;
  preview?: string;
  file?: string;
};

/** Where each run of HomeData.extras goes: 0-15 the side columns (4 a column), 16-21 rows five and six of the locked columns,
    22-29 those rows of the side columns, 30 on the intro pool. */
export const EXTRAS = { perCol: 4, sides: 16, xrSides: 22, wall: 30 } as const;

export type HomeData = {
  hero: HomeFrame[];
  extras: HomeFrame[];
  commissions: HomeFrame[];
  films: HomeFilm[];
  disciplines: string[];
  reply: string | null;
  stills: Record<string, string>;
};

/* Julian's arranger save (save.json), in order. Key `<slug>/<NN>`. */
export const HERO_KEYS = [
  "threshold/05",
  "i-wanna-be-a-human/01",
  "wired-magazine/01",
  "wrapped-up/02",
  "sago/01",
  "valgur/02",
  "vigil/05",
  "ukiyosunknown/01",
  "nyx/06",
  "oakley-x-nike/01",
  "astral-allure/04",
  "liminal/01",
];
export const COMM_KEYS = [
  "cyber1a/01",
  "goodcult/01",
  "gilt/01",
  "jubo/03",
  "paranoia/13",
  "the-den-talkshow/06",
  "iris/03",
  "ukiyosunknown/03",
  "celestis/03",
];
/** The four the home's Commissions row shows, left to right. */
export const COMM_HOME = ["cyber1a/01", "ukiyosunknown/03", "goodcult/01", "jubo/03"];
/* Julian's eight, in his order from Home Picks. The rest are on /portfolio?d=coverart. */
export const COVER_KEYS = [
  "the-river",
  "in-the-hoodie-on-your-sleeve",
  "the-description",
  "your-way",
  "problem-child",
  "est-modvs-in-rebvs",
  "whole-summer",
  "jahannam",
] as const;
export type CoverKey = (typeof COVER_KEYS)[number];
/* One pressing color per release, taken from its cover by eye from the sampled palette. */
export const COVER_PRESS: Partial<Record<string, string>> = {
  "the-description": "#c9c5bd",
  "the-river": "#5a6b33",
  "problem-child": "#24475a",
  "your-way": "#d2622a",
  "est-modvs-in-rebvs": "#8fb4c6",
  jahannam: "#c8964e",
  "whole-summer": "#b02a2e",
  "in-the-hoodie-on-your-sleeve": "#d4483c",
} satisfies Record<CoverKey, string>;
/* Four films on the home: Purgation, Pear VC, Wonderland and Dide O Del stay on /portfolio/video.
   Matched to content/site.json by title; kind is this screen's label. */
/* Films the site hosts itself (public/films, 1080p, no sound, under the host's 25 MB a file), so they preload.
   The home plays these; the link still opens the film's page. */
export const FILM_FILES: Record<string, string> = {
  "Director's Reel": "/films/directors-reel.mp4",
  "Ladera Granola": "/films/ladera-granola.mp4",
} satisfies Partial<Record<FilmTitle, string>>;
export const FILM_PICKS = [
  ["Director's Reel", "Reel"],
  ["Clean", "Music video"],
  ["Ladera Granola", "Commercial"],
  ["The Description", "Music video"],
] as const satisfies readonly (readonly [title: string, kind: string])[];
export type FilmTitle = (typeof FILM_PICKS)[number][0];

/* Per-film dressing on the home. `zoom`: the frame is pushed in from its top left corner, poster and
   preview alike, so the mark burnt into the bottom right corner of the video is cut. `mark`: the client logo, top right.
   `startSec`: the second the home's preview starts at, when it is not the film's own previewAt (picked in the Film start picker artifact). */
export type FilmDress = { zoom?: number; startSec?: number; mark?: { src: string; w: number; h: number; name: string } };
export const FILM_DRESS: Partial<Record<string, FilmDress>> = {
  "Director's Reel": { startSec: 4 },
  Clean: { startSec: 48 },
  "Ladera Granola": { zoom: 1.25, startSec: 17, mark: { src: "/clients/ladera-granola.webp", w: 432, h: 73, name: "Ladera" } },
  "The Description": { zoom: 1.1, startSec: 34, mark: { src: "/clients/empire.webp", w: 159, h: 160, name: "Empire" } },
} satisfies Partial<Record<FilmTitle, FilmDress>>;

/* ── Book online: the four sessions the home sells, each with its deposit (`lib/leads/deposit-terms.ts`). Model test books on /book. ── */
export type BookRow = {
  /** The live session it books. */
  slug: Extract<SessionSlug, "portraits" | "headshots" | "graduation" | "studio-digitals">;
  name: string;
  len: string;
  /** What /book shows for it: "From $400", or "$250 deposit" where the price is quoted after (`priceLabel`, lib/booking/catalog). */
  price: string;
  /** The deposit that books it. */
  dep: string;
  btn: string;
  /** object-position in the 3:4 frame. */
  pos: string;
};
export const BOOK_ROWS: BookRow[] = [
  {
    slug: "portraits",
    name: "Portraits",
    len: "60 min",
    price: priceLabel(SESSIONS["portraits"]),
    dep: `$${DEPOSIT.portraits}`,
    btn: "Book portraits",
    pos: "50% 50%",
  },
  {
    slug: "headshots",
    name: "Headshots",
    len: "30 min",
    price: priceLabel(SESSIONS["headshots"]),
    dep: `$${DEPOSIT.headshots}`,
    btn: "Book headshots",
    pos: "50% 40%",
  },
  {
    slug: "graduation",
    name: "Graduation",
    len: "90 min",
    price: priceLabel(SESSIONS["graduation"]),
    dep: `$${DEPOSIT.graduation}`,
    btn: "Book graduation",
    pos: "50% 18%",
  },
  {
    slug: "studio-digitals",
    name: "Studio digitals",
    len: "45 min",
    price: priceLabel(SESSIONS["studio-digitals"]),
    dep: `$${DEPOSIT.digitals}`,
    btn: "Book digitals",
    pos: "50% 50%",
  },
];

/* ── By quote (spec 3.5, SZQ) ── */
export type QuoteOpt = {
  key: "music" | "fashion" | "commercial" | "weddings";
  name: string;
  holds: string[];
  detail: string;
  chips: string[];
  call: string;
  photo: string;
  /** The enquiry type when no chip maps one (CHIP_TYPE). */ type?: string;
  wide?: [src: string, pos?: string][];
};
export const QUOTE_OPTS: QuoteOpt[] = [
  {
    key: "commercial",
    name: "Commercial",
    holds: ["Brand campaigns", "Lookbooks", "Product"],
    detail: "Concept, art direction, shoot, retouch. Usage is in the quote.",
    chips: ["Brand campaign", "Lookbook", "Product"],
    call: "/book/brand-photography",
    photo: "/work/oakley-x-nike/01.jpg",
  },
  {
    key: "music",
    name: "Music",
    holds: ["Cover art", "Artist press kits", "Music videos"],
    detail: "Artwork, press and video for a release. Concept to final files.",
    chips: ["Cover art", "Artist press kit", "Music video"],
    call: "/book/music-photography",
    photo: "/work/valgur/02.jpg",
  },
  {
    key: "fashion",
    name: "Fashion",
    holds: ["Editorial"],
    detail: "Stories for print and online.",
    chips: [],
    call: "/book/editorial",
    type: "editorial",
    photo: "/work/threshold/05.jpg",
  },
  {
    key: "weddings",
    name: "Weddings",
    holds: ["Full day", "Couples, engagements"],
    detail: "",
    chips: ["Wedding", "Couples", "Engagement"],
    call: "/book/weddings",
    photo: "/work/weddings/02.jpg",
  },
];
/** The enquiry type each chip posts (lib/leads/enquiry.ts SHOOT_TYPES). */
export const CHIP_TYPE: Record<string, (typeof SHOOT_TYPES)[number]> = {
  "Cover art": "coverart",
  "Artist press kit": "presskit",
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
  {
    name: "Pear VC | Ladera Granola",
    photos: [
      { src: "film:pear-vc", alt: "Pear VC" },
      { src: "film:ladera", alt: "Ladera Granola" },
    ],
  },
];

/* ── About (spec 3.9) ── */
/** What I do, as listed on /about and the home's About. */
export const DISCIPLINES = [
  "Editorials",
  "Still photography",
  "Camera operation",
  "Brand imagery",
  "Post-production",
  "Creative direction",
];
export const ABOUT_SENTENCE = "I help emerging labels, musicians and technology brands find the image that feels most like them.";
export const ABOUT_FACTS: [string, string][] = [
  ["Shooting", "12 years"],
  ["Roles", "Photo / AD / Director"],
  ["Based in", "SF Bay Area"],
  ["Travel", "Worldwide"],
];
