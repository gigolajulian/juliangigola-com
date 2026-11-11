/* Galleries that live on their booking page (`pageRedirects` in next.config.ts).
   Linked straight there: through the redirect, the router's prefetch lost its
   RSC headers and logged a 404 on every homepage load (audit 2026-11-11). */
const MOVED: Record<string, string> = { headshots: "/headshots#work", graduation: "/graduation-photos#work" };

/** Where a project or gallery opens. */
export const projectHref = (slug?: string) => (slug && MOVED[slug]) || `/portfolio/${slug}`;
