/* ── juliangigola-booking: the Worker that holds the booking lock ──
 * Deployed on its own (`npx wrangler deploy -c worker/wrangler.jsonc`),
 * never by Workers Builds. The site's Worker reaches the lock through its
 * BOOKING_LOCK binding (`script_name`); nothing is served here.
 * ─────────────────────────────────────────────────────────────── */

export { BookingLock } from "./booking-lock";

export default {
  fetch: () => new Response("Not found.", { status: 404 }),
};
