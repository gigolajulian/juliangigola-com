/**
 * What each page says to a search engine, and the facts about the business
 * that Google, Bing and the AI answer engines read off every page.
 *
 * Julian (2026-10-01): the site should turn searches into bookings, in
 * Google and Bing and in ChatGPT, Claude, Gemini and Perplexity. The
 * keyword research behind each line is in the session that wrote this file;
 * the short version is that a page ranks for what its title says, and
 * "Editorial | Julian Gigola" said nothing anybody types. A person searches
 * for the service and the place ("headshot photographer san francisco",
 * "sjsu grad photos"), so that is what the titles lead with now, and the
 * name follows from the layout's template.
 *
 * Titles are kept under ~45 characters so the " | Julian Gigola" suffix
 * still fits the ~60 a results page shows. Descriptions stay under ~160.
 *
 * Nothing here is a visible change: the headings and copy on the pages are
 * untouched. Every claim is one the site already makes somewhere: the
 * prices come from `content/site.json` through `sessions.ts`, so setting a
 * price in /admin updates the description and the structured data with it.
 */

import { SESSION_TYPES, formatPrice } from "./sessions";
import { pageForSession } from "./booking";

export const SITE = "https://juliangigola.com";
export const EMAIL = "hello@juliangigola.com";

/** The profiles that are Julian's, for `sameAs`: how an engine learns the
    Instagram, the LinkedIn and the site are one person. */
export const PROFILES = [
  "https://instagram.com/juliangigola",
  "https://www.linkedin.com/in/juliangigola",
  "https://vimeo.com/filmedbyjulian",
];

/** The places a search names. San Francisco and San Jose carry the most
    searches, and are the two markets every title names (Julian, 2026-10-02:
    "also market in San Jose"). The rest are where a client books from and
    the least contested to rank in: the South Bay towns are where a Silicon
    Valley company or an SJSU or SCU graduate is. Campuses are named on the
    graduation page, not here. */
export const AREA = [
  "San Francisco",
  "San Jose",
  "Oakland",
  "Berkeley",
  "Palo Alto",
  "Mountain View",
  "Sunnyvale",
  "Santa Clara",
  "Cupertino",
  "Campbell",
  "Los Gatos",
  "Milpitas",
  // Julian (2026-10-02): the Bay Area as he means it runs to Santa Cruz.
  "Santa Cruz",
];

/** Further than a drive: commissions, and sessions on request. */
export const TRAVEL = ["Los Angeles", "New York"];

/** A starting price as a phrase, or nothing while it is "On request". */
const from = (slug: string): string | null => {
  const s = SESSION_TYPES.find((t) => t.slug === slug);
  return s && s.from !== null ? formatPrice(s.from) : null;
};
const sentence = (...parts: (string | null)[]) =>
  parts.filter(Boolean).join(" ");

/* ── the disciplines, at /portfolio/<slug> ───────────────────────
 * Where a booking page sells the same thing (`lib/booking.ts`), the work
 * here is titled as the portfolio it is, "Headshot Portfolio", and the
 * booking page takes "Headshot Photographer": two pages of one site
 * after the same search split it, and the one that should win is the one
 * that books.
 * ─────────────────────────────────────────────────────────────── */

type PageSeo = { title: string; description: (count: number) => string };

/** Keyed by category slug. A discipline not listed here keeps the plain
    name it had, so a new one added in /admin still gets a title. */
export const DISCIPLINE_SEO: Record<string, PageSeo> = {
  editorial: {
    title: "Fashion & Editorial Photographer, SF Bay Area",
    description: (n) =>
      `Fashion and editorial photography across the SF Bay Area: ${n} editorials and lookbooks with models, stylists and credits. Published in WIRED.`,
  },
  campaigns: {
    title: "Brand Campaign Portfolio, SF Bay Area",
    description: (n) =>
      `Commercial and brand campaign photography for consumer and tech brands across the Bay Area and Silicon Valley. ${n} campaigns, shot and art-directed.`,
  },
  portraits: {
    title: "Portrait Portfolio, San Francisco Bay Area",
    description: (n) =>
      sentence(
        `Editorial portraits in the studio or on location in San Francisco, Oakland, San Jose and Santa Cruz. ${n} portrait series by Julian Gigola.`,
        from("portraits") ? `Sessions ${from("portraits")!.toLowerCase()}.` : null,
      ),
  },
  "artist-presskit": {
    title: "Artist Press Kit Portfolio, SF Bay Area",
    description: (n) =>
      `Press photos for musicians and bands in San Francisco, Oakland and San Jose: EPK portraits, release imagery and cover art. ${n} artist press kits by Julian Gigola.`,
  },
  coverart: {
    title: "Album & Single Cover Art, SF Bay Area",
    description: (n) =>
      `Album and single cover art, photographed and art-directed by Julian Gigola in the San Francisco Bay Area. ${n} releases for independent artists and labels.`,
  },
  "studio-digitals": {
    title: "Model Digitals Portfolio, SF Bay Area",
    description: () =>
      sentence(
        "Agency-standard model digitals (polaroids) in the San Francisco Bay Area: full length, three-quarter and close, front and profile, unretouched.",
        from("studio-digitals") ? `${from("studio-digitals")}.` : null,
      ),
  },
  "mixed-media": {
    title: "Mixed Media Photography & Design, Bay Area",
    description: (n) =>
      `Photography combined with design, collage and digital art, by Julian Gigola in the San Francisco Bay Area. ${n} mixed-media projects.`,
  },
  chroma: {
    title: "Chroma: Color-Lit Portrait Photography",
    description: (n) =>
      `Chroma: ${n} editorial and portrait projects lit in saturated color, by Julian Gigola, photographer in the San Francisco Bay Area.`,
  },
  events: {
    title: "Event Photographer, San Francisco Bay Area",
    description: (n) =>
      `Event coverage in San Francisco, Oakland, San Jose and Santa Cruz: launches, brand events, concerts and parties. ${n} frames by Julian Gigola.`,
  },
  automotive: {
    title: "Automotive Photographer, SF Bay Area",
    description: (n) =>
      `Automotive and car photography in San Francisco, San Jose and the Bay Area. ${n} frames by Julian Gigola.`,
  },
};

