/** The event slugs (`EVENTS`, `booking-rules.ts`) that take a deposit on the site.
    This list decides it; `/api/slots` answers every event with price 0.
    Client-safe, no server imports. */
export const PAID = ["portraits", "headshots", "graduation", "digitals", "model-test"] as const;
export type PaidSlug = (typeof PAID)[number];
export const isPaid = (slug: string): slug is PaidSlug => (PAID as readonly string[]).includes(slug);

/** Each session's deposit in dollars, set by Julian.
    The one place the figure lives: the charge, the screens and the mails all read it.
    Here and not in `deposit.ts`, which pulls server code the client bundles must not. */
export const DEPOSIT: Record<PaidSlug, number> = { portraits: 250, headshots: 200, graduation: 200, digitals: 150, "model-test": 100 };
/** What a booking made before amounts were stored paid: every deposit was $100 then. */
export const LEGACY_DEPOSIT = 100;
/** For a slug held as a plain string (a card's event slug). Never the site's own "studio-digitals": that one is `digitals` here. */
export const depositFor = (slug: string) => (isPaid(slug) ? DEPOSIT[slug] : LEGACY_DEPOSIT);
