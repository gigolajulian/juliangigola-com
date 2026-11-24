export { cn } from "cn";

/** The default sort order for strings (UTF-16 code units), spelled out. Not `localeCompare`: that reorders case and accents. */
export const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** A `useSyncExternalStore` subscribe for a value that never changes after hydration: the server snapshot first, the client one after. */
export const noSubscribe = () => () => {};

/** Two digits, zero-padded: 7 is "07". */
export const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The one email rule every form and route uses. Deliberately loose: the only
 * thing worth rejecting is what cannot be an address.
 * Nobody gets turned away, so a one-letter ending like a@b.c passes too.
 */
export const looksLikeEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** An address a server keeps: at most 200 characters, and `looksLikeEmail` once trimmed. Check `typeof` first on unknown input. */
export const isEmail = (v: string): boolean => v.length <= 200 && looksLikeEmail(v.trim());

/** An error's message, or the thrown value as text when it is not an Error. */
export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** A `.catch` handler that logs the labels and the error as text, then gives undefined. */
export const logged =
  (...label: string[]) =>
  (e: unknown) => (console.error(...label, String(e)), undefined);
