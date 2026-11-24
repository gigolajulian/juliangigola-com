/* ── proofs, Julian's side: the gate and one handler per job ───────
 * Server only. `/api/proof` answers every job on one path for Lightroom
 * (the publish service): create, pulled, settings, frames, finals and
 * deletes. The /admin desk calls the sub-routes, one per job:
 *
 *   GET    /api/proof/list               every gallery, opened
 *   GET    /api/proof/gallery?token=X    one gallery in full, selects included
 *   POST   /api/proof/gallery {name, email, day?}  new gallery, returns token + url
 *   PATCH  /api/proof/gallery {token, ...settings}  name, email, note, included, price, days, watermark, password
 *   DELETE /api/proof/gallery?token=X    the gallery and its web copies
 *   GET    /api/proof/preview?token=X    the proof mail as it would go out
 *   GET    /api/proof/remind?token=X     the reminder as it would go out, with who gets it
 *   POST   /api/proof/action {action, token, ...}  send, deliver, remind, relink, forget, reopen, extend, pulled
 *
 * Both take the Inbox's credentials: the admin key header or a GitHub token
 * that can push to the repo. The client's side is `/api/proof/[token]`.
 * ─────────────────────────────────────────────────────────────── */

import { gate } from "@/lib/admin/gate";
import { copiesFor, dropProofOpens } from "@/lib/leads/lead-store";
import {
  cardKey,
  closesAt,
  cleanSettings,
  DEFAULTS,
  finalKeys,
  frameKey,
  frameKeys,
  aliasKey,
  isFrameId,
  isModel,
  isToken,
  proofKey,
  publicId,
  remindState,
  shootDay,
  viewerKey,
  type Proof,
} from "@/lib/proofs/proof-model";
import { isEmail, logged } from "@/lib/utils";
import { forDesk, hashPass, listProofs, nextProofId, readProof, writeProof } from "@/lib/proofs/proof-store";
import { deliveryUrl, proofMail, proofUrl, reminderMail, webImages } from "@/lib/proofs/proof-mail";
import { MAX_FINAL, storeFinal } from "@/lib/proofs/delivery";
import { recheckTransfer } from "@/lib/proofs/submit";
import { deliverFinals, dropKeys, relinkProof, sendProofs, sendReminder, type Refused } from "@/lib/proofs/actions";
import { bodyOf, json } from "@/lib/http";

/** A Lightroom export at ~2000px is well under this. */
const MAX_FRAME = 8 * 1024 * 1024;

const UNBOUND = "Proofs need INBOX, PROOFS and LEADS_KEY on this build.";

/** The desk's gate with this route's message, then PROOFS and LEADS_KEY. */
async function proofGate(request: Request) {
  const g = await gate(request, UNBOUND);
  if (g.error) return { error: g.error };
  if (!g.env.PROOFS || !g.s) return { error: json({ error: UNBOUND }, 503) };
  return { ...g, r2: g.env.PROOFS, s: g.s };
}

type Gated = Exclude<Awaited<ReturnType<typeof proofGate>>, { error: Response }>;

/** A route handler behind the proofs gate: `h` runs only once the caller and the bindings are in. */
export const gated =
  (h: (g: Gated, request: Request) => Promise<Response>) =>
  async (request: Request): Promise<Response> => {
    const g = await proofGate(request);
    return g.error ? g.error : h(g, request);
  };

/** The request's JSON body as an object, or an empty one. */
export const bodyIn = async (request: Request) => (await bodyOf(request)) ?? {};

/** One query parameter of the request. */
export const param = (request: Request, name: string) => new URL(request.url).searchParams.get(name);

/** A workflow's outcome as the answer: the refusal with its status, or the record (for the desk) and the rest. */
const answer = (r: { proof: Proof; url?: string } | Refused) =>
  "error" in r ? json({ error: r.error }, r.status) : json({ ...r, proof: forDesk(r.proof) });

const noGallery = () => json({ error: "No such gallery." }, 404);

/** One gallery: null when it is not there, or a JSON 500 when it is there but will not open (a rotated LEADS_KEY), logged. */
async function openProof(g: Gated, token: string): Promise<Proof | null | Response> {
  const p = await readProof(g.kv, g.s, token).catch(logged("proof open", token));
  return p === undefined ? json({ error: "That gallery cannot be opened. LEADS_KEY may have changed." }, 500) : p;
}

/** Every gallery, opened in full: the desk needs each address to match leads, and galleries are few.
    One that will not open is logged and left out, so one bad record never empties the list. */
