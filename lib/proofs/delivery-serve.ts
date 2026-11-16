/* ── delivery downloads, outside Next ──────────────────────────────
 * Save (`/delivery/<id>/dl/<fid>`), Save for web (`/web/<fid>`) and Download all (`/delivery/<id>/zip`)
 * are answered by `worker.ts` before OpenNext: its wrapper copies every
 * response body into a plain stream, which drops the length (phones show
 * no progress) and enqueues without backpressure (a multi-GB zip would
 * queue in memory). So nothing here may import `@opennextjs/cloudflare`.
 * The Next routes call the same functions, for `next dev`.
 * ─────────────────────────────────────────────────────────────── */

import { sealer } from "@/lib/leads/lead-crypto";
import { finalKey, PREVIEW_W, THUMB_W, isFrameId, isStrongId, isToken, readPublic, shotOrder, shut, type Proof } from "@/lib/proofs/proof";
import { uniqueNames, zipLayout } from "@/lib/zip";

declare global {
  /** Workers' own stream with a known length (R2 and a Content-Length need it). Not in this project's DOM types; Workers only, not `next dev`. */
  class FixedLengthStream extends TransformStream<Uint8Array, Uint8Array> {
    constructor(length: number);
  }
}

type Env = Pick<CloudflareEnv, "INBOX" | "PROOFS" | "IMAGES" | "LEADS_KEY" | "DOWNLOAD_LIMIT">;

/**
 * The gallery a delivery link opens, or null. By its public id only, and only a strong one (Send finals moves an old
 * Nov 11 id to a shoot id). Before Send finals Julian can look at it, as with proofs; after, it closes with the gallery.
 */
export async function deliveryIn(env: Env, id: string, cookie: string | null) {
  const seal = sealer(env.LEADS_KEY);
  if (!isToken(id) || !isStrongId(id) || !env.INBOX || !env.PROOFS || !seal) return { shut: "closed" as const };
  const s = await seal;
  const p = await readPublic(env.INBOX, s, id);
  if (!p?.finals?.length) return { shut: "closed" as const };
  // Offline and the password hold before Send finals too; only the clock waits for it.
  const why = await shut(p, cookie, env.LEADS_KEY);
  if (why === "offline" || why === "locked" || (why === "closed" && p.deliveredAt)) return { shut: why, p };
  return { s, p };
}
/** `deliveryIn` for the routes that only serve: null whatever the reason. */
export async function openDeliveryIn(env: Env, id: string, cookie: string | null) {
  const g = await deliveryIn(env, id, cookie);
  return "shut" in g ? null : g;
}

export const finalOf = (p: Proof, id: string) => p.finals?.find((f) => f.id === id);

/** A download header: an ASCII fallback name and the real one. */
export const attachment = (name: string) => `attachment; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`;

const PRIVATE = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" };
const notFound = () => new Response("Not found", { status: 404 });

async function limited(env: Env, request: Request) {
  const ok = (await env.DOWNLOAD_LIMIT.limit({ key: request.headers.get("cf-connecting-ip") ?? "unknown" })).success;
  return ok ? null : new Response("Too many downloads. Wait a minute.", { status: 429, headers: { "retry-after": "60" } });
}

/** One final, full size, as a download. R2's body knows its length. */
export async function finalResponse(request: Request, env: Env, id: string, fid: string) {
  const g = isFrameId(fid) ? await openDeliveryIn(env, id, request.headers.get("cookie")) : null;
  const f = g && finalOf(g.p, fid);
  if (!g || !f) return notFound();
  const busy = await limited(env, request);
  if (busy) return busy;
  const o = await env.PROOFS.get(finalKey(g.p.token, fid));
  if (!o) return notFound();
  return new Response(o.body, { headers: { "content-type": "image/jpeg", "content-length": String(o.size), "content-disposition": attachment(f.file), ...PRIVATE } });
}

/** The 2000px and 800px copies, made once by Cloudflare Images and kept in R2. */
export async function previews(env: Pick<Env, "PROOFS" | "IMAGES">, token: string, id: string) {
  const full = await env.PROOFS.get(finalKey(token, id));
  if (!full) return null;
  const big = await (await env.IMAGES.input(full.body).transform({ width: PREVIEW_W, fit: "scale-down" }).output({ format: "image/jpeg", quality: 85 })).response().arrayBuffer();
  await env.PROOFS.put(finalKey(token, id, PREVIEW_W), big, { httpMetadata: { contentType: "image/jpeg" } });
  const small = await (await env.IMAGES.input(new Response(big).body!).transform({ width: THUMB_W, fit: "scale-down" }).output({ format: "image/jpeg", quality: 82 })).response().arrayBuffer();
  await env.PROOFS.put(finalKey(token, id, THUMB_W), small, { httpMetadata: { contentType: "image/jpeg" } });
  return true;
}

