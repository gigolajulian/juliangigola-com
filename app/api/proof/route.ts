import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdmin } from "@/lib/vouch";
import { sealer } from "@/lib/lead-crypto";
import { recordLead } from "@/lib/leads";
import { closesAt, cleanSettings, DEFAULTS, frameKey, frameKeys, isFrameId, isToken, listProofs, newToken, readProof, writeProof, type Proof } from "@/lib/proofs";
import { proofMail, proofUrl, sendClient } from "@/lib/proof-mail";
import { settle } from "@/lib/proof-submit";
import { servedFrame } from "@/lib/proof-watermark";
import { json } from "@/lib/http";

/* ── proofs, Julian's side ────────────────────────────────────────
 * Lightroom (the publish service) and /admin Leads both call this, with the
 * same credentials as the Inbox: the INBOX_KEY header or a GitHub token that
 * can push to the repo. The client's side is `/api/proof/[token]`.
 *
 *   GET    ?list                       every gallery, from KV metadata
 *   GET    ?token=X                    one gallery in full, selects included
 *   POST   {action:"create", ...}      new gallery, returns token + url
 *   POST   {action:"send", token}      the proof mail; the clock starts
 *   POST   {action:"reopen"|"extend"}  unlock selects | add days
 *   PATCH  {token, ...settings}        name, email, note, included, price, days, watermark
 *   PUT    ?token&id&file&w&h  <jpeg>  add or replace one frame
 *   DELETE ?token&id                   drop one frame
 *   DELETE ?token                      drop the gallery and its frames
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

/** A Lightroom export at ~2000px is well under this. */
const MAX_FRAME = 8 * 1024 * 1024;