/** Motion's page, which is its own route rather than a category listing. */
export const MOTION_SEO = {
  /* "Commercial" gave way to San Jose, where a search for a music video
     director finds only directories (2026-10-02). Brand films stay in the
     description. */
  title: "Music Video Director, San Francisco Bay Area",
  description:
    "Music videos and brand films directed and shot by Julian Gigola across the Bay Area, from San Francisco and Oakland to San Jose.",
};

/* ── the sessions, at /portfolio/<slug> ───────────────────────────
 * Headshots, Graduation and Weddings are each one gallery under the
 * session's own slug. Headshots and Graduation are booked at their own
 * pages now (/headshots, /graduation-photos), so their galleries are
 * titled as galleries; Weddings has no booking page and keeps the search.
 * ─────────────────────────────────────────────────────────────── */

export const SESSION_SEO: Record<string, { title: string; description: string }> = {
  headshots: {
    title: "Headshot Portfolio, San Francisco Bay Area",
    description: sentence(
      "Professional headshots in San Francisco, Oakland, San Jose and Santa Cruz: LinkedIn, corporate, actor and press, with studio lighting and retouched selects.",
      from("headshots") ? `${from("headshots")}.` : null,
    ),
  },
  graduation: {
    title: "Graduation Photo Gallery, SF Bay Area",
    // The price before the details, so a results page that cuts the
    // description short cuts the details rather than the price.
    description: sentence(
      "Graduation photos across the SF Bay Area: on campus at SJSU and Santa Clara University, or further out.",
      from("graduation") ? `${from("graduation")}.` : null,
      "One hour, two outfit changes.",
    ),
  },
  weddings: {
    title: "Editorial Wedding Photographer, SF Bay Area",
    description: sentence(
      "Editorial wedding photography in San Francisco, Oakland, San Jose and Santa Cruz: full-day coverage that reads like a magazine. Limited dates.",
      from("weddings") ? `${from("weddings")}.` : null,
    ),
  },
};

/* ── structured data ──────────────────────────────────────────────
 * One graph on every page: the person, the business, and the site, joined
 * by `@id`. This is how an engine is told who Julian is, where he works,
 * what can be booked and for how much, rather than inferring it from the
 * prose. Bing has said its Copilot answers read schema; Google uses it to
 * tie the site to the person and the business.
 *
 * Deliberately absent: a street address, a phone number and any rating.
 * The site publishes none of them, and a business that shoots on location
 * across the Bay Area is a service-area business, which Google expects to
 * be described by `areaServed` instead.
 * ─────────────────────────────────────────────────────────────── */

const SESSION_SERVICE: Record<string, string> = {
  portraits: "Portrait photography",
  graduation: "Graduation photography",
  headshots: "Headshot photography",
  "studio-digitals": "Model digitals",
  weddings: "Wedding photography",
};

/** The commissions, which are quoted rather than priced: at their booking
    page where they have one (`lib/booking.ts`), their work where not. */
const COMMISSIONS = [
  ["Fashion & editorial photography", "/portfolio/editorial"],
  ["Brand campaign photography", "/brand-photography"],
  ["Musician press photos", "/music-photography"],
  ["Album cover art", "/portfolio/coverart"],
  ["Music video direction", "/portfolio/video"],
  ["Creative direction", "/#about"],
] as const;

