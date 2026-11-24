/* The editor's tabs, and which tab each field lives on (`editor.tsx`). */

/**
 * The tabs, in three groups: pages (a fixed set of fields, edited a few times
 * a year), the work (projects and disciplines, which change constantly), and
 * the post (Leads, Inbox, Traffic, SEO: read, with nothing to publish).
 */
export const TABS = [
  [
    { id: "home", label: "Home" },
    { id: "clients", label: "Clients" },
    { id: "sessions", label: "Sessions" },
    { id: "testimonials", label: "Quotes" },
    { id: "contact", label: "Contact" },
  ],
  [
    { id: "disciplines", label: "Disciplines" },
    { id: "projects", label: "Projects" },
    // With the work rather than with the pages: it is a discipline whose
    // contents change, not a page whose copy does.
    { id: "video", label: "Motion" },
    // Same reason as Motion: a discipline whose contents are arranged, not
    // a page whose copy is written.
    { id: "coverart", label: "Cover art" },
  ],
  [
    // One row per person, with a stage (`components/leads/desk.tsx`). The Inbox stays the raw log.
    { id: "leads", label: "Leads" },
    { id: "inbox", label: "Inbox" },
    // Read-only too: who came to the site and from where.
    { id: "traffic", label: "Traffic" },
    // And how search and visitors use each page: `admin-seo.tsx`.
    { id: "seo", label: "SEO" },
  ],
] as const;

export type View = (typeof TABS)[number][number]["id"];

/**
 * Which tab a field lives on, so a sitemap row can still reach it.
 *
 * The sitemap sends you to a *field* — "Home" means the selected-work list,
 * not the top of a page — and that field is now behind a tab. So a jump is
 * two moves: switch to the tab that holds it, then scroll to it.
 */
export const FIELD_TAB: Record<string, View> = {
  responseTime: "contact",
  bookingUrl: "contact",
  featured: "home",
  heroDisciplines: "home",
  coverArt: "home",
  videos: "video",
  coverArtOrder: "coverart",
  clientsHome: "clients",
  clientsStudio: "clients",
  sessions: "sessions",
  testimonials: "testimonials",
};
