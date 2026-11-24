export { cn } from "cn";

/**
 * Resistance past an edge. The further past, the less each pixel of pull
 * moves the thing being pulled, so it never gets far and never stops dead:
 * things in the real world slow down before they stop. `over` is the raw
 * pull, `dim` the size of the thing, `c` how firm the resistance is. Used by
 * the lightbox's swipe past the ends of a sequence and by the filmstrip
 * past its last frame.
 */
export const rubberband = (over: number, dim: number, c = 0.55) =>
  (over * dim * c) / (dim + c * Math.abs(over));



/** The default sort order for strings (UTF-16 code units), spelled out. Not `localeCompare`: that reorders case and accents. */
export const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** A `useSyncExternalStore` subscribe for a value that never changes after hydration: the server snapshot first, the client one after. */
export const noSubscribe = () => () => {};

/** Two digits, zero-padded: 7 is "07". */
export const pad = (n: number) => String(n).padStart(2, "0");

/** Lowercase hex SHA-256 of the text's UTF-8 bytes. crypto.subtle, so it runs in Workers, browsers and Node. */
export async function sha256Hex(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** 16 base62 characters from the platform's CSPRNG (rejection sampling keeps it uniform). Contract ids and older galleries' tokens; new galleries get `proofId`. */
export function newToken(): string {
  let out = "";
  while (out.length < 16) {
    for (const b of crypto.getRandomValues(new Uint8Array(24))) {
      if (b < 248 && out.length < 16) out += B62[b % 62];
    }
  }
  return out;
}

/**
 * The one email rule every form and route uses. Deliberately loose: the only
 * thing worth rejecting is what cannot be an address.
 * Nobody gets turned away, so a one-letter ending like a@b.c passes too.
 */
export const looksLikeEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** An address a server keeps: a string, at most 200 characters, that `looksLikeEmail` once trimmed. */
export const isEmail = (v: unknown): v is string => typeof v === "string" && v.length <= 200 && looksLikeEmail(v.trim());

/** sessionStorage that never throws (private mode, storage off, a sandboxed frame): null when it cannot read. */
export const sessionGet = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

/** sessionStorage that never throws: a write it cannot make is dropped. */
export const sessionSet = (key: string, value: string) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
};

/** An error's message, or the thrown value as text when it is not an Error. */
export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
