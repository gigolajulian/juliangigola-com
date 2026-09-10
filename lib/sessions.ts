/**
 * What someone can book, and what it costs.
 *
 * The old site had a /rates page that never got written — it still shipped
 * the Format demo's bio — so a visitor pricing a shoot had no way to find out
 * anything without emailing first. That is the single biggest drop-off on a
 * consumer-facing photography site.
 *
 * `from` is deliberately `null` until Julian fills it in rather than carrying
 * an invented number: a wrong price is worse than no price. Anything still
 * null renders as "On request", which is honest and keeps the page shippable
 * today. The prices live in `content/site.json` and are set in `/admin`.
 *
 * Each entry points at a real category in the archive, so the sample work is
 * always his actual work and never goes stale.
 */

import { CONTENT } from "./content";
import type { SessionType } from "./content";

export type { SessionType };

export const SESSION_TYPES: SessionType[] = CONTENT.sessions;

export const formatPrice = (from: number | null): string =>
  from === null ? "On request" : `From $${from.toLocaleString("en-US")}`;
