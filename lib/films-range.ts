/* ── byte ranges for the site's own films, outside Next ─────────────
 * Workers Static Assets answer a Range request with the whole file (200, no
 * Content-Range), and Safari will not play or seek an MP4 without ranges
 * (Cloudflare's static-assets limits page says the same). Its fix,
 * `run_worker_first`, makes OpenNext demand `html_handling: "none"`, which
 * would drop /client/prdx-preview/. So the home plays films from /stream/<file>:
 * no asset sits there, the Worker answers, reads public/films/<file> through
 * ASSETS and serves the bytes asked for. `next.config.ts` rewrites /stream for
 * `next dev`. `worker.ts` asks here before OpenNext.
 * ─────────────────────────────────────────────────────────────── */

type Env = { ASSETS?: { fetch: (req: Request) => Promise<Response> } };

/** The one range a `Range` header asks for, clamped to the file; "bad" when it can't be met; null for the whole file. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | "bad" | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null; // several ranges or junk: the whole file is a valid answer
  if (m[1] === "") {
    const n = Math.min(+m[2], size);
    return n > 0 ? { start: size - n, end: size - 1 } : "bad";
  }
  const start = +m[1];
  const end = m[2] === "" ? size - 1 : Math.min(+m[2], size - 1);
  return start < size && start <= end ? { start, end } : "bad";
}

export async function filmRange(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const file = /^\/stream\/([a-z0-9-]+\.mp4)$/.exec(url.pathname)?.[1];
  if (!env.ASSETS || !file || (request.method !== "GET" && request.method !== "HEAD")) return null;
  const src = new URL(`/films/${file}`, url);
  const range = request.headers.get("range");
  // no range: let a cached copy revalidate (304) as it did when assets answered directly
  const etag = range ? null : request.headers.get("if-none-match");
  const res = await env.ASSETS.fetch(new Request(src.toString(), { headers: etag ? { "if-none-match": etag } : {} }));
  if (res.status !== 200) return res;
  const headers = new Headers(res.headers);
  headers.set("accept-ranges", "bytes");
  const head = request.method === "HEAD";
  if (!range) {
    if (head) res.body?.cancel();
    return new Response(head ? null : res.body, { status: 200, headers });
  }
  // shortcut: the ASSETS response carries no length, so the file is read whole (23 MB, well inside the 128 MB a
  // Worker has); a size cache keyed by ETag would let later ranges stream if a film ever grows past ~60 MB
  const buf = await res.arrayBuffer();
  headers.delete("content-length"); // the body below sets its own
  const r = parseRange(range, buf.byteLength);
  if (!r) return new Response(buf, { status: 200, headers });
  if (r === "bad") {
    headers.set("content-range", `bytes */${buf.byteLength}`);
    return new Response(null, { status: 416, headers });
  }
  headers.set("content-range", `bytes ${r.start}-${r.end}/${buf.byteLength}`);
  if (head) headers.set("content-length", String(r.end - r.start + 1));
  return new Response(head ? null : buf.slice(r.start, r.end + 1), { status: 206, headers });
}
