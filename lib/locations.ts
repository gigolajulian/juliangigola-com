/**
 * The booking pages: one per service and city, at /<city>/<service>.
 *
 * Julian (2026-10-02): "build the booking pages, start with San Jose", and
 * "no vertical pages". So each is a deck of screens like the homepage
 * (`components/local-screens.tsx`), and this file is only what they say.
 *
 * Why a page per city and service: a search names both ("headshot
 * photographer san jose", "sjsu grad photos"), and the pages that rank for
 * those in the Bay Area are exactly that, a page per service per city with
 * the price, what is included, and the questions people ask. The research
 * is summarised in `lib/seo.ts`.
 *
 * Every fact here is one the site already states somewhere: the prices,
 * what is included and the turnaround come from the session in
 * `content/site.json` (so /admin changes them here too), the process from
 * About, the reply time from `lib/site.ts`. The answers that are general
 * advice (what to wear, when to book) are written as advice, not as
 * policy. A new city is a new entry in `CITIES` and its pages in `PAGES`;
 * the routes read both.
 */

import { SESSION_TYPES, formatPrice, type SessionType } from "./sessions";
import { RESPONSE_TIME } from "./site";
import { CONTENT } from "./content";
import { getProject, projectsIn } from "./work";
import type { Frame } from "./work-types";

export type City = {
  slug: string;
  name: string;
  /** What the region is called by the people searching from it. */
  region: string;
  /** The towns a client books from, for the structured data. */
  towns: string[];
};

export const CITIES: City[] = [
  {
    slug: "san-jose",
    name: "San Jose",
    region: "Silicon Valley",
    towns: [
      "San Jose",
      "Santa Clara",
      "Sunnyvale",
      "Mountain View",
      "Cupertino",
      "Campbell",
      "Los Gatos",
      "Milpitas",
      "Palo Alto",
    ],
  },
];

export type Faq = { q: string; a: string };
export type Block = { heading: string; items?: string[]; body?: string };

export type Tile = { frame: Frame; href: string; caption: string };

export type LocalPage = {
  city: string;
  slug: string;
  /** The service in a word, for the rail, the crumb and the hub's list. */
  name: string;
  /** `<title>` before the template's " | Julian Gigola", and the meta
      description. Titled for the search; see `lib/seo.ts`. */
  title: string;
  description: string;
  /** The page's own heading, and the line of places over it. */
  h1: string;
  kicker: string;
  lead: string;
  /** "From $400" or "On request" for a session, "Quoted per project" for
      a commission; with what comes back and when. */
  rate: string;
  turnaround?: string;
  /** The schema.org service name and starting price. */
  service: string;
  price: number | null;
  blocks: Block[];
  faqs: Faq[];
  /** The photographs: the first is the cover, the rest the work screen. */
  tiles: Tile[];
  gallery: { href: string; label: string };
  /** Presets for the form on the Book screen. */
  book: { type: string; session?: string; title: string };
};

/* ── shared wording ─────────────────────────────────────────────── */

const session = (slug: string): SessionType => {
  const s = SESSION_TYPES.find((t) => t.slug === slug);
  if (!s) throw new Error(`lib/locations.ts: no session "${slug}" in content/site.json.`);
  return s;
};

/** The reply-time promise, where one is made. */
const reply = RESPONSE_TIME ? `The reply comes back ${RESPONSE_TIME}.` : "";

/** How a commission runs: About's four steps, in the same words. */
const PROCESS: Block = {
  heading: "How it runs",
  items: [
    "Brief: references, usage, deliverables and dates. A deck is welcome but not required.",
    "Treatment: a lighting and location approach, a shot list, and a quote covering crew and licensing.",
    "Shoot: studio or location, in San Jose, across the Bay Area or traveling.",
    "Delivery: selects for approval, then final retouched files in the crops and color spaces you need.",
  ],
};

/** A session's rate, inclusions and turnaround as the page shows them. */
const sessionFacts = (s: SessionType) => ({
  rate: formatPrice(s.from),
  turnaround: s.turnaround,
  price: s.from,
});

/** A priced answer, or the on-request one. */
const costAnswer = (s: SessionType, priced: string) =>
  s.from === null
    ? `Quoted on request, depending on what you need. Send the details through the booking form. ${reply}`.trim()
    : priced.replace("{price}", formatPrice(s.from));

/* ── the photographs ────────────────────────────────────────────── */

const caption = (name: string) =>
  name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/** A one-gallery session's frames, each opening the gallery. */
const framesOf = (slug: string, n = 7): Tile[] => {
  const p = getProject(slug);
  if (!p) return [];
  return p.images.slice(0, n).map((frame, i) => ({
    frame,
    href: `/portfolio/${p.slug}`,
    caption: `${caption(p.name)} ${String(i + 1).padStart(2, "0")}`,
  }));
};

