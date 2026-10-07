/**
 * The booking pages: one per service, at the root (/headshots,
 * /graduation-photos...), each for San Francisco and San Jose at once.
 *
 * Julian (2026-10-02): booking pages, "no vertical pages", San Jose and
 * San Francisco mainly, "I can travel to any of those, LA and NY too",
 * and "I don't need separate pages for each" city. So a page per service,
 * a deck of screens like the homepage (`components/local-screens.tsx`),
 * whose title names the two cities he works in and whose "Where" screen
 * names every place he shoots, visibly: a search engine ranks a city it
 * can read on the page, and the structured data says the same thing.
 *
 * Every fact is one the site already states: the prices, inclusions and
 * turnaround come from the session in `content/site.json` (so /admin
 * changes them here too), the process from About, the reply time from
 * `lib/site.ts`. Answers that are general advice (what to wear, when to
 * book) are written as advice, not as policy.
 */

import { SESSION_TYPES, formatPrice, type SessionType } from "./sessions";
import { RESPONSE_TIME } from "./site";
import { CONTENT } from "./content";
import { getProject, projectsIn } from "./work";
import type { BookingSlug } from "./booking-slugs";
import type { Frame } from "./work-types";

export type Faq = { q: string; a: string };
export type Block = { heading: string; items?: string[]; body?: string };
export type Tile = { frame: Frame; href: string; caption: string };
/** A place on the Where screen: its name and what working there means. */
export type Place = { name: string; note: string };

export type BookingPage = {
  slug: BookingSlug;
  /** The service in a word, for the rail, the crumb and the cross links. */
  name: string;
  /** `<title>` before the template's " | Julian Gigola", and the meta
      description. Titled for the search; see `lib/seo.ts`. */
  title: string;
  description: string;
  h1: string;
  kicker: string;
  lead: string;
  /** "From $400" or "On request" for a session, "Quoted per project" for
      a commission; and how soon it comes back. */
  rate: string;
  turnaround?: string;
  /** The schema.org service name and starting price. */
  service: string;
  price: number | null;
  /** The session in `content/site.json` this page books, if it is one. */
  session?: string;
  /** Where the crumb goes back to. */
  back: { href: string; label: string };
  blocks: Block[];
  where: Place[];
  faqs: Faq[];
  /** The photographs: the first is the cover, the rest the work screen. */
  tiles: Tile[];
  gallery: { href: string; label: string };
  /** The frames its work screen shows, where the gallery is too large to
      show whole: chosen, not sampled (Julian, 2026-10-03). */
  picks?: string[];
  /** Presets for the form on the Book screen. */
  /** `calendar`: the Google Calendar appointment schedule's id, embedded
      on the Book screen in place of the form (hello@juliangigola.com). */
  book: { type: string; session?: string; title: string; calendar?: string };
};

/** Every city the pages name, for the structured data's service area. */
export const PLACES = [
  "San Francisco",
  "San Jose",
  "Oakland",
  "Santa Cruz",
  "Los Angeles",
  "New York",
];

/* ── shared wording ─────────────────────────────────────────────── */

const session = (slug: string): SessionType => {
  const s = SESSION_TYPES.find((t) => t.slug === slug);
  if (!s) throw new Error(`lib/booking.ts: no session "${slug}" in content/site.json.`);
  return s;
};

/** The reply-time promise, where one is made. */
const reply = RESPONSE_TIME ? `The reply comes back ${RESPONSE_TIME}.` : "";

/** How a commission runs: About's four steps, in the same words. */
const PROCESS: Block = {
  heading: "How it runs",
  items: [
    "Brief: references, usage, deliverables and dates. A deck is welcome but not required.",
    "Treatment: a lighting and location approach, a shot list and a quote covering crew and licensing.",
    "Shoot: studio or location, Bay Area or traveling.",
    "Delivery: selects for approval, then final retouched files in the crops and color spaces you need.",
  ],
};

/** Where a session is shot. The two cities he works from, the two he
    drives to, and the two he flies to. */
