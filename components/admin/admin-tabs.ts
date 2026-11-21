/* The editor's tabs, and which tab each field lives on (`admin-editor.tsx`). */

/**
 * The tabs, in two groups.
 *
 * Content used to be one tab holding four sections, with an index above it to
 * get between them. That is two mechanisms doing one job — a tab strip and a
 * section strip, stacked — and it left the widest part of the tool as a long
 * scroll of unrelated forms: the reply-time promise and the session prices
 * have nothing to do with each other and were two screens apart.
 *
 * One tab per area instead, and the index goes: the tabs *are* the index.
 *
 * Grouped because the two halves are different kinds of thing. The first four
 * are pages — a fixed set of fields, edited a few times a year. The last two
 * are the work — seventy-three projects that change constantly. Running all
 * six together would suggest they are the same kind of visit.
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
  /* Its own group, because it is not the same kind of visit at all.
   *
   * The first four tabs are pages and the next two are the work — both of
   * them things you go in to change. This one is post: you go in to read it,
   * and what you do afterwards happens in your mail. It also has nothing to
   * publish, which is the one thing every other tab has in common. */
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
