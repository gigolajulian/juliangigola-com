/** Spring's graduation year for the v4 home (spec 3.4): this year from January
    to May, next year from June on, in Pacific time. */
export const gradYear = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "numeric" }).formatToParts(now);
  const get = (t: "year" | "month") => Number(parts.find((p) => p.type === t)!.value);
  return get("month") >= 6 ? get("year") + 1 : get("year");
};
