/** Parses stored JSON (KV, a file); missing or malformed gives `fallback`, never a throw. */
export function parseOr<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
