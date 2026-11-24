/* Julian's time zone, where the sessions are. Booking, leads, contracts and
 * mail all read it from here. No imports: `scripts/check-inbox.mjs` runs the
 * enquiry model, which uses `whenPT`, in plain Node. */

export const TZ = "America/Los_Angeles";

/** One day and one week in milliseconds. */
export const DAY_MS = 864e5;
export const WEEK_MS = 7 * DAY_MS;

/** An en-US date format in Julian's time, with the given parts. */
export const pacificFormat = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...o });

/** When, in Julian's time, because that is where the sessions are. */
export const whenPT = (iso?: string) => {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(+d)
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(d)
    : "";
};
