/** A frame's place on /portfolio as a URL hash: "/work/events/01.jpg" is
 *  "work-events-01". The homepage's Commissions table links to it. */
export const frameHash = (src: string) =>
  src.replace(/^\//, "").replace(/\.[a-z]+$/i, "").replace(/[^a-z0-9]+/gi, "-");
