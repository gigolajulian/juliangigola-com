/**
 * What someone can book, and what it costs.
 *
 * The old site had a /rates page that never got written — it still shipped
 * the Format demo's bio — so a visitor pricing a shoot had no way to find out
 * anything without emailing first. That is the single biggest drop-off on a
 * consumer-facing photography site.
 *
 * `from` is deliberately `null` until Julian fills it in rather than carrying
 * an invented number: a wrong price is worse than no price. Anything still
 * null renders as "On request", which is honest and keeps the page shippable
 * today.
 *
 * Each entry points at a real category in the archive, so the sample work is
 * always his actual work and never goes stale.
 */

export type SessionType = {
  /** Matches a category slug in `work-data.ts`, so samples stay in sync. */
  slug: string;
  name: string;
  blurb: string;
  /** Starting price in USD. `null` renders as "On request" — fill these in. */
  from: number | null;
  /** What the client actually walks away with. */
  includes: string[];
  turnaround: string;
};

export const SESSION_TYPES: SessionType[] = [
  {
    slug: "graduation",
    name: "Graduation",
    blurb:
      "Cap and gown, on campus or in studio. Enough coverage for the family frame and the announcement.",
    from: null,
    includes: ["1 hour on location", "Two outfit changes", "Edited gallery", "Print release"],
    turnaround: "1 week",
  },
  {
    slug: "headshots",
    name: "Headshots",
    blurb:
      "Clean, current, and usable everywhere — LinkedIn, press, casting, a company about page.",
    from: null,
    includes: ["Studio lighting", "Multiple backgrounds", "Retouched selects", "Crops for web and print"],
    turnaround: "3 days",
  },
  {
    slug: "studio-digitals",
    name: "Studio digitals",
    blurb:
      "Agency-standard digitals: clean light, no retouching, accurate to how you actually look.",
    from: null,
    includes: ["Full length, three-quarter, and close", "Front and profile", "Unretouched, as agencies require"],
    turnaround: "48 hours",
  },
  {
    slug: "weddings",
    name: "Weddings",
    blurb: "Coverage that reads as editorial rather than as a wedding album. Limited dates each year.",
    from: null,
    includes: ["Full-day coverage", "Second shooter available", "Edited gallery", "Print release"],
    turnaround: "4 weeks",
  },
];

export const formatPrice = (from: number | null): string =>
  from === null ? "On request" : `From $${from.toLocaleString("en-US")}`;
