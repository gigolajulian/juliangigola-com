/**
 * The booking pages' addresses, at the site root: /headshots, /portraits...
 *
 * On their own, with no imports, because `next.config.ts` reads them too:
 * two of them (/headshots, /portraits) were addresses on the old Format
 * site, and the redirects it generates for those would otherwise answer
 * first and send the visitor past the page built for exactly that search.
 */
export const BOOKING_SLUGS = [
  "headshots",
  "graduation-photos",
  "model-digitals",
  "portraits",
  "weddings",
  "music-photography",
  "brand-photography",
] as const;

export type BookingSlug = (typeof BOOKING_SLUGS)[number];
