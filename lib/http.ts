import { isRecord } from "./json";

/** Every API answer: never cached, never indexed. Route files may only export handlers, so the helper lives here. */
export const NO_STORE = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } as const;

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

/** An upstream answered with an error status (Stripe, Google): the status rides on the error, read back with `statusOf`. */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** The upstream status a thrown error carries, or undefined for any other failure (a network error, a bug). */
export const statusOf = (e: unknown) => (e instanceof HttpError ? e.status : undefined);

/** An upstream call failed: log it under `label`, answer 502 with `error`. */
export function upstreamError(label: string, e: unknown, error: string) {
  console.error(label, String(e));
  return json({ error }, 502);
}

/** The public-write limiter (`DEPOSIT_LIMIT`, five a minute per address and `kind`): the 429 to answer, or null to go on. */
export async function limited(limiter: { limit(o: { key: string }): Promise<{ success: boolean }> }, kind: string, request: Request) {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  return (await limiter.limit({ key: `${kind}:${ip}` })).success ? null : json({ error: "Too many tries. Wait a minute." }, 429);
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
