/** Every API answer: never cached, never indexed. Route files may only export handlers, so the helper lives here. */
export const NO_STORE = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } as const;

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

/**
 * The request body as an object, or null when it is not one. `request.json()`
 * throws on a malformed body, and a throw out of a handler is the Worker's
 * generic 500 for a request that was simply wrong.
 */
export async function bodyOf(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const b: unknown = await request.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
