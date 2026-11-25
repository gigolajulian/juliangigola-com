import { bodyIn, createGallery, dropFiles, gated, oneGallery, param, saveSettings } from "@/lib/proofs/desk-api";

/* /api/proof/gallery: one gallery for the desk.
 *   GET    ?token=X                  the gallery in full, selects included
 *   POST   {name, email}             a new gallery, answers token + url
 *   PATCH  {token, ...settings}      its settings and password
 *   DELETE ?token=X                  the gallery and its web copies (refused while it holds finals) */

export const dynamic = "force-dynamic";

export const GET = gated(async (g, request) => oneGallery(g, param(request, "token")));

export const POST = gated(async (g, request) => createGallery(g, await bodyIn(request)));

export const PATCH = gated(async (g, request) => saveSettings(g, await bodyIn(request)));

export const DELETE = gated(async (g, request) => dropFiles(g, { token: param(request, "token"), ids: null, final: false }));
