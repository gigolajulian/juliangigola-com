/** The event slugs (`EVENTS`, `lib/booking/rules.ts`) that take a deposit on the site.
    This list decides it; `/api/slots` says nothing of a price.
    Client-safe, no server imports. In lib/leads because the invoices and the Stripe import read it too;
    lib/booking imports it from here. */
export const DEPOSIT_SESSIONS = ["portraits", "headshots", "graduation", "digitals", "model-test"] as const;
export type PaidSlug = (typeof DEPOSIT_SESSIONS)[number];
export const takesDeposit = (slug: string): slug is PaidSlug => (DEPOSIT_SESSIONS as readonly string[]).includes(slug);

/** Each session's deposit in dollars, set by Julian.
    The one place the figure lives: the charge, the screens and the mails all read it.
    Here and not in `lib/booking/deposit.ts`, which pulls server code the client bundles must not. */
export const DEPOSIT: Record<PaidSlug, number> = { portraits: 250, headshots: 200, graduation: 200, digitals: 150, "model-test": 100 };
/** What a booking made before amounts were stored paid: every deposit was $100 then. */
export const LEGACY_DEPOSIT = 100;
/** For a slug held as a plain string (a card's event slug). Never the site's own "studio-digitals": that one is `digitals` here. */
export const depositFor = (slug: string) => (takesDeposit(slug) ? DEPOSIT[slug] : LEGACY_DEPOSIT);
export const CURRENCY = "usd";
export const DEPOSIT_KIND = "deposit";

/** Whether a paid intent is one of the site's deposits, not any other payment on the account.
    Any session's amount passes, not only its own slug's: an intent made at the old $100 just
    before a price change must still book, or it sits paid and unbooked. */
export const isDeposit = (pi: { amount?: number; currency?: string; metadata?: { [k: string]: string } }) =>
  pi.metadata?.kind === DEPOSIT_KIND &&
  [...Object.values(DEPOSIT), LEGACY_DEPOSIT].some((d) => d * 100 === pi.amount) &&
  pi.currency === CURRENCY;
