/**
 * Client quotes.
 *
 * Deliberately empty. Every component that reads this renders nothing when
 * the list is empty, so the site is correct today and gains a testimonials
 * section the moment real quotes are added — no invented praise in the
 * meantime, and no placeholder to forget about.
 *
 * Three to five is the useful range. More reads as filler.
 *
 * What makes one work: a specific detail rather than an adjective. "Turned a
 * two-hour window into eighteen usable frames" earns trust; "great to work
 * with" does not. A real name and role matters more than the length.
 */

export type Testimonial = {
  quote: string;
  name: string;
  /** Role and company, e.g. "Art Director, WIRED". */
  role?: string;
  /** Slug of a project this client is attached to, if any — links the quote to the work. */
  project?: string;
};

export const TESTIMONIALS: Testimonial[] = [];
