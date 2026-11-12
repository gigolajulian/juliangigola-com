/* ── deliveries ───────────────────────────────────────────────────
 * Julian (2026-11-12): the proof gallery becomes the delivery. Lightroom's
 * Delivery service publishes full-size JPEGs (quality 100, no watermark)
 * into the same gallery; Send finals mails /delivery/<id>, open 60 days.
 * Finals live in `jg-proofs` under `delivery/<token>/`, with a 2000px and
 * an 800px copy made at upload, so the page never loads a full file.
 * ─────────────────────────────────────────────────────────────── */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sealer } from "@/lib/leads/lead-crypto";
import { crc32 } from "@/lib/zip";
import { finalKey, isOpen, isStrongId, isToken, PREVIEW_W, readPublic, THUMB_W, type Proof } from "@/lib/proofs/proof";

declare global {
  /** Workers' own stream with a known length (R2 and a Content-Length need it). Not in this project's DOM types; Workers only, not `next dev`. */
  class FixedLengthStream extends TransformStream<Uint8Array, Uint8Array> {
    constructor(length: number);
  }
}

/** Under Cloudflare's 100 MB request body cap. A 61 MP JPEG at quality 100 is about 40-60 MB. */
export const MAX_FINAL = 95 * 1024 * 1024;

type Env = Pick<CloudflareEnv, "PROOFS" | "IMAGES">;

/** Streams one final into R2, counting its bytes and CRC on the way: the Worker never holds the file. */
export async function storeFinal(env: Env, token: string, id: string, body: ReadableStream<Uint8Array>, length: number) {
  let crc = 0, bytes = 0;
  const count = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, out) {
      crc = crc32(chunk, crc);
      bytes += chunk.length;
      out.enqueue(chunk);
    },
  });
  // R2 needs the length of a streamed body up front.
  const fixed = new FixedLengthStream(length);
  const piped = body.pipeThrough(count).pipeTo(fixed.writable);
  await Promise.all([env.PROOFS.put(finalKey(token, id), fixed.readable, { httpMetadata: { contentType: "image/jpeg" } }), piped]);
  // The web copies are a nicety at upload: if Images fails here, the page makes them on first view.
  await previews(env, token, id).catch(() => undefined);
  return { bytes, crc };
}

/** The 2000px and 800px copies, made once by Cloudflare Images and kept in R2. */
async function previews(env: Env, token: string, id: string) {
  const full = await env.PROOFS.get(finalKey(token, id));
  if (!full) return null;
  const big = await (await env.IMAGES.input(full.body).transform({ width: PREVIEW_W, fit: "scale-down" }).output({ format: "image/jpeg", quality: 85 })).response().arrayBuffer();
  await env.PROOFS.put(finalKey(token, id, PREVIEW_W), big, { httpMetadata: { contentType: "image/jpeg" } });
  const small = await (await env.IMAGES.input(new Response(big).body!).transform({ width: THUMB_W, fit: "scale-down" }).output({ format: "image/jpeg", quality: 82 })).response().arrayBuffer();
  await env.PROOFS.put(finalKey(token, id, THUMB_W), small, { httpMetadata: { contentType: "image/jpeg" } });
  return true;
}

/** A web copy of a final, made now if the upload could not. Never the full file. */
export async function servedPreview(env: Env, token: string, id: string, small: boolean) {
  const key = finalKey(token, id, small ? THUMB_W : PREVIEW_W);
  const kept = (await env.PROOFS.get(key)) ?? ((await previews(env, token, id)) && (await env.PROOFS.get(key)));
  return kept || null;
}

/**
 * The gallery a delivery link opens, or null. By its public id only, and only a strong one (Send finals moves an old
 * Nov 11 id to a shoot id). Before Send finals Julian can look at it, as with proofs; after, it closes with the gallery.
 */
export async function openDelivery(id: string) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const seal = sealer(env.LEADS_KEY);
  if (!isToken(id) || !isStrongId(id) || !env.INBOX || !env.PROOFS || !seal) return null;
  const s = await seal;
  const p = await readPublic(env.INBOX, s, id);
  if (!p?.finals?.length || (p.deliveredAt && !isOpen(p))) return null;
  return { env, ctx, s, p };
}

export const finalOf = (p: Proof, id: string) => p.finals?.find((f) => f.id === id);

/** A download header: an ASCII fallback name and the real one. */
export const attachment = (name: string) => `attachment; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`;
