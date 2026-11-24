/** Parses stored JSON (KV, a file); missing or malformed gives `fallback`, never a throw. */
export function parseOr<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Build-time checks for a JSON content file. `fail` throws naming the file and the field, so a bad field fails the
 * deploy; `str` is a non-empty string. Values come from parsed JSON, so `JSON.stringify` only gives undefined for a
 * missing field, printed as its typeof ("undefined").
 */
export function contentChecks(file: string) {
  const fail = (path: string, wanted: string, got: unknown): never => {
    throw new Error(`${file}: ${path} should be ${wanted}, got ${JSON.stringify(got) ?? typeof got}`);
  };
  /** A non-empty string. Blank fields are a mistake, not a value. */
  const str = (v: unknown, path: string): string =>
    typeof v === "string" && v.trim() !== "" ? v : fail(path, "a non-empty string", v);
  return { fail, str };
}

/** A plain object, not null and not an array: what a parsed JSON body or record has to be before its fields are read. */
export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** `v` when it is a record, else an empty one: fields of anything else read as missing. */
export const asRecord = (v: unknown): Record<string, unknown> => (isRecord(v) ? v : {});
