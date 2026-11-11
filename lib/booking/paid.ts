/** Cal.com event slugs that take the $100 deposit on the site. The site's
    list, not Cal.com's price: Cal.com's own Stripe app is off for these, so
    its event price reads 0 (2026-10-16). Client-safe, no server imports. */
export const PAID = ["portraits", "headshots", "graduation", "digitals"] as const;
export const isPaid = (slug: string) => (PAID as readonly string[]).includes(slug);