/** A web copy of a final, made now if the upload could not. Never the full file. */
export async function servedPreview(env: Pick<Env, "PROOFS" | "IMAGES">, token: string, id: string, small: boolean) {
  const key = finalKey(token, id, small ? THUMB_W : PREVIEW_W);
  const kept = (await env.PROOFS.get(key)) ?? ((await previews(env, token, id)) && (await env.PROOFS.get(key)));
  return kept || null;
}

/** "Save for web" (Julian 2026-11-15): the 2000px copy the lightbox shows, as `<file> web.jpg`, with its length. */
export async function webResponse(request: Request, env: Env, id: string, fid: string) {
  const g = isFrameId(fid) ? await openDeliveryIn(env, id, request.headers.get("cookie")) : null;
  const f = g && finalOf(g.p, fid);
  if (!g || !f) return notFound();
  const busy = await limited(env, request);
  if (busy) return busy;
  const o = await servedPreview(env, g.p.token, fid, false).catch(() => undefined);
  if (o === undefined) return new Response("Try again shortly", { status: 503, headers: { "retry-after": "5" } });
  if (!o) return notFound();
  return new Response(o.body, { headers: { "content-type": "image/jpeg", "content-length": String(o.size), "content-disposition": attachment(webName(f.file)), ...PRIVATE } });
}
export const webName = (file: string) => `${file.replace(/\.[a-z0-9]+$/i, "")} web.jpg`;

/* Download all: every final in one stored zip, streamed from R2 with its exact length. Sizes and CRCs were
   recorded at upload, so the Worker only pipes bytes. A file that changed since is a broken download, never a wrong one. */
export async function zipResponse(request: Request, env: Env, id: string) {
  const g = await openDeliveryIn(env, id, request.headers.get("cookie"));
  if (!g) return notFound();
  const busy = await limited(env, request);
  if (busy) return busy;
  const finals = shotOrder(g.p.finals ?? []);
  const names = uniqueNames(finals.map((f) => f.file));
  const z = zipLayout(finals.map((f, i) => ({ name: names[i], size: f.bytes, crc: f.crc })));
  const out = new FixedLengthStream(z.total);
  const pump = async () => {
    for (const [i, f] of finals.entries()) {
      const w = out.writable.getWriter();
      await w.write(z.locals[i]);
      w.releaseLock();
      const o = await env.PROOFS.get(finalKey(g.p.token, f.id));
      if (!o || o.size !== f.bytes) throw new Error(`final ${f.id} missing or changed`);
      await o.body.pipeTo(out.writable, { preventClose: true });
    }
    const w = out.writable.getWriter();
    await w.write(z.tail);
    await w.close();
  };
  pump().catch((e) => {
    console.error("delivery zip", id, String(e)); // the id, never the gallery's access key
    out.writable.abort(e).catch(() => undefined);
  });
  const day = id.slice(0, 8);
  return new Response(out.readable, {
    headers: { "content-type": "application/zip", "content-length": String(z.total), "content-disposition": attachment(`Julian Gigola ${day.slice(0, 2)}-${day.slice(2, 4)}-${day.slice(4)}.zip`), ...PRIVATE },
  });
}

const DOWNLOAD = /^\/delivery\/([^/]+)\/(?:zip|(dl|web)\/([^/]+))\/?$/;

/** The worker entry's hook: a download response for these three paths, or null for Next. */
export function deliveryDownload(request: Request, env: Env) {
  if (request.method !== "GET") return null;
  const m = DOWNLOAD.exec(new URL(request.url).pathname);
  if (!m) return null;
  let id: string, fid: string | undefined;
  try {
    id = decodeURIComponent(m[1]);
    fid = m[3] === undefined ? undefined : decodeURIComponent(m[3]);
  } catch {
    return Promise.resolve(new Response("Not found", { status: 404 })); // a broken %-escape is a bad link, not a server error
  }
  return fid === undefined ? zipResponse(request, env, id) : m[2] === "web" ? webResponse(request, env, id, fid) : finalResponse(request, env, id, fid);
}
