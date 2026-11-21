/* ── deliveries ───────────────────────────────────────────────────
 * The proof gallery becomes the delivery. Lightroom's
 * Delivery service publishes full-size JPEGs (quality 100, no watermark)
 * into the same gallery; Send finals mails /delivery/<id>, open 60 days.
 * Finals live in `jg-proofs` under `delivery/<token>/`, with a 2000px and
 * an 800px copy made at upload, so the page never loads a full file.
 * ─────────────────────────────────────────────────────────────── */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { openDeliveryIn, previews } from "@/lib/proofs/delivery-serve";
export { servedPreview } from "@/lib/proofs/delivery-serve";
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
  // A republished edit must not keep the old copies, so a failure drops them.
  await previews(env, token, id).catch(() => env.PROOFS.delete([finalKey(token, id, PREVIEW_W), finalKey(token, id, THUMB_W)]).catch(() => undefined));
  return { bytes, crc };
}

/** `openDeliveryIn` with the request's own bindings, for Next's pages and routes. `cookie` is the request's Cookie header (the gate's password). */
export async function openDelivery(id: string, cookie: string | null) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const g = await openDeliveryIn(env, id, cookie);
  return g && { env, ctx, ...g };
}
