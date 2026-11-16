/** Cal.com event slugs that take a deposit on the site. The site's
    list, not Cal.com's price: Cal.com's own Stripe app is off for these, so
    its event price reads 0 (2026-10-16). Client-safe, no server imports. */
export const PAID = ["portraits", "headshots", "graduation", "digitals", "model-test"] as const;
export type PaidSlug = (typeof PAID)[number];
export const isPaid = (slug: string): slug is PaidSlug => (PAID as readonly string[]).includes(slug);

/** Each session's deposit in dollars (Julian, 2026-11-15: Headshots 200, Studio digitals 150;
    2026-11-16: Portraits 250, Graduation 200).
    The one place the figure lives: the charge, the screens and the mails all read it.
    Here and not in `deposit.ts`, which pulls server code the client bundles must not. */
export const DEPOSIT: Record<PaidSlug, number> = { portraits: 250, headshots: 200, graduation: 200, digitals: 150, "model-test": 100 };
export const depositOf = (slug: PaidSlug) => DEPOSIT[slug];
/** What a booking made before amounts were stored paid: every deposit was $100 then. */
export const LEGACY_DEPOSIT = 100;
/** For a slug held as a plain string (a card's Cal.com event slug). Never the site's own "studio-digitals": that one is `digitals` here. */
export const depositFor = (slug: string) => (isPaid(slug) ? DEPOSIT[slug] : LEGACY_DEPOSIT);
