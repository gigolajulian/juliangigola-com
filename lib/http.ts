import { isRecord } from "./json";

/** Every API answer: never cached, never indexed. Route files may only export handlers, so the helper lives here. */
export const NO_STORE = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } as const;

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

/** An upstream call failed: log it under `label`, answer 502 with `error`. */
export function upstreamError(label: string, e: unknown, error: string) {
  console.error(label, String(e));
  return json({ error }, 502);
}

/**
 * The request body as an object, or null when it is not one. `request.json()`
 * throws on a malformed body, and a throw out of a handler is the Worker's
 * generic 500 for a request that was simply wrong.
 */
export async function bodyOf(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const b: unknown = await request.json();
    return isRecord(b) ? b : null;
  } catch {
    return null;
  }
}
