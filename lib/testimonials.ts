/**
 * Client quotes.
 *
 * Empty until there are real ones. Every component that reads this renders
 * nothing when the list is empty, so the site is correct today and gains a
 * testimonials section the moment real quotes are added — no invented praise
 * in the meantime, and no placeholder to forget about. Add them in `/admin`.
 *
 * Three to five is the useful range. More reads as filler.
 *
 * What makes one work: a specific detail rather than an adjective. "Turned a
 * two-hour window into eighteen usable frames" earns trust; "great to work
 * with" does not. A real name and role matters more than the length.
 */

import { CONTENT } from "./content";
import type { Testimonial } from "./content";

export type { Testimonial };

export const TESTIMONIALS: Testimonial[] = CONTENT.testimonials;
