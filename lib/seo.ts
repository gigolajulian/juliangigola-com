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
];

/** A starting price as a phrase, or nothing while it is "On request". */
const from = (slug: string): string | null => {
  const s = SESSION_TYPES.find((t) => t.slug === slug);
  return s && s.from !== null ? formatPrice(s.from) : null;
};
const sentence = (...parts: (string | null)[]) =>
  parts.filter(Boolean).join(" ");

/* ── the disciplines, at /portfolio/<slug> ─────────────────────── */

type PageSeo = { title: string; description: (count: number) => string };

/** Keyed by category slug. A discipline not listed here keeps the plain
    name it had, so a new one added in /admin still gets a title. */
export const DISCIPLINE_SEO: Record<string, PageSeo> = {
  editorial: {
    title: "Fashion & Editorial Photographer, SF & San Jose",
    description: (n) =>
      `Fashion and editorial photography in San Francisco and San Jose: ${n} editorials and lookbooks with models, stylists and credits. Published in WIRED.`,
  },
  campaigns: {
    title: "Brand Campaign Photographer, SF & San Jose",
    description: (n) =>
      `Commercial and brand campaign photography for consumer and tech brands in San Francisco, San Jose and Silicon Valley. ${n} campaigns, shot and art-directed.`,
  },
  portraits: {
    title: "Portrait Photographer, San Francisco & San Jose",
    description: (n) =>
      sentence(
        `Editorial portraits in the studio or on location in San Francisco, San Jose and across the Bay Area. ${n} portrait series by Julian Gigola.`,
        from("portraits") ? `Sessions ${from("portraits")!.toLowerCase()}.` : null,
      ),
  },
  "artist-presskit": {
    title: "Musician Press Photos, San Francisco & San Jose",
    description: (n) =>
      `Press photos for musicians and bands in San Francisco and San Jose: EPK portraits, release imagery and cover art. ${n} artist press kits by Julian Gigola.`,
  },
  coverart: {
    title: "Album & Single Cover Art, SF & San Jose",
    description: (n) =>
      `Album and single cover art, photographed and art-directed by Julian Gigola in San Francisco and San Jose. ${n} releases for independent artists and labels.`,
  },
  "studio-digitals": {
    title: "Model Digitals & Polaroids, SF & San Jose",
    description: () =>
      sentence(
        "Agency-standard model digitals (polaroids) in San Francisco and San Jose: full length, three-quarter and close, front and profile, unretouched.",
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
    title: "Event Photographer, San Francisco & San Jose",
    description: (n) =>
      `Event coverage in San Francisco, San Jose and the Bay Area: launches, brand events, concerts and parties. ${n} frames by Julian Gigola.`,
  },
  automotive: {
    title: "Automotive Photographer, SF & San Jose",
    description: (n) =>
      `Automotive and car photography in San Francisco, San Jose and the Bay Area. ${n} frames by Julian Gigola.`,
  },
};

/** Motion's page, which is its own route rather than a category listing. */
export const MOTION_SEO = {
  /* "Commercial" gave way to San Jose, where a search for a music video
     director finds only directories (2026-10-02). Brand films stay in the
     description. */
  title: "Music Video Director, San Francisco & San Jose",
  description:
    "Music videos and brand films directed and shot by Julian Gigola in San Francisco, San Jose and the Bay Area, for artists, startups and consumer brands.",
};

/* ── the sessions, at /portfolio/<slug> ───────────────────────────
 * Headshots, Graduation and Weddings are each one gallery under the
 * session's own slug. They are the only pages on the site a search for a
 * bookable session can land on, so they are titled for the search.
 * ─────────────────────────────────────────────────────────────── */

export const SESSION_SEO: Record<string, { title: string; description: string }> = {
  headshots: {
    title: "Headshot Photographer, San Francisco & San Jose",
    description: sentence(
      "Professional headshots in San Francisco, San Jose and Silicon Valley: LinkedIn, corporate, actor and press. Studio lighting, retouched selects, ready in 3 days.",
      from("headshots") ? `${from("headshots")}.` : null,
    ),
  },
  graduation: {
    title: "Graduation Photographer, San Jose: SJSU & SCU",
    // The price before the details, so a results page that cuts the
    // description short cuts the details rather than the price.
    description: sentence(
      "Graduation photos at SJSU, Santa Clara University and across San Jose and the Bay Area.",
      from("graduation") ? `${from("graduation")}.` : null,
      "One hour on campus, two outfit changes, edited gallery.",
    ),
  },
  weddings: {
    title: "Editorial Wedding Photographer, SF & San Jose",
    description: sentence(
      "Editorial wedding photography in San Francisco, San Jose and the Bay Area: full-day coverage that reads like a magazine, not an album. Limited dates each year.",
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

/** The commissions, which are quoted rather than priced. */
const COMMISSIONS = [
  ["Fashion & editorial photography", "/portfolio/editorial"],
  ["Brand campaign photography", "/portfolio/campaigns"],
  ["Musician press photos", "/portfolio/artist-presskit"],
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
          "Photography and creative direction in San Francisco, San Jose and the Bay Area: fashion editorials, brand campaigns, musician press photos, cover art and music videos, plus headshot, portrait, graduation, model digital and wedding sessions.",
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
                /* The five sessions each have a gallery at /portfolio/<slug>,
                   titled for its search (SESSION_SEO, DISCIPLINE_SEO). One
                   added in /admin since may not, so it points at the list. */
                ...(SESSION_SERVICE[s.slug]
                  ? service(SESSION_SERVICE[s.slug], `/portfolio/${s.slug}`)
                  : service(s.name, "/#sessions")),
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
