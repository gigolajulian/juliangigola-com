/* ── proof watermark ──────────────────────────────────────────────
 * Julian (2026-11-10): "use Julian Gigola wordmark on bottom third". The
 * mark is baked into the bytes, never a CSS overlay: frames are served
 * without the email gate, so an overlay would protect nothing. Cloudflare
 * Images draws it once per frame; the result is kept in R2 at `markedKey`
 * beside the clean original, which stays untouched for finals. Turning the
 * option on covers frames already uploaded: each is baked on its first fetch.
 * ─────────────────────────────────────────────────────────────── */

import { cardKey, coverFrame, frameKey, markedKey, type Proof } from "@/lib/proofs";

/** White Inter Tight 900, rendered at 1600px so it stays sharp on a 2000px frame. */
export const MARK = { src: "/proof-mark.png", w: 1600, h: 274, opacity: 0.5 } as const;

/** Where the wordmark sits: centered across, centered in the bottom third, 60% of the frame's short side wide. */
export function markBox(w: number, h: number) {
  const width = Math.round(Math.min(w, h) * 0.6);
  const height = Math.round((width * MARK.h) / MARK.w);
  return { width, left: Math.round((w - width) / 2), top: Math.round((h * 5) / 6 - height / 2) };
}

type Env = Pick<CloudflareEnv, "PROOFS" | "IMAGES" | "ASSETS">;
const stream = (b: ArrayBuffer) => new Response(b).body!;
const asset = async (env: Env, src: string, origin: string) => {
  const r = await env.ASSETS.fetch(new URL(src, origin));
  if (!r.ok || !r.body) throw new Error(`${src} missing.`);
  return r.body;
};

/** The wordmark drawn into one JPEG. Throws if Images or the mark is unavailable: never fall back to the clean frame. */
export async function bake(env: Env, jpeg: ArrayBuffer, origin: string): Promise<ArrayBuffer> {
  const { width, height } = await env.IMAGES.info(stream(jpeg));
  const box = markBox(width, height);
  const mark = await asset(env, MARK.src, origin);
  const out = await env.IMAGES.input(stream(jpeg))
    .draw(env.IMAGES.input(mark).transform({ width: box.width }), { opacity: MARK.opacity, left: box.left, top: box.top })
    .output({ format: "image/jpeg", quality: 90 });
  return out.response().arrayBuffer();
}

/** One frame as the client may see it: clean, or with the mark (baked on first fetch, then read from R2). */
export async function servedFrame(env: Env, p: Pick<Proof, "token" | "watermark">, id: string, origin: string): Promise<{ body: ReadableStream; etag: string } | null> {
  if (p.watermark) {
    const kept = await env.PROOFS.get(markedKey(p.token, id));
    if (kept) return { body: kept.body, etag: kept.httpEtag };
  }
  const clean = await env.PROOFS.get(frameKey(p.token, id));
  if (!clean) return null;
  if (!p.watermark) return { body: clean.body, etag: clean.httpEtag };
  const bytes = await bake(env, await clean.arrayBuffer(), origin);
  const put = await env.PROOFS.put(markedKey(p.token, id), bytes, { httpMetadata: { contentType: "image/jpeg" } });
  return { body: stream(bytes), etag: put.httpEtag };
}

/* The link preview (Julian 2026-11-10: "create thumbnail automatically based off the photo and header of the page").
   The site's share-card layout at 1800x945: `public/proof-card.png` holds the dark panel with the gallery's header
   ("Proofs", "Pick your proofs.") and the wordmark; the first frame fills the right, with the mark in its bottom third. */
export const CARD = { src: "/proof-card.png", w: 1800, h: 945, photoLeft: 600 } as const;

/** The gallery's card, drawn once per first frame and kept in R2. Null when the gallery has no card (watermark off, closed, empty). */
export async function shareCard(env: Env, p: Pick<Proof, "token" | "watermark" | "closesAt" | "frames" | "card">, origin: string): Promise<{ body: ReadableStream; etag: string } | null> {
  const f = coverFrame(p);
  if (!f) return null;
  const kept = await env.PROOFS.get(cardKey(p.token, f.id));
  if (kept) return { body: kept.body, etag: kept.httpEtag };
  const clean = await env.PROOFS.get(frameKey(p.token, f.id));
  if (!clean) return null;
  const pw = CARD.w - CARD.photoLeft, box = markBox(pw, CARD.h);
  const [panel, mark] = await Promise.all([asset(env, CARD.src, origin), asset(env, MARK.src, origin)]);
  // Julian's crop when he picked one for this frame, else Images' own subject crop.
  const c = p.card?.id === f.id ? p.card : null;
  const photo = c
    ? env.IMAGES.input(clean.body).transform({ trim: { left: c.x, top: c.y, width: c.w, height: Math.round((c.w * CARD.h) / pw) } }).transform({ width: pw, height: CARD.h, fit: "cover" })
    : env.IMAGES.input(clean.body).transform({ width: pw, height: CARD.h, fit: "cover", gravity: "auto" });
  const out = await env.IMAGES.input(panel)
    .draw(photo, { left: CARD.photoLeft, top: 0 })
    .draw(env.IMAGES.input(mark).transform({ width: box.width }), { opacity: MARK.opacity, left: CARD.photoLeft + box.left, top: box.top })
    .output({ format: "image/jpeg", quality: 86 });
  const bytes = await out.response().arrayBuffer();
  const put = await env.PROOFS.put(cardKey(p.token, f.id), bytes, { httpMetadata: { contentType: "image/jpeg" } });
  return { body: stream(bytes), etag: put.httpEtag };
}
