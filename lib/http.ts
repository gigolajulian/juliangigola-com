import { isRecord } from "./json";

/** Every API answer: never cached, never indexed. Route files may only export handlers, so the helper lives here. */
export const NO_STORE = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } as const;

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

/** A time someone else took first, on every booking route: 409 with `code: "taken"`, which the clients match. */
export const taken = () => json({ error: "That time was just taken. Pick another.", code: "taken" }, 409);

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

/** An upstream call failed: log it under `label`, answer 502 with `error` (a fixed line on public routes; admin routes pass `errorText(e)` through). */
export function upstreamError(label: string, e: unknown, error: string) {
  console.error(label, String(e));
  return json({ error }, 502);
}

/** The public-write limiter (`PUBLIC_WRITE_LIMIT`, five a minute per address and `kind`): the 429 to answer, or null to go on. */
export async function limited(limiter: { limit(o: { key: string }): Promise<{ success: boolean }> }, kind: string, request: Request) {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if ((await limiter.limit({ key: `${kind}:${ip}` })).success) return null;
  const res = json({ error: "Too many tries. Wait a minute." }, 429);
  // The limiter's window is a minute; a client or crawler told when may come back waits instead of hammering.
  res.headers.set("retry-after", "60");
  return res;
}

/** Past this a body is refused unread: the admin's largest JSON is a 4 MB invoice photo. Public routes pass less. */
export const BODY_MAX = 5_000_000;
/** A public route's JSON: a booking, a move, a deposit start. */
export const SMALL_BODY = 64 * 1024;

/** The body as text, read no further than `max` bytes: null past it, so a huge body never fills the isolate. */
export async function textOf(request: Request, max: number): Promise<string | null> {
  if (Number(request.headers.get("content-length")) > max) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    parts.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.byteLength;
  }
  return new TextDecoder().decode(all);
}

/**
 * The request body as an object, or null when it is not one or is over `max` bytes. `request.json()`
 * throws on a malformed body, and a throw out of a handler is the Worker's
 * generic 500 for a request that was simply wrong.
 */
export async function bodyOf(request: Request, max = BODY_MAX): Promise<Record<string, unknown> | null> {
  try {
    const text = await textOf(request, max);
    if (text === null) return null;
    const b: unknown = JSON.parse(text);
    return isRecord(b) ? b : null;
  } catch {
    return null;
  }
}

/** A public client's answer from one of our routes: the body when it is ok, else the route's `{ error, code }` and the
    status. Status 0 is no answer at all (offline). It never throws, so every client reads a failure the same way. */
export type Reply<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error?: string; code?: string };

async function reply<T>(sent: Promise<Response>): Promise<Reply<T>> {
  let res: Response;
  try {
    res = await sent;
  } catch {
    return { ok: false, status: 0 };
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) return { ok: true, status: res.status, data: body as T };
  const b = isRecord(body) ? body : {};
  return {
    ok: false,
    status: res.status,
    error: typeof b.error === "string" ? b.error : undefined,
    code: typeof b.code === "string" ? b.code : undefined,
  };
}

export const getJson = <T>(url: string, init?: RequestInit) => reply<T>(fetch(url, init));

export const postJson = <T>(url: string, body: unknown, method: "POST" | "PATCH" = "POST") =>
  reply<T>(fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