const SESSION_WHERE: Place[] = [
  { name: "San Francisco", note: "Studio or location, anywhere in the city." },
  { name: "San Jose", note: "Studio or location, and across the South Bay and Silicon Valley." },
  { name: "Oakland", note: "And the East Bay. Say where in the form." },
  { name: "Santa Cruz", note: "And the coast. Say where in the form." },
  { name: "Los Angeles", note: "On request; travel is quoted with the booking." },
  { name: "New York", note: "On request; travel is quoted with the booking." },
];

/** Where a commission is shot: anywhere the work is. */
const COMMISSION_WHERE: Place[] = [
  { name: "San Francisco", note: "Studio or location." },
  { name: "San Jose", note: "Studio or location, across Silicon Valley." },
  { name: "Oakland", note: "And the East Bay." },
  { name: "Santa Cruz", note: "And the coast." },
  { name: "Los Angeles", note: "Travel is quoted with the shoot." },
  { name: "New York", note: "Travel is quoted with the shoot." },
];

/** A session's rate, turnaround and price as the page shows them. */
const sessionFacts = (s: SessionType) => ({
  rate: formatPrice(s.from),
  turnaround: s.turnaround,
  price: s.from,
  session: s.slug,
});

/** A priced answer, or the on-request one. */
const costAnswer = (s: SessionType, priced: string) =>
  s.from === null
    ? `Quoted on request, depending on what you need. Send the details through the booking form. ${reply}`.trim()
    : priced.replace("{price}", formatPrice(s.from));

const SESSIONS = { href: "/#sessions", label: "Sessions" };
const PORTFOLIO = { href: "/portfolio", label: "Portfolio" };

/* ── the photographs ────────────────────────────────────────────── */

const caption = (name: string) =>
  name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/** A one-gallery session's frames, each opening the gallery. */
const framesOf = (slug: string, n = Infinity): Tile[] => {
  const p = getProject(slug);
  if (!p) return [];
  return p.images.slice(0, n).map((frame, i) => ({
    frame,
    href: `/portfolio/${p.slug}`,
    caption: `${caption(p.name)} ${String(i + 1).padStart(2, "0")}`,
  }));
};

