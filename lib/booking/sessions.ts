/**
 * What someone can book, and what it costs.
 *
 * `from` stays null until a price is set in /admin (`content/site.json`);
 * null renders as "On request".
 */

import { CONTENT } from "../content";
import type { SessionType } from "../content";

export type { SessionType };

export const SESSION_TYPES: SessionType[] = CONTENT.sessions;

export const formatPrice = (from: number | null): string =>
  from === null ? "On request" : `From $${from.toLocaleString("en-US")}`;
