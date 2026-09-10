/**
 * Site-wide claims and third-party hooks.
 *
 * Everything here is a statement to the world made on Julian's behalf, or an
 * integration point waiting on a URL. Keeping them in one file means none of
 * it is buried in a component where it can quietly go out of date.
 */

/**
 * The reply-time promise shown beside the contact form.
 *
 * It reduces form abandonment because it answers "will this go anywhere?"
 * before the visitor has to decide. It is also a commitment — set it to
 * something you will actually hit, and set it to `null` rather than let it
 * become untrue.
 */
export const RESPONSE_TIME: string | null = "within 24 hours";

/**
 * Direct booking link — a Google Calendar appointment schedule.
 *
 * Null until the schedule exists. Everywhere this is used renders a "Check
 * availability" button when it is set and falls back to the enquiry form when
 * it is not, so dropping the URL in here is the only change needed to turn
 * self-serve booking on across the whole site.
 *
 * Use the public booking-page URL, the one that looks like
 * `https://calendar.app.google/…`, not a share or edit link.
 */
export const BOOKING_URL: string | null = null;