/** A discipline's projects, a frame each, each opening its project. */
const coversOf = (category: string, n = Infinity, prefer: string[] = []): Tile[] => {
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

/* ── the pages ──────────────────────────────────────────────────── */

const grad = session("graduation");
const heads = session("headshots");
const digitals = session("studio-digitals");
const portraits = session("portraits");
const weddings = session("weddings");

export const BOOKING_PAGES: BookingPage[] = [
  {
    slug: "headshots",
    name: "Headshots",
    title: "Headshot Photographer, San Francisco & San Jose",
    description: `Professional headshots in San Francisco and San Jose: LinkedIn, corporate, actor and press. Studio lighting, retouched selects, ready in ${heads.turnaround}.`,
    h1: "Headshots in San Francisco & San Jose",
    kicker: "LinkedIn · Corporate · Actors · Press",
    lead: `Clean, current and usable everywhere: LinkedIn, press, casting, a company about page. Studio lighting, more than one background and retouched selects back in ${heads.turnaround}.`,
    ...sessionFacts(heads),
    service: "Headshot photography",
    back: SESSIONS,
    blocks: [
      { heading: "What's included", items: heads.includes },
      {
        heading: "For teams",
        body: "Booking for a company? Say how many people and roughly when in the booking form, and the quote covers the whole team.",
      },
      {
        heading: "Who it's for",
        items: [
          "Founders and teams, from SoMa to Silicon Valley",
          "Actors who need current casting shots",
          "Anyone whose LinkedIn photo is older than their job",
        ],
      },
    ],
    where: SESSION_WHERE,
    faqs: [
      {
        q: "How much do headshots cost in San Francisco or San Jose?",
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
        a: `Yes. Say how many people and roughly when in the booking form, and the quote comes back for the day. ${reply}`.trim(),
      },
    ],
    tiles: framesOf("headshots"),
    gallery: { href: "/portfolio/headshots", label: "The headshots gallery" },
    book: { type: "session", session: heads.name, title: "Book headshots", calendar: "AcZssZ0uTmIdvTQpdNHXZu7EIbFffjn9qFap_BVZQ0aOFL03IsfZ6CRDagD3cWnaAbkvlrTTCM9_l-OY" },
  },
  {
    slug: "graduation-photos",
    name: "Graduation",
    title: "Graduation Photos in San Jose & San Francisco",
    description: `Graduation photos at SJSU, Santa Clara University, SF State, USF and across the Bay Area. ${formatPrice(grad.from)}: one hour, two outfit changes, edited gallery.`,
    h1: "Graduation photos in San Jose & San Francisco",
    kicker: "SJSU · Santa Clara · SF State · USF · Berkeley",
    lead: "Cap and gown on campus or in the studio, at SJSU and Santa Clara University or anywhere else in the Bay Area. An hour, two outfit changes and enough coverage for the family frame and the announcement.",
    ...sessionFacts(grad),
    service: "Graduation photography",
    back: SESSIONS,
    blocks: [
      { heading: "What's included", items: grad.includes },
      {
        heading: "Where on campus",
        items: [
          "SJSU: Tower Hall and Tower Lawn, the Tommie Smith and John Carlos statue and outside King Library.",
          "Santa Clara University: the Mission Church and its gardens, and Palm Drive.",
          "SF State: Malcolm X Plaza and the J. Paul Leonard Library.",
          "USF: St. Ignatius Church and Lone Mountain.",
          "UC Berkeley: Sather Tower and Sather Gate.",
        ],
      },
      {
        heading: "When to book",
        body: "Spring commencement dates go first. Book four to six weeks ahead and shoot a week or two before the ceremony, so the gallery is back in time for the announcements.",
      },
    ],
    where: [
      { name: "San Jose", note: "SJSU, included." },
      { name: "Santa Clara", note: "Santa Clara University, included." },
      { name: "San Francisco", note: "SF State and USF; a travel fee applies." },
      { name: "Berkeley", note: "UC Berkeley; a travel fee applies." },
      { name: "Santa Cruz", note: "UC Santa Cruz; a travel fee applies." },
      { name: "Anywhere else", note: "Any campus or place that means something to you; a travel fee applies." },
    ],
    faqs: [
      {
        q: "How much are graduation photos?",
        a: costAnswer(
          grad,
          "{price} for an hour on campus at SJSU or Santa Clara University, with two outfit changes, an edited gallery and a print release. At SF State, USF, UC Berkeley and further out, a travel fee applies.",
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
        a: "Yes, anywhere in the Bay Area: SF State, USF, UC Berkeley, Stanford, UC Santa Cruz. SJSU and Santa Clara University are included; a travel fee applies further out.",
      },
    ],
    tiles: framesOf("graduation"),
    gallery: { href: "/portfolio/graduation", label: "The graduation gallery" },
    book: { type: "session", session: grad.name, title: "Book a graduation session", calendar: "AcZssZ1xuDp0FQU0bQESt670XPAJ7R76ql1RdYTRBokN_AybNjkeSrqXLGD8_Qg5bDY9FZBRbDhYiGz7" },
  },
  {
    slug: "model-digitals",
    name: "Digitals",
    title: "Model Digitals & Polaroids, SF & San Jose",
    description: `Agency-standard model digitals (polaroids) in San Francisco and San Jose: full length, three-quarter and close, front and profile, unretouched. ${formatPrice(digitals.from)}.`,
    h1: "Model digitals in San Francisco & San Jose",
    kicker: "Digitals · Polaroids · Agency submissions",
    lead: "Agency-standard digitals: clean light, no retouching, accurate to how you actually look. Everything an agency asks for, in one short session.",
    ...sessionFacts(digitals),
    service: "Model digitals",
    back: SESSIONS,
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
    where: SESSION_WHERE,
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
    // Only the frames that read as digitals: plain ground, standing or
    // close, no styling (Julian, 2026-10-03). Taneka's and Zoe's sets are
    // posed floor work and stay in the gallery.
    picks: [
      "/work/abril/04.jpg",
      "/work/abril/01.jpg",
      "/work/abril/03.jpg",
      "/work/abril/02.jpg",
      "/work/giselle-studio-digitals/14.jpg",
      "/work/giselle-studio-digitals/15.jpg",
      "/work/giselle-studio-digitals/01.jpg",
      "/work/mya/06.jpg",
      "/work/mya/05.jpg",
    ],
    book: { type: "session", session: digitals.name, title: "Book digitals", calendar: "AcZssZ3ZCkVh-KA0BaMB1EDaf9nat1xleBQ0tPBHEhqNlau_nzeVjlOsmnAVHo9dqVtURSSFNSHqjazB" },
  },
  {
    slug: "portraits",
    name: "Portraits",
    title: "Portrait Photographer, San Francisco & San Jose",
    description: `Portrait sessions in San Francisco and San Jose: one person and an hour, in the studio or somewhere that says something about you. Ready in ${portraits.turnaround}.`,
    h1: "Portraits in San Francisco & San Jose",
    kicker: "Studio · Location · Editorial",
    lead: "One person and an hour, in the studio or somewhere that says something about them. A portrait to keep, rather than a headshot to use.",
    ...sessionFacts(portraits),
    service: "Portrait photography",
    back: SESSIONS,
    blocks: [
      { heading: "What's included", items: portraits.includes },
      {
        heading: "A portrait, not a headshot",
        body: "A headshot is a tool: a face, a clean background, a crop that fits a profile. A portrait is about the person, where they are and what they do, and it is made to be kept.",
      },
    ],
    where: SESSION_WHERE,
    faqs: [
      {
        q: "How much is a portrait session?",
        a: costAnswer(portraits, "{price} for an hour, two looks and retouched selects."),
      },
      {
        q: "What's the difference between a portrait and a headshot?",
        a: "A headshot is made to be used: LinkedIn, press, casting. A portrait is made to be kept: it says something about the person, and is usually shot somewhere that does too.",
      },
      {
        q: "Studio or location?",
        a: "Either. A place in San Francisco, San Jose or anywhere in the Bay Area that means something to you, or the studio when the light should be controlled.",
      },
      {
        q: "What do I get, and when?",
        a: `Retouched selects, cropped for web and print, ready in ${portraits.turnaround}.`,
      },
    ],
    tiles: coversOf("portraits"),
    gallery: { href: "/portfolio/portraits", label: "The portraits" },
    book: { type: "session", session: portraits.name, title: "Book a portrait session", calendar: "AcZssZ14pWKn0PhQZxKSfrSjutq_NM4vtqcRXF4C4PYuzZrXcN54Ec4BO_Rms3HgjKdsDRQYo670AQbD" },
  },
  {
    slug: "weddings",
    name: "Weddings",
    title: "Editorial Wedding Photographer, SF & San Jose",
    description:
      "Editorial wedding photography in San Francisco, San Jose and across the Bay Area: full-day coverage that reads like a magazine, not an album. Limited dates.",
    h1: "Editorial weddings in San Francisco & San Jose",
    kicker: "Full day · Editorial · Limited dates",
    lead: weddings.blurb,
    ...sessionFacts(weddings),
    service: "Wedding photography",
    back: SESSIONS,
    blocks: [
      { heading: "What's included", items: weddings.includes },
      {
        heading: "Editorial, not an album",
        body: "The day photographed the way a magazine would run it: the people, the place and the light, as a story rather than a checklist.",
      },
      {
        heading: "Limited dates",
        body: "A few weddings a year, so each one gets the time it needs. Send the date in the form as early as you have it.",
      },
    ],
    where: SESSION_WHERE,
    faqs: [
      {
        q: "How much does a wedding photographer cost in San Francisco or San Jose?",
        a: costAnswer(weddings, "{price} for full-day coverage, an edited gallery and a print release."),
      },
      {
        q: "How far ahead should we book?",
        a: "As soon as you have a date. There are only a few each year, and spring and fall Saturdays go first.",
      },
      {
        q: "Is a second shooter available?",
        a: "Yes, for a larger wedding or when two places need covering at once. Say so in the form.",
      },
      {
        q: "When will we get the photos?",
        a: `The edited gallery is ready in ${weddings.turnaround}, with a print release so you can print anywhere.`,
      },
      {
        q: "Do you travel for weddings?",
        a: "Anywhere in the Bay Area, and to Los Angeles, New York and further. Travel is quoted with the booking.",
      },
    ],
    tiles: framesOf("weddings"),
    gallery: { href: "/portfolio/weddings", label: "The weddings gallery" },
    picks: [
      "/work/weddings/02.jpg",
      "/work/weddings/03.jpg",
      "/work/weddings/05.jpg",
      "/work/weddings/10.jpg",
      "/work/weddings/11.jpg",
      "/work/weddings/13.jpg",
      "/work/weddings/17.jpg",
      "/work/weddings/18.jpg",
      "/work/weddings/29.jpg",
      "/work/weddings/30.jpg",
      "/work/weddings/31.jpg",
      "/work/weddings/32.jpg",
      "/work/weddings/38.jpg",
      "/work/weddings/40.jpg",
    ],
    book: { type: "session", session: weddings.name, title: "Book your wedding" },
  },
  {
    slug: "music-photography",
    name: "Music",
    title: "Musician Press Photos & Music Videos, Bay Area",
    description:
      "Press photos, single and album cover art and music videos for artists and bands in San Francisco, San Jose and Oakland, shot and art-directed by Julian Gigola.",
    h1: "Press photos, cover art & music videos",
    kicker: "Artists · Bands · Labels",
    lead: "Press photos, single and album covers and music videos for artists in San Francisco, San Jose and across the Bay Area, planned together, so a release looks like one thing from the press shot to the video.",
    rate: "Quoted per project",
    price: null,
    service: "Music photography and music videos",
    back: PORTFOLIO,
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
    where: COMMISSION_WHERE,
    faqs: [
      {
        q: "How much do press photos cost?",
        a: `Quoted per project. Say what the release is, when it is out and what it needs, and the quote comes back with a treatment. ${reply}`.trim(),
      },
      {
        q: "What photos do I need for an EPK?",
        a: "A few portraits in both landscape and portrait orientation, at least one with room for a headline and a square crop for streaming profiles. All from one look, so the press reads as one artist.",
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
      {
        q: "Do you shoot in Los Angeles or New York?",
        a: "Yes. Travel is quoted with the shoot; say where and when in the form.",
      },
    ],
    tiles: coversOf("artist-presskit"),
    gallery: { href: "/portfolio/artist-presskit", label: "Artist press kits" },
    book: { type: "music", title: "Plan a release" },
  },
  {
    slug: "brand-photography",
    name: "Brands",
    title: "Brand & Campaign Photographer, SF & San Jose",
    description:
      "Campaign photography for consumer and tech brands in San Francisco, San Jose and Silicon Valley: concept, art direction, shoot and retouch. Quoted per project.",
    h1: "Brand & campaign photography",
    kicker: "Consumer · Tech · Fashion",
    lead: "Campaign imagery for consumer and technology brands in San Francisco, San Jose and Silicon Valley, from the concept and the art direction to the shoot and the retouch.",
    rate: "Quoted per project",
    price: null,
    service: "Brand campaign photography",
    back: PORTFOLIO,
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
    where: COMMISSION_WHERE,
    faqs: [
      {
        q: "What does a campaign shoot cost?",
        a: `Quoted per project, because where the images run matters as much as the day itself. Send the brief through the booking form and the quote comes back with a treatment. ${reply}`.trim(),
      },
      {
        q: "How is usage licensed?",
        a: "Usage is part of the quote: where the images run, for how long and in which territories. Say what you need in the brief.",
      },
      {
        q: "Can you shoot stills and video on the same day?",
        a: "Yes. Stills and motion from one shoot, planned together in the treatment.",
      },
      {
        q: "Do you travel for shoots?",
        a: "Yes: across the Bay Area, and to Los Angeles, New York and further. Travel is quoted with the shoot.",
      },
      {
        q: "What should a brief include?",
        a: "References, usage, deliverables and dates. A deck is welcome but not required.",
      },
    ],
    tiles: coversOf("campaigns", Infinity, ["paradox", "ukiyosunknown", "sago", "goodcult", "sols", "jubo", "hua"]),
    gallery: { href: "/portfolio/campaigns", label: "The campaigns" },
    book: { type: "campaign", title: "Brief a campaign" },
  },
];

export const bookingPage = (slug: string) =>
  BOOKING_PAGES.find((p) => p.slug === slug);
export const bookingHref = (p: BookingPage) => `/${p.slug}`;
/** The page that books a session in `content/site.json`, if there is one. */
export const pageForSession = (sessionSlug: string) =>
  BOOKING_PAGES.find((p) => p.session === sessionSlug);