export function siteGraph() {
  const person = `${SITE}/#julian`;
  const business = `${SITE}/#business`;
  const areaServed = [
    { "@type": "AdministrativeArea", name: "San Francisco Bay Area" },
    { "@type": "Place", name: "Silicon Valley" },
    ...AREA.map((name) => ({ "@type": "City", name })),
    // Julian (2026-10-02): "I can travel to ... LA and NY too".
    ...TRAVEL.map((name) => ({ "@type": "City", name })),
  ];
  /* The area is the business's, said once above rather than per service. */
  const service = (name: string, url: string) => ({
    "@type": "Service",
    name,
    url: `${SITE}${url}`,
    provider: { "@id": business },
  });

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": person,
        name: "Julian Gigola",
        jobTitle: ["Photographer", "Creative Director"],
        description:
          "Photographer and creative director based in the San Francisco Bay Area with 12+ years of experience in editorial fashion, brand campaigns and artist development. Published in WIRED.",
        url: SITE,
        image: `${SITE}/about/julian.jpg`,
        email: EMAIL,
        sameAs: PROFILES,
        worksFor: { "@id": business },
        homeLocation: {
          "@type": "Place",
          name: "San Francisco Bay Area",
          address: {
            "@type": "PostalAddress",
            addressLocality: "San Francisco",
            addressRegion: "CA",
            addressCountry: "US",
          },
        },
        knowsAbout: [
          "Fashion photography",
          "Editorial photography",
          "Commercial photography",
          "Portrait photography",
          "Headshot photography",
          "Album cover art",
          "Music video direction",
          "Creative direction",
          "Art direction",
        ],
      },
      {
        "@type": "ProfessionalService",
        "@id": business,
        name: "Julian Gigola",
        description:
          "Photography and creative direction across the San Francisco Bay Area (San Francisco, Oakland, San Jose, Santa Cruz): fashion editorials, brand campaigns, musician press photos, cover art and music videos, plus headshot, portrait, graduation, model digital and wedding sessions.",
        url: SITE,
        email: EMAIL,
        image: `${SITE}/og.jpg`,
        logo: `${SITE}/icon.svg`,
        founder: { "@id": person },
        sameAs: PROFILES,
        address: {
          "@type": "PostalAddress",
          addressLocality: "San Francisco",
          addressRegion: "CA",
          addressCountry: "US",
        },
        areaServed,
        knowsLanguage: "en",
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Sessions and commissions",
          itemListElement: [
            ...SESSION_TYPES.map((s) => ({
              "@type": "Offer",
              itemOffered: {
                /* A session's booking page where it has one, its gallery
                   where not (Weddings), and the list for one added in
                   /admin since. */
                ...service(
                  SESSION_SERVICE[s.slug] ?? s.name,
                  pageForSession(s.slug)
                    ? `/${pageForSession(s.slug)!.slug}`
                    : SESSION_SERVICE[s.slug]
                      ? `/portfolio/${s.slug}`
                      : "/#sessions",
                ),
                description: s.blurb,
              },
              ...(s.from !== null
                ? {
                    priceSpecification: {
                      "@type": "PriceSpecification",
                      minPrice: s.from,
                      priceCurrency: "USD",
                    },
                  }
                : {}),
            })),
            ...COMMISSIONS.map(([name, url]) => ({
              "@type": "Offer",
              itemOffered: service(name, url),
            })),
          ],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        url: SITE,
        name: "Julian Gigola",
        publisher: { "@id": business },
        inLanguage: "en-US",
      },
    ],
  };
}

/** A JSON-LD payload, safe to inline: `<` escaped so no string in it can
    close the script element (the Next.js JSON-LD guide's advice). */
export const ldJson = (data: unknown) =>
  JSON.stringify(data).replace(/</g, "\\u003c");

/* ── a booking page's own graph ───────────────────────────────────
 * Beside the site's graph: the service this page sells, the places it is
 * sold in (the same list the page's Where screen shows), and from what
 * price, tied to the business by `@id`; its questions as an FAQPage (no
 * longer a Google rich result, but the plainest statement of the answers
 * there is for the engines that read it); and its place under the home
 * page, as a breadcrumb.
 * ─────────────────────────────────────────────────────────────── */

type ServiceLd = {
  url: string;
  name: string;
  service: string;
  description: string;
  price: number | null;
  faqs: { q: string; a: string }[];
  places: string[];
};

export function serviceGraph(p: ServiceLd) {
  const url = `${SITE}${p.url}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: p.service,
        serviceType: p.service,
        description: p.description,
        url,
        provider: { "@id": `${SITE}/#business` },
        areaServed: p.places
          .filter((name) => name !== "Anywhere else")
          .map((name) => ({ "@type": "City", name })),
        ...(p.price !== null
          ? {
              offers: {
                "@type": "Offer",
                priceSpecification: {
                  "@type": "PriceSpecification",
                  minPrice: p.price,
                  priceCurrency: "USD",
                },
                url: `${url}#book`,
              },
            }
          : {}),
      },
      ...(p.faqs.length
        ? [
            {
              "@type": "FAQPage",
              "@id": `${url}#questions`,
              mainEntity: p.faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ]
        : []),
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Julian Gigola", item: SITE },
          { "@type": "ListItem", position: 2, name: p.name, item: url },
        ],
      },
    ],
  };
}