export async function listGalleries(g: Gated) {
  const key = g.env.STRIPE_SECRET_KEY;
  const all = await Promise.all(
    (await listProofs(g.kv)).map(async (x) => {
      const p = await readProof(g.kv, g.s, x.token).catch(logged("proof list", x.token));
      // Bank payments still settling are checked each time the desk opens.
      const moved = p?.paid?.pending && key ? await recheckTransfer(key, p).catch(() => null) : null;
      if (moved) await writeProof(g.kv, g.s, moved);
      return moved ?? p;
    }),
  );
  return json({
    proofs: all
      .filter((p): p is Proof => !!p)
      .map((p) => ({ ...forDesk(p), url: (p.deliveredAt ? deliveryUrl : proofUrl)(publicId(p)) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  });
}

/** One gallery in full, selects included. */
export async function oneGallery(g: Gated, token: unknown) {
  if (!isToken(token)) return json({ error: "Which gallery?" }, 400);
  const p = await openProof(g, token);
  if (p instanceof Response) return p;
  if (!p) return noGallery();
  return json({ proof: forDesk(p), url: proofUrl(publicId(p)) });
}

/** The proof mail as it would go out, with the inline parts pointed at the site so a browser can show it. */
export async function previewMail(g: Gated, token: unknown) {
  if (!isToken(token)) return json({ error: "Which gallery?" }, 400);
  const p = await openProof(g, token);
  if (p instanceof Response) return p;
  if (!p) return noGallery();
  const sent = p.sentAt ? p : { ...p, closesAt: closesAt(p.days) };
  const m = proofMail(
    sent,
    p.frames.slice(0, 4).map((f) => ({ id: f.id, bytes: new Uint8Array() })),
  );
  const { subject } = m;
  const html = webImages(m.html).replace(/cid:f-([0-9A-Za-z_-]+)/g, (_, id) => `/proof/${publicId(p)}/f/${id}`);
  return json({ html, subject, to: p.email ?? null });
}

/** The reminder for the gallery's stage as it would go out, with who gets it. */
export async function remindPreview(g: Gated, token: unknown) {
  if (!isToken(token)) return json({ error: "Which gallery?" }, 400);
  const p = await openProof(g, token);
  if (p instanceof Response) return p;
  if (!p) return noGallery();
  const r = remindState(p);
  if (!r.stage) return json({ error: "Not sent yet." }, 409);
  const m = reminderMail(p, r.stage);
  const html = webImages(m.html);
  return json({
    html,
    subject: m.subject,
    to: p.email ?? null,
    cc: p.email ? await copiesFor(g.kv, g.s, p.email).catch(() => []) : [],
    remind: r,
  });
}

/** A typed email that fails isEmail is refused, so a save never clears the stored one; a blank one still clears it. */
const badEmail = (v: unknown) => typeof v === "string" && v.trim() !== "" && !isEmail(v);

/** A new gallery. The shoot day from Lightroom (earliest capture date) names it; a plugin that sends none gets today. */
export async function createGallery(g: Gated, b: Record<string, unknown>) {
  if (badEmail(b.email)) return json({ error: "That email does not look right." }, 400);
  const set = cleanSettings(b);
  const p: Proof = {
    token: await nextProofId(g.kv, shootDay(b.day) ?? undefined),
    name: set.name ?? "Proofs",
    ...DEFAULTS,
    ...set,
    createdAt: new Date().toISOString(),
    frames: [],
    selects: [],
    notes: {},
    views: 0,
  };
  await writeProof(g.kv, g.s, p);
  return json({ token: p.token, url: proofUrl(p.token) }, 201);
}

/** One job on one gallery, by `action`: each answers the request on its own. */
const ACTIONS: Record<string, (g: Gated, p: Proof, b: Record<string, unknown>, request: Request) => Promise<Response>> = {
  /** The Lightroom plugin has the sent selects: they are back in Lightroom. Stamped once; a gallery not sent yet stays unstamped. */
  async pulled(g, p) {
    if (!p.submittedAt || p.pulledAt) return json({ pulledAt: p.pulledAt ?? null });
    const pulledAt = new Date().toISOString();
    await writeProof(g.kv, g.s, { ...p, pulledAt });
    return json({ pulledAt });
  },
  async send(g, p, b, request) {
    return answer(await sendProofs(g, p, b.subject, request.url));
  },
  async deliver(g, p, b) {
    return answer(await deliverFinals(g, p, b.subject));
  },
  async remind(g, p) {
    return answer(await sendReminder(g, p));
  },
  async relink(g, p) {
    return answer(await relinkProof(g, p));
  },
  /** Drop one visitor's record and its line in Leads (Julian's own test visits). */
  async forget(g, p, b) {
    const who = typeof b.email === "string" ? viewerKey(b.email) : "";
    if (!who || !p.viewers?.[who]) return json({ error: "No visit from that address." }, 404);
    const viewers = { ...p.viewers };
    delete viewers[who];
    const next: Proof = { ...p, viewers };
    await writeProof(g.kv, g.s, next);
    // The open also put a "proofs" line on their lead.
    await dropProofOpens(g.kv, g.s, who, p.token);
    return json({ proof: forDesk(next) });
  },
  /** Unlock the selects. */
  async reopen(g, p) {
    const next: Proof = { ...p, submittedAt: undefined, pulledAt: undefined };
    await writeProof(g.kv, g.s, next);
    return json({ proof: forDesk(next) });
  },
  /** Add days to the clock. */
  async extend(g, p, b) {
    const days = Math.min(90, Math.max(1, Math.round(Number(b.days) || 7)));
    const from = Math.max(Date.now(), p.closesAt ? Date.parse(p.closesAt) : Date.now());
    const next: Proof = { ...p, closesAt: closesAt(days, from) };
    await writeProof(g.kv, g.s, next);
    return json({ proof: forDesk(next) });
  },
};

/** `{action, token, ...}` on one gallery. */
export async function galleryAction(g: Gated, b: Record<string, unknown>, request: Request) {
  if (!isToken(b.token)) return json({ error: "Which gallery?" }, 400);
  const p = await openProof(g, b.token);
  if (p instanceof Response) return p;
  if (!p) return noGallery();
  const act = typeof b.action === "string" && Object.hasOwn(ACTIONS, b.action) ? ACTIONS[b.action] : undefined;
  return act ? act(g, p, b, request) : json({ error: "Unknown action." }, 400);
}

/** `{token, ...settings}`: name, email, note, included, price, days, watermark, password. */
export async function saveSettings(g: Gated, b: Record<string, unknown>) {
  if (!isToken(b.token)) return json({ error: "Which gallery?" }, 400);
  const token = b.token;
  const p = await openProof(g, token);
  if (p instanceof Response) return p;
  if (!p) return noGallery();
  if (badEmail(b.email)) return json({ error: "That email does not look right." }, 400);
  const set = cleanSettings(b);
  // The gate's password: hashed here, never stored or answered plain. An empty one takes it off.
  if (typeof b.password === "string" && b.password && (b.password.length < 4 || b.password.length > 200))
    return json({ error: "A password is 4 to 200 characters." }, 400);
  const pass = typeof b.password === "string" ? { pass: b.password ? await hashPass(b.password) : undefined } : {};
  const next: Proof = { ...p, ...set, ...pass };
  // A new preview pick redraws the card of the frame it leaves and the one it lands on.
  if ("card" in set)
    await g.r2.delete(
      [...new Set([p.card?.id, next.card?.id, p.frames[0]?.id])].filter((id): id is string => !!id).map((id) => cardKey(token, id)),
    );
  await writeProof(g.kv, g.s, next);
  return json({ proof: forDesk(next) });
}

/**
 * One frame from Lightroom (`?token&id&file&w&h`), or one final with `&final=1[&model=<label>&top=1]` (the Delivery service).
 * shortcut: read, add, write is not atomic, so the plugin uploads one frame at a time; a Durable Object if uploads ever run in parallel.
 */
export async function putFrame(g: Gated, request: Request) {
  const q = new URL(request.url).searchParams;
  const token = q.get("token"),
    id = q.get("id"),
    file = (q.get("file") ?? "").slice(0, 120);
  const w = Number(q.get("w")) || 0,
    h = Number(q.get("h")) || 0;
  // Capture time from Lightroom, Unix seconds; anything implausible is dropped, not refused.
  const t = Math.round(Number(q.get("t")));
  if (!isToken(token) || !isFrameId(id) || !file) return json({ error: "token, id and file are required." }, 400);
  if (!(request.headers.get("content-type") ?? "").startsWith("image/jpeg")) return json({ error: "Send a JPEG." }, 415);
  if (q.get("final") === "1") {
    // Full size: streamed to R2, never held in the Worker.
    const length = Number(request.headers.get("content-length"));
    if (!request.body || !(length > 0)) return json({ error: "Send the file with its length." }, 411);
    if (length > MAX_FINAL) return json({ error: "Final is over 95 MB." }, 413);
    const before = await openProof(g, token);
    if (before instanceof Response) return before;
    if (!before) return noGallery();
    const { bytes, crc } = await storeFinal(g.env, token, id, request.body, length);
    // Read again after the upload: a long upload must not write back a record from before it.
    const p = await openProof(g, token);
    if (p instanceof Response) return p;
    if (!p) return noGallery();
    const model = q.get("model")?.trim().replace(/\s+/g, " ");
    const final = {
      id,
      file,
      w,
      h,
      bytes,
      crc,
      ...(t > 0 && t < 4e9 ? { t } : {}),
      ...(isModel(model) ? { model } : {}),
      ...(q.get("top") === "1" ? { top: true } : {}),
    };
    const finals = [...(p.finals ?? []).filter((f) => f.id !== id), final];
    await writeProof(g.kv, g.s, { ...p, finals });
    return json({ ok: true, finals: finals.length, url: deliveryUrl(publicId(p)) });
  }
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_FRAME) return json({ error: "Frame is empty or over 8 MB." }, 413);
  const p = await openProof(g, token);
  if (p instanceof Response) return p;
  if (!p) return noGallery();
  if (p.deliveredAt) return json({ error: "This gallery was delivered. Publish to the Delivery collection instead." }, 409);
  await g.r2.put(frameKey(token, id), bytes, { httpMetadata: { contentType: "image/jpeg" } });
  // A replaced frame is watermarked again, and its card redrawn, on the next fetch.
  await g.r2.delete(frameKeys(token, id).slice(1));
  const frame = { id, file, w, h, ...(t > 0 && t < 4e9 ? { t } : {}) };
  const i = p.frames.findIndex((f) => f.id === id);
  const frames = i < 0 ? [...p.frames, frame] : p.frames.map((f, j) => (j === i ? frame : f));
  await writeProof(g.kv, g.s, { ...p, frames });
  return json({ ok: true, frames: frames.length, url: proofUrl(publicId(p)) });
}

/** The DELETE query: `?token` the gallery, `&id` or `&ids` (comma list) its frames, `&final=1` finals. */
export function dropQuery(request: Request) {
  const q = new URL(request.url).searchParams;
  // `ids` (comma list) drops several frames in one write: KV takes one write per
  // key per second, so Lightroom removing frames one request each hit a 429 (500).
  const ids = q.get("ids")?.split(",") ?? (q.get("id") !== null ? [q.get("id")!] : null);
  return { token: q.get("token"), ids, final: q.get("final") === "1" };
}

/** Drop finals, frames, or (no `ids`) the whole gallery. Only web previews go, never an original. */
export async function dropFiles(g: Gated, { token, ids, final }: { token: string | null; ids: string[] | null; final: boolean }) {
  if (!isToken(token)) return json({ error: "Which gallery?" }, 400);
  const p = await openProof(g, token);
  if (p instanceof Response) return p;
  if (!p) return json({ ok: true });
  if (final) {
    // Lightroom's Delivery service: finals out of the gallery. The record stays; the proof side owns it.
    if (!ids?.length || ids.length > 1000 || !ids.every(isFrameId)) return json({ error: "Bad frame id." }, 400);
    const keys = ids.flatMap((id) => finalKeys(token, id));
    await dropKeys(g.r2, keys);
    const gone = new Set(ids);
    await writeProof(g.kv, g.s, { ...p, finals: (p.finals ?? []).filter((f) => !gone.has(f.id)) });
    return json({ ok: true });
  }
  // Unpublishing the proof collection must not take the client's finals with it.
  if (p.deliveredAt)
    return json({ error: "This gallery was delivered. Its finals stay until you remove them from the Delivery collection." }, 409);
  if (ids) {
    if (!ids.length || ids.length > 1000 || !ids.every(isFrameId)) return json({ error: "Bad frame id." }, 400);
    const keys = ids.flatMap((id) => frameKeys(token, id));
    await dropKeys(g.r2, keys);
    const gone = new Set(ids);
    const notes = { ...p.notes };
    for (const id of ids) delete notes[id];
    await writeProof(g.kv, g.s, {
      ...p,
      frames: p.frames.filter((f) => !gone.has(f.id)),
      selects: p.selects.filter((s) => !gone.has(s)),
      notes,
    });
    return json({ ok: true });
  }
  // Finals published but not sent yet: dropping the record would orphan them in R2 and lose the delivery.
  if (p.finals?.length) return json({ error: "This gallery holds finals. Remove them from the Delivery collection first." }, 409);
  // The whole gallery: Lightroom's "delete published collection".
  const keys = p.frames.flatMap((f) => frameKeys(token, f.id));
  await dropKeys(g.r2, keys);
  if (p.link) await g.kv.delete(aliasKey(p.link));
  await g.kv.delete(proofKey(token));
  return json({ ok: true });
}
