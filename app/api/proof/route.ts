import { isToken } from "@/lib/proofs/proof-model";
import {
  bodyIn,
  createGallery,
  dropFiles,
  dropQuery,
  galleryAction,
  gated,
  listGalleries,
  oneGallery,
  previewMail,
  putFrame,
  remindPreview,
  saveSettings,
} from "@/lib/proofs/desk-api";

/* ── proofs, every job on one path ────────────────────────────────
 * Lightroom (the publish service) calls this; the /admin desk calls the
 * sub-routes (list, gallery, preview, remind, action). The gate and the
 * handlers live in `lib/proofs/desk-api.ts`.
 *
 *   GET    ?list                       every gallery
 *   GET    ?token=X                    one gallery in full, selects included
 *   GET    ?preview=X | ?remind=X      a mail as it would go out
 *   POST   {action:"create", ...}      new gallery, returns token + url
 *   POST   {action, token, ...}        send, deliver, remind, relink, forget, reopen, extend, pulled
 *   PATCH  {token, ...settings}        name, email, note, included, price, days, watermark
 *   PUT    ?token&id&file&w&h  <jpeg>  add or replace one frame
 *   PUT    ?token&id&...&final=1[&model=<label>&top=1] <jpeg> add or replace one final (Lightroom's Delivery service)
 *   DELETE ?token&id | &ids            drop frames
 *   DELETE ?token&ids&final=1          drop finals
 *   DELETE ?token                      drop the gallery and its frames
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export const GET = gated(async (g, request) => {
  const q = new URL(request.url).searchParams;
  if (q.has("list")) return listGalleries(g);
  const preview = q.get("preview"),
    remind = q.get("remind");
  if (isToken(preview)) return previewMail(g, preview);
  if (isToken(remind)) return remindPreview(g, remind);
  return oneGallery(g, q.get("token"));
});

export const POST = gated(async (g, request) => {
  const b = await bodyIn(request);
  return b.action === "create" ? createGallery(g, b) : galleryAction(g, b, request);
});

export const PATCH = gated(async (g, request) => saveSettings(g, await bodyIn(request)));

export const PUT = gated(putFrame);

export const DELETE = gated(async (g, request) => dropFiles(g, dropQuery(request)));
