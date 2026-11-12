/* ── deliveries ───────────────────────────────────────────────────
 * Julian (2026-11-12): the proof gallery becomes the delivery. Lightroom's
 * Delivery service publishes full-size JPEGs (quality 100, no watermark)
 * into the same gallery; Send finals mails /delivery/<id>, open 60 days.
 * Finals live in `jg-proofs` under `delivery/<token>/`, with a 2000px and
 * an 800px copy made at upload, so the page never loads a full file.
 * ─────────────────────────────────────────────────────────────── */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { openDeliveryIn } from "@/lib/proofs/delivery-serve";
import { crc32 } from "@/lib/zip";
import { finalKey, PREVIEW_W, THUMB_W } from "@/lib/proofs/proof";

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

/** `openDeliveryIn` with the request's own bindings, for Next's pages and routes. */
export async function openDelivery(id: string) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const g = await openDeliveryIn(env, id);
  return g && { env, ctx, ...g };
}
