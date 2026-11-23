/** Parses stored JSON (KV, a file); missing or malformed gives `fallback`, never a throw. */
export function parseOr<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** A plain object, not null and not an array: what a parsed JSON body or record has to be before its fields are read. */
export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