async function gate(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const seal = sealer(env.LEADS_KEY);
  if (!env.INBOX || !env.PROOFS || !seal) return { error: json({ error: "Proofs need INBOX, PROOFS and LEADS_KEY on this build." }, 503) };
  const ok = await isAdmin(request, env.INBOX_KEY);
  if (!ok) return { error: json({ error: "Not authorized." }, 401) };
  return { env, kv: env.INBOX, r2: env.PROOFS, s: await seal };
}

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const b: unknown = await request.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  const g = await gate(request);
  if ("error" in g) return g.error;
  const q = new URL(request.url).searchParams;
  if (q.has("list")) {
    // Opened in full: the desk needs each address to match leads. Galleries are few.
    const key = g.env.STRIPE_SECRET_KEY;
    const all = await Promise.all(
      (await listProofs(g.kv)).map(async (x) => {
        const p = await readProof(g.kv, g.s, x.token);
        // Bank payments still settling are checked each time the desk opens.
        const moved = p?.paid?.pending && key ? await settle(key, p).catch(() => null) : null;
        if (moved) await writeProof(g.kv, g.s, moved);
        return moved ?? p;
      }),
    );
    return json({ proofs: all.filter((p): p is Proof => !!p).map((p) => ({ ...p, url: proofUrl(p.token) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  }
  const preview = q.get("preview");
  if (isToken(preview)) {
    // The proof mail as it would go out, with the inline parts pointed at the site so a browser can show it.
    const p = await readProof(g.kv, g.s, preview);
    if (!p) return json({ error: "No such gallery." }, 404);
    const sent = p.sentAt ? p : { ...p, closesAt: closesAt(p.days) };
    let { html } = proofMail(sent, p.frames.slice(0, 4).map((f) => ({ id: f.id, bytes: new Uint8Array() })));
    html = html.replace("cid:name-ink", "/email-name-ink.png").replace("cid:name-w", "/email-name-w.png").replace(/cid:f-([0-9A-Za-z_-]+)/g, (_, id) => `/proof/${p.token}/f/${id}`);
    return json({ html, subject: "Your proofs are ready", to: p.email ?? null });
  }
  const token = q.get("token");
  if (!isToken(token)) return json({ error: "Which gallery?" }, 400);
  let p = await readProof(g.kv, g.s, token);
  if (!p) return json({ error: "No such gallery." }, 404);
  // Only the Lightroom plugin reads one gallery: once it has the sent selects, they are back in Lightroom.
  if (p.submittedAt && !p.pulledAt) {
    p = { ...p, pulledAt: new Date().toISOString() };
    await writeProof(g.kv, g.s, p);
  }
  return json({ proof: p, url: proofUrl(p.token) });
}

export async function POST(request: Request) {
  const g = await gate(request);
  if ("error" in g) return g.error;
  const b = await body(request);

  if (b.action === "create") {
    const set = cleanSettings(b);
    const p: Proof = { token: newToken(), name: set.name ?? "Proofs", ...DEFAULTS, ...set, createdAt: new Date().toISOString(), frames: [], selects: [], notes: {}, views: 0 };
    await writeProof(g.kv, g.s, p);
    return json({ token: p.token, url: proofUrl(p.token) }, 201);
  }

  if (!isToken(b.token)) return json({ error: "Which gallery?" }, 400);
  const p = await readProof(g.kv, g.s, b.token);
  if (!p) return json({ error: "No such gallery." }, 404);

  if (b.action === "send") {
    if (!p.email) return json({ error: "Add the client's email first." }, 400);
    if (!p.frames.length) return json({ error: "Publish frames from Lightroom first." }, 400);
    // The strip in the mail carries the watermark too, when it is on.
    const strip = await Promise.all(
      p.frames.slice(0, 4).map(async (f) => {
        const o = await servedFrame(g.env, p, f.id, request.url);
        return o ? { id: f.id, bytes: new Uint8Array(await new Response(o.body).arrayBuffer()) } : null;
      }),
    )
      .then((all) => all.filter((x) => x !== null))
      .catch(() => null);
    if (!strip) return json({ error: "The watermark could not be drawn. Try again." }, 502);
    const now = Date.now();
    const sent: Proof = { ...p, sentAt: new Date(now).toISOString(), closesAt: closesAt(p.days, now) };
    const m = proofMail(sent, strip);
    if (!(await sendClient(g.env.CLIENT_EMAIL, p.email, m))) return json({ error: "The mail did not go out. Try again." }, 502);
    await writeProof(g.kv, g.s, sent);
    await recordLead(g.env, p.email, { event: { at: sent.sentAt!, kind: "mail", note: m.subject, mail: { to: "client", kind: "proofs" } } });
    return json({ proof: sent });
  }
  if (b.action === "reopen") {
    const next: Proof = { ...p, submittedAt: undefined, pulledAt: undefined };
    await writeProof(g.kv, g.s, next);
    return json({ proof: next });
  }
  if (b.action === "extend") {
    const days = Math.min(90, Math.max(1, Math.round(Number(b.days) || 7)));
    const from = Math.max(Date.now(), p.closesAt ? Date.parse(p.closesAt) : Date.now());
    const next: Proof = { ...p, closesAt: closesAt(days, from) };
    await writeProof(g.kv, g.s, next);
    return json({ proof: next });
  }
  return json({ error: "Unknown action." }, 400);
}

export async function PATCH(request: Request) {
  const g = await gate(request);
  if ("error" in g) return g.error;
  const b = await body(request);
  if (!isToken(b.token)) return json({ error: "Which gallery?" }, 400);
  const p = await readProof(g.kv, g.s, b.token);
  if (!p) return json({ error: "No such gallery." }, 404);
  const next: Proof = { ...p, ...cleanSettings(b) };
  await writeProof(g.kv, g.s, next);
  return json({ proof: next });
}

/** One frame from Lightroom. shortcut: read, add, write is not atomic, so the plugin uploads one frame at a time; a Durable Object if uploads ever run in parallel. */
export async function PUT(request: Request) {
  const g = await gate(request);
  if ("error" in g) return g.error;
  const q = new URL(request.url).searchParams;
  const token = q.get("token"), id = q.get("id"), file = (q.get("file") ?? "").slice(0, 120);
  const w = Number(q.get("w")) || 0, h = Number(q.get("h")) || 0;
  if (!isToken(token) || !isFrameId(id) || !file) return json({ error: "token, id and file are required." }, 400);
  if (!(request.headers.get("content-type") ?? "").startsWith("image/jpeg")) return json({ error: "Send a JPEG." }, 415);
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_FRAME) return json({ error: "Frame is empty or over 8 MB." }, 413);
  const p = await readProof(g.kv, g.s, token);
  if (!p) return json({ error: "No such gallery." }, 404);
  await g.r2.put(frameKey(token, id), bytes, { httpMetadata: { contentType: "image/jpeg" } });
  // A replaced frame is watermarked again, and its card redrawn, on the next fetch.
  await g.r2.delete(frameKeys(token, id).slice(1));
  const frame = { id, file, w, h };
  const i = p.frames.findIndex((f) => f.id === id);
  const frames = i < 0 ? [...p.frames, frame] : p.frames.map((f, j) => (j === i ? frame : f));
  await writeProof(g.kv, g.s, { ...p, frames });
  return json({ ok: true, frames: frames.length, url: proofUrl(token) });
}

export async function DELETE(request: Request) {
  const g = await gate(request);
  if ("error" in g) return g.error;
  const q = new URL(request.url).searchParams;
  const token = q.get("token");
  // `ids` (comma list) drops several frames in one write: KV takes one write per
  // key per second, so Lightroom removing frames one request each hit a 429 (500).
  const ids = q.get("ids")?.split(",") ?? (q.get("id") !== null ? [q.get("id")!] : null);
  if (!isToken(token)) return json({ error: "Which gallery?" }, 400);
  const p = await readProof(g.kv, g.s, token);
  if (!p) return json({ ok: true });
  if (ids) {
    if (!ids.length || ids.length > 1000 || !ids.every(isFrameId)) return json({ error: "Bad frame id." }, 400);
    const keys = ids.flatMap((id) => frameKeys(token, id));
    for (let i = 0; i < keys.length; i += 1000) await g.r2.delete(keys.slice(i, i + 1000));
    const gone = new Set(ids);
    const notes = { ...p.notes };
    for (const id of ids) delete notes[id];
    await writeProof(g.kv, g.s, { ...p, frames: p.frames.filter((f) => !gone.has(f.id)), selects: p.selects.filter((s) => !gone.has(s)), notes });
    return json({ ok: true });
  }
  // The whole gallery: Lightroom's "delete published collection". Only web previews go, never an original.
  const keys = p.frames.flatMap((f) => frameKeys(token, f.id));
  for (let i = 0; i < keys.length; i += 1000) await g.r2.delete(keys.slice(i, i + 1000));
  await g.kv.delete(`proof:${token}`);
  return json({ ok: true });
}
