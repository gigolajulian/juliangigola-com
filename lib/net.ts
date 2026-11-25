/* ── outbound calls ───────────────────────────────────────────────
 * Every call the server makes to another service goes through `outbound`:
 * - a timeout (8 s unless the caller says otherwise), joined to any signal
 *   the caller passes;
 * - calls that are safe to repeat (GET, HEAD, or `retry: true` for a write
 *   that carries an idempotency key) try twice more on a network error,
 *   a 429 or a 5xx, waiting 200 ms then 400 ms plus random jitter;
 * - a breaker per host: five failures in a row and the host is skipped
 *   for 30 s (`CircuitOpen`), so an outage is not hammered by every visitor.
 * Browser code (admin-call, the service worker) and Cloudflare bindings
 * (ASSETS, SITE, the booking lock's own stub) are not outbound calls.
 * ─────────────────────────────────────────────────────────────── */

export const TIMEOUT_MS = 8000;
const RETRIES = 2;
const BREAK_AFTER = 5;
const BREAK_MS = 30_000;
/** Backoff base; tests set it to 0 so a retry costs no wall time. */
export const net = { baseMs: 200 };

/** A host that failed BREAK_AFTER times in a row, skipped until it cools down. */
export class CircuitOpen extends Error {}

const hosts = new Map<string, { fails: number; until: number }>();
/** Forgets every host's failures (tests). */
export const resetBreakers = () => hosts.clear();

type Init = RequestInit & { timeoutMs?: number; retry?: boolean };
type Fetcher = (url: string | URL, init: RequestInit) => Promise<Response>;

const wait = (ms: number) => (ms > 0 ? new Promise((go) => setTimeout(go, ms)) : Promise.resolve());

function failed(host: string, now: number) {
  const h = hosts.get(host) ?? { fails: 0, until: 0 };
  h.fails++;
  if (h.fails >= BREAK_AFTER) {
    h.until = now + BREAK_MS;
    h.fails = 0;
  }
  hosts.set(host, h);
}

/** `fetch` with a timeout, retries on safe calls and a breaker per host. `via` swaps the transport (a binding's stub). */
export async function outbound(url: string | URL, init: Init = {}, via: Fetcher = (u, i) => fetch(u, i)): Promise<Response> {
  const { timeoutMs = TIMEOUT_MS, retry, ...rest } = init;
  const host = new URL(url).host;
  const shut = hosts.get(host);
  if (shut && shut.until > Date.now()) throw new CircuitOpen(`${host} failed ${BREAK_AFTER} times in a row; paused`);
  const method = (rest.method ?? "GET").toUpperCase();
  const tries = (retry ?? (method === "GET" || method === "HEAD")) ? RETRIES + 1 : 1;
  for (let n = 1; ; n++) {
    const timer = AbortSignal.timeout(timeoutMs);
    const signal = rest.signal ? AbortSignal.any([rest.signal, timer]) : timer;
    try {
      const res = await via(url, { ...rest, signal });
      if (res.status < 500 && res.status !== 429) {
        hosts.delete(host);
        return res;
      }
      failed(host, Date.now());
      if (n >= tries) return res;
    } catch (e) {
      failed(host, Date.now());
      if (n >= tries || rest.signal?.aborted) throw e;
    }
    await wait(net.baseMs * 2 ** (n - 1) + Math.random() * net.baseMs);
  }
}