/** A discipline's projects, a cover each, each opening its project. */
const coversOf = (category: string, n = 7, prefer: string[] = []): Tile[] => {
  const all = projectsIn(category);
  const first = prefer
    .map((s) => all.find((p) => p.slug === s))
    .filter((p) => p !== undefined);
  return [...first, ...all.filter((p) => !first.includes(p))]
    .slice(0, n)
    .map((p) => ({
      frame: p.images[0] ?? p.cover,
      href: `/portfolio/${p.slug}`,
      caption: caption(p.name),
    }));
};

/** The music videos, by title, from the Motion page's list. */
const MUSIC_VIDEOS = CONTENT.videos
  .filter((v) => v.section === "music")
  .map((v) => (v.client ? `${v.title} (${v.client})` : v.title));

/* ── San Jose ───────────────────────────────────────────────────── */

const grad = session("graduation");
const heads = session("headshots");
const digitals = session("studio-digitals");
const portraits = session("portraits");

export const PAGES: LocalPage[] = [
  {
    city: "san-jose",
    slug: "graduation-photos",
    name: "Graduation",
    title: "Graduation Photographer San Jose: SJSU & SCU",
    description: `Graduation photos at SJSU and Santa Clara University in San Jose. ${formatPrice(grad.from)}: one hour on campus, two outfit changes, an edited gallery and print release.`,
    h1: "Graduation photos in San Jose",
    kicker: "SJSU · Santa Clara University · South Bay",
    lead: "Cap and gown at SJSU or Santa Clara University, on campus or in the studio. An hour, two outfit changes, and enough coverage for the family frame and the announcement.",
    ...sessionFacts(grad),
    service: "Graduation photography",
    blocks: [
      { heading: "What's included", items: grad.includes },
      {
        heading: "Where on campus",
        items: [
          "SJSU: Tower Hall and Tower Lawn, the Tommie Smith and John Carlos statue, and outside King Library.",
          "Santa Clara University: the Mission Church and its gardens, and Palm Drive.",
          "Somewhere else that means something to you works too. On campus at SJSU or SCU; a travel fee applies further out.",
        ],
      },
      {
        heading: "When to book",
        body: "Spring commencement dates go first. Book four to six weeks ahead and shoot a week or two before the ceremony, so the gallery is back in time for the announcements.",
      },
    ],
    faqs: [
      {
        q: "How much are graduation photos in San Jose?",
        a: costAnswer(
          grad,
          "{price} for an hour on campus at SJSU or Santa Clara University, with two outfit changes, an edited gallery and a print release. A travel fee applies further out.",
        ),
      },
      {
        q: "When should I take my grad photos?",
        a: "A week or two before the ceremony, once the cap, gown, stole and cords have arrived. Book four to six weeks ahead: spring dates go first.",
      },
      {
        q: "What should I wear under my gown?",
        a: "Something you would want to be photographed in without it, because the gown comes off for at least one look. Solid colors photograph best. Bring the stole, the cords and anything else you earned.",
      },
      {
        q: "How long until I get the photos?",
        a: `The edited gallery is ready in ${grad.turnaround}, with a print release so you can print anywhere.`,
      },
      {
        q: "Do you photograph other campuses?",
        a: "Yes, anywhere in the Bay Area. SJSU and Santa Clara University are included; a travel fee applies further out.",
      },
    ],
    tiles: framesOf("graduation"),
    gallery: { href: "/portfolio/graduation", label: "The graduation gallery" },
    book: { type: "session", session: grad.name, title: "Book graduation photos" },
  },
  {
    city: "san-jose",
    slug: "headshots",
    name: "Headshots",
    title: "Headshot Photographer San Jose & Silicon Valley",
    description: `Professional headshots in San Jose and Silicon Valley: LinkedIn, corporate, actor and press. Studio lighting, retouched selects, ready in ${heads.turnaround}.`,
    h1: "Headshots in San Jose",
    kicker: "LinkedIn · Corporate · Actors · Press",
    lead: `Clean, current, and usable everywhere: LinkedIn, press, casting, a company about page. Studio lighting, more than one background, and retouched selects back in ${heads.turnaround}.`,
    ...sessionFacts(heads),
    service: "Headshot photography",
    blocks: [
      { heading: "What's included", items: heads.includes },
      {
        heading: "For teams",
        body: "Booking for a company? Say how many people and roughly when in the booking form, and the quote covers the whole team.",
      },
      {
        heading: "Who it's for",
        items: [
          "Founders and teams across San Jose and Silicon Valley",
          "Actors who need current casting shots",
          "Anyone whose LinkedIn photo is older than their job",
        ],
      },
    ],
    faqs: [
      {
        q: "How much do headshots cost in San Jose?",
        a: costAnswer(heads, "{price}, with retouched selects and crops for web and print."),
      },
      {
        q: "What should I wear for a headshot?",
        a: "What you would actually wear to work, in solid mid to dark colors. Nothing with logos or fine stripes. Bring a second top for the second background.",
      },
      {
        q: "How fast will I get my headshots?",
        a: `Retouched selects are ready in ${heads.turnaround}.`,
      },
      {
        q: "Will the same photo work on LinkedIn and in print?",
        a: "Yes. Every select comes cropped for web and for print, so one picture covers a profile, a press release and a printed program.",
      },
      {
        q: "Can you photograph a whole team?",
        a: `Yes. Say how many people and roughly when in the form, and the quote comes back for the day. ${reply}`.trim(),
      },
    ],
    tiles: framesOf("headshots"),
    gallery: { href: "/portfolio/headshots", label: "The headshots gallery" },
    book: { type: "session", session: heads.name, title: "Book headshots" },
  },
  {
    city: "san-jose",
    slug: "model-digitals",
    name: "Digitals",
    title: "Model Digitals & Polaroids in San Jose",
    description: `Agency-standard model digitals (polaroids) in San Jose: full length, three-quarter and close, front and profile, unretouched. ${formatPrice(digitals.from)}, ready in ${digitals.turnaround}.`,
    h1: "Model digitals in San Jose",
    kicker: "Digitals · Polaroids · Agency submissions",
    lead: "Agency-standard digitals: clean light, no retouching, accurate to how you actually look. Everything an agency asks for, in one short session.",
    ...sessionFacts(digitals),
    service: "Model digitals",
    blocks: [
      { heading: "What's included", items: digitals.includes },
      {
        heading: "What to bring",
        items: [
          "Fitted basics in black or a neutral, with no logos or patterns",
          "Minimal makeup or none, hair as you normally wear it",
          "The agency's own list, if they sent one",
        ],
      },
      {
        heading: "Polaroids or digitals?",
        body: "The same thing. Agencies called them polaroids when they were shot on a Polaroid; they are digital now and the name stuck.",
      },
    ],
    faqs: [
      {
        q: "What are model digitals?",
        a: "Simple, unretouched photographs that show an agency exactly how you look today: full length, three-quarter and close, front and profile. Agencies also call them polaroids.",
      },
      {
        q: "How much do model digitals cost?",
        a: costAnswer(digitals, `{price}, ready in ${digitals.turnaround}.`),
      },
      {
        q: "Are digitals retouched?",
        a: "No. Agencies require them unretouched, so they are delivered as shot, in clean, accurate light.",
      },
      {
        q: "What should I wear for digitals?",
        a: "Fitted black or neutral basics with no logos or patterns, so the photographs show you and not the clothes. Minimal makeup or none.",
      },
      {
        q: "Do you shoot portfolio tests too?",
        a: "Yes. A styled test is a different shoot from digitals and is quoted on request: the editorial work shows what one looks like.",
      },
    ],
    tiles: coversOf("studio-digitals"),
    gallery: { href: "/portfolio/studio-digitals", label: "The digitals gallery" },
    book: { type: "session", session: digitals.name, title: "Book digitals" },
  },
  {
    city: "san-jose",
    slug: "portraits",
    name: "Portraits",
    title: "Portrait Photographer in San Jose",
    description: `Portrait sessions in San Jose: one person and an hour, in the studio or somewhere that says something about you. Two looks, retouched selects, ready in ${portraits.turnaround}.`,
    h1: "Portraits in San Jose",
    kicker: "Studio · Location · Editorial",
    lead: "One person and an hour, in the studio or somewhere in San Jose that says something about them. A portrait to keep, rather than a headshot to use.",
    ...sessionFacts(portraits),
    service: "Portrait photography",
    blocks: [
      { heading: "What's included", items: portraits.includes },
      {
        heading: "A portrait, not a headshot",
        body: "A headshot is a tool: a face, a clean background, a crop that fits a profile. A portrait is about the person, where they are and what they do, and it is made to be kept.",
      },
    ],
    faqs: [
      {
        q: "How much is a portrait session in San Jose?",
        a: costAnswer(portraits, "{price} for an hour, two looks and retouched selects."),
      },
      {
        q: "What's the difference between a portrait and a headshot?",
        a: "A headshot is made to be used: LinkedIn, press, casting. A portrait is made to be kept: it says something about the person, and is usually shot somewhere that does too.",
      },
      {
        q: "Studio or location?",
        a: "Either. A location in San Jose that means something to you, or the studio when the light should be controlled.",
      },
      {
        q: "What do I get, and when?",
        a: `Retouched selects, cropped for web and print, ready in ${portraits.turnaround}.`,
      },
    ],
    tiles: coversOf("portraits"),
    gallery: { href: "/portfolio/portraits", label: "The portraits" },
    book: { type: "session", session: portraits.name, title: "Book a portrait" },
  },
  {
    city: "san-jose",
    slug: "music-photography",
    name: "Music",
    title: "Musician Press Photos & Music Videos, San Jose",
    description:
      "Press photos, single and album cover art, and music videos for artists and bands in San Jose and the Bay Area, shot and art-directed by Julian Gigola.",
    h1: "Press photos, cover art & music videos in San Jose",
    kicker: "Artists · Bands · Labels",
    lead: "Press photos, single and album covers, and music videos for artists in San Jose and across the Bay Area, planned together, so a release looks like one thing from the press shot to the video.",
    rate: "Quoted per project",
    price: null,
    service: "Music photography and music videos",
    blocks: [
      {
        heading: "What you can book",
        items: [
          "Press photos: portraits for the EPK, the bio and the press release",
          "Cover art: the photograph and the art direction for a single or an album",
          "Music videos: directed and shot",
        ],
      },
      PROCESS,
      ...(MUSIC_VIDEOS.length
        ? [{ heading: "Music videos", items: MUSIC_VIDEOS.slice(0, 4) }]
        : []),
    ],
    faqs: [
      {
        q: "How much do press photos cost?",
        a: `Quoted per project. Say what the release is, when it is out, and what it needs, and the quote comes back with a treatment. ${reply}`.trim(),
      },
      {
        q: "What photos do I need for an EPK?",
        a: "A few portraits in both landscape and portrait orientation, at least one with room for a headline, and a square crop for streaming profiles. All from one look, so the press reads as one artist.",
      },
      {
        q: "Can the press shoot and the cover art be one shoot?",
        a: "Yes, and it usually should be. Planned together, the cover and the press photographs come from the same look and the same day.",
      },
      {
        q: "What size does cover art need to be?",
        a: "Square, and at least 3000 by 3000 pixels, which is what Apple Music asks for and covers every other platform.",
      },
      {
        q: "Do you direct music videos?",
        a: "Yes. The Motion page has the music videos, directed and shot for artists in the Bay Area.",
      },
    ],
    tiles: coversOf("artist-presskit"),
    gallery: { href: "/portfolio/artist-presskit", label: "Artist press kits" },
    book: { type: "music", title: "Plan a release" },
  },
  {
    city: "san-jose",
    slug: "brand-photography",
    name: "Brands",
    title: "Brand & Campaign Photographer, San Jose",
    description:
      "Campaign photography and art direction for consumer and tech brands in San Jose and Silicon Valley: concept, shoot and retouch. Quoted per project.",
    h1: "Brand & campaign photography in San Jose",
    kicker: "Silicon Valley · Consumer · Tech",
    lead: "Campaign imagery for consumer and technology brands in San Jose and Silicon Valley, from the concept and the art direction to the shoot and the retouch.",
    rate: "Quoted per project",
    price: null,
    service: "Brand campaign photography",
    blocks: [
      PROCESS,
      {
        // About's list, in its order.
        heading: "Services",
        items: [
          "Creative direction",
          "Art direction",
          "Photography",
          "Camera operating",
          "Producing",
          "Post-production",
        ],
      },
    ],
    faqs: [
      {
        q: "What does a campaign shoot cost?",
        a: `Quoted per project, because where the images run matters as much as the day itself. Send the brief through the form and the quote comes back with a treatment. ${reply}`.trim(),
      },
      {
        q: "How is usage licensed?",
        a: "Usage is part of the quote: where the images run, for how long, and in which territories. Say what you need in the brief.",
      },
      {
        q: "Can you shoot stills and video on the same day?",
        a: "Yes. Stills and motion from one shoot, planned together in the treatment.",
      },
      {
        q: "Do you shoot on location?",
        a: "Studio or location, in San Jose, across the Bay Area, or traveling.",
      },
      {
        q: "What should a brief include?",
        a: "References, usage, deliverables and dates. A deck is welcome but not required.",
      },
    ],
    tiles: coversOf("campaigns", 7, ["paradox", "ukiyosunknown", "sago", "goodcult", "sols", "jubo", "hua"]),
    gallery: { href: "/portfolio/campaigns", label: "The campaigns" },
    book: { type: "campaign", title: "Brief a campaign" },
  },
];

export const cityOf = (slug: string) => CITIES.find((c) => c.slug === slug);
export const pagesIn = (city: string) => PAGES.filter((p) => p.city === city);
export const pageOf = (city: string, slug: string) =>
  PAGES.find((p) => p.city === city && p.slug === slug);
export const localHref = (p: LocalPage) => `/${p.city}/${p.slug}`;

/** Where a page's Book screen sends the form, as the homepage links do. */
export const bookHref = (p: LocalPage) =>
  `/?type=${encodeURIComponent(p.book.type)}${p.book.session ? `&session=${encodeURIComponent(p.book.session)}` : ""}#contact`;
