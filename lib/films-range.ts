/* ── byte ranges for /films/*.mp4, outside Next ─────────────────────
 * Workers Static Assets answer a Range request with the whole file (200, no
 * Content-Range), and Safari will not play or seek an MP4 without ranges
 * (Cloudflare's static-assets limits page says the same). `wrangler.jsonc`
 * sends /films/* to the Worker first; `worker.ts` asks here before OpenNext.
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

/** Bytes start..end (inclusive) of a stream, read through once and dropped as they pass. */
export function sliceStream(body: ReadableStream<Uint8Array>, start: number, end: number): ReadableStream<Uint8Array> {
  let at = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, out) {
        const from = Math.max(start - at, 0);
        const to = Math.min(end + 1 - at, chunk.length);
        at += chunk.length;
        if (to > from) out.enqueue(chunk.subarray(from, to));
        if (at > end) out.terminate();
      },
    }),
  );
}

export async function filmRange(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (!env.ASSETS || !url.pathname.startsWith("/films/") || (request.method !== "GET" && request.method !== "HEAD")) return null;
  const range = request.headers.get("range");
  // no range: let a cached copy revalidate (304) as it did when assets answered directly
  const etag = range ? null : request.headers.get("if-none-match");
  const res = await env.ASSETS.fetch(new Request(url.toString(), { method: request.method, headers: etag ? { "if-none-match": etag } : {} }));
  if (res.status !== 200) return res;
  const size = Number(res.headers.get("content-length"));
  const headers = new Headers(res.headers);
  headers.set("accept-ranges", "bytes");
  const r = Number.isFinite(size) && size > 0 ? parseRange(range, size) : null;
  if (!r) return new Response(res.body, { status: 200, headers });
  if (r === "bad" || request.method === "HEAD") res.body?.cancel();
  if (r === "bad") {
    headers.set("content-range", `bytes */${size}`);
    headers.delete("content-length");
    return new Response(null, { status: 416, headers });
  }
  const len = r.end - r.start + 1;
  headers.set("content-range", `bytes ${r.start}-${r.end}/${size}`);
  headers.set("content-length", String(len));
  if (request.method === "HEAD") return new Response(null, { status: 206, headers });
  // FixedLengthStream (Workers) keeps Content-Length on the wire
  const part = sliceStream(res.body!, r.start, r.end);
  const body = typeof FixedLengthStream === "function" ? part.pipeThrough(new FixedLengthStream(len)) : part;
  return new Response(body, { status: 206, headers });
}
