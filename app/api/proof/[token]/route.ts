import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sealer } from "@/lib/leads/lead-crypto";
import { recordLead } from "@/lib/leads/lead-store";
import { checkout, checkPaid, finalize } from "@/lib/proofs/submit";
import { PAYMENTS_DOWN, PAYMENTS_OFF } from "@/lib/stripe";
import { cleanSelects, device, isEmail, isOpen, owed, isToken, publicView, readPublic, track, viewerKey, writeProof, type Proof } from "@/lib/proofs/proof";
import { bodyOf, json } from "@/lib/http";

/* ── proofs, the client's side ────────────────────────────────────
 * The token in the path is the only key; the email typed at the gate (any
 * address) names who is picking, and every call logs under it. PATCH saves
 * that address's picks as they go; POST {action:"track"} logs an open, the
 * review screen, time on the page and per-frame looks; POST sends the
 * picks, through Checkout when there are extras; POST {confirm} checks a
 * Checkout session on the way back.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

async function load(token: string) {
  const { env } = await getCloudflareContext({ async: true });
  const seal = sealer(env.LEADS_KEY);
  if (!env.INBOX || !seal || !isToken(token)) return null;
  const s = await seal;
  const p = await readPublic(env.INBOX, s, token);
  return p && isOpen(p) ? { env, kv: env.INBOX, s, p } : null;
}

/** The gallery with one visitor's record updated. shortcut: read, change, write is not atomic, so two people picking in the same second can drop one log line; a Durable Object if that ever matters. */
function logged(p: Proof, email: string, e: Parameters<typeof track>[2]): Proof {
  const k = viewerKey(email);
  return { ...p, viewers: { ...p.viewers, [k]: track(p.viewers?.[k], new Date().toISOString(), e) } };
}

async function where() {
  const { cf } = await getCloudflareContext({ async: true });
  // The city Cloudflare places them in, never the address.
  return [cf?.city, cf?.region, cf?.country].filter((v) => typeof v === "string" && v).join(", ") || undefined;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const g = await load((await params).token);
  if (!g) return json({ error: "This gallery closed." }, 404);
  if (g.p.submittedAt) return json({ error: "Selects are already in." }, 409);
  const b = ((await bodyOf(request)) ?? {});
  if (!isEmail(b.email)) return json({ error: "Add your email first." }, 400);
  const selects = cleanSelects(b.selects, g.p.frames);
  const next = { ...logged(g.p, b.email, { picks: selects }), selects, firstSelectAt: g.p.firstSelectAt ?? (selects.length && g.p.sentAt ? new Date().toISOString() : undefined) };
  await writeProof(g.kv, g.s, next);
  return json({ ok: true });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const g = await load((await params).token);
  if (!g) return json({ error: "This gallery closed." }, 404);
  const b = ((await bodyOf(request)) ?? {});

  if (b.action === "track") {
    if (!isEmail(b.email)) return json({ error: "Add your email first." }, 400);
    const kind = b.kind === "open" || b.kind === "review" ? b.kind : undefined;
    const looks = b.looks && typeof b.looks === "object" ? Object.fromEntries(Object.entries(b.looks as Record<string, unknown>).filter(([id, ms]) => g.p.frames.some((f) => f.id === id) && typeof ms === "number")) as Record<string, number> : undefined;
    const open = kind === "open" ? { device: device(request.headers.get("user-agent") ?? ""), place: await where() } : {};
    // The name from the gate, sent with the open only.
    const name = kind === "open" && typeof b.name === "string" && b.name.trim() ? b.name.trim().replace(/\s+/g, " ").slice(0, 80) : undefined;
    const next = logged(g.p, b.email, { kind, looks, seconds: Number(b.seconds) || 0, ...open, name });
    await writeProof(g.kv, g.s, next);
    if (kind === "open") await recordLead(g.env, b.email, { event: { at: new Date().toISOString(), kind: "proofs", ref: g.p.token, note: g.p.name }, name });
    // An address coming back gets its own picks; once sent, everyone sees what was sent.
    return json({ picks: g.p.submittedAt ? g.p.selects : (next.viewers?.[viewerKey(b.email)]?.picks ?? []) });
  }

  if (!(await g.env.DEPOSIT_LIMIT.limit({ key: request.headers.get("cf-connecting-ip") ?? "unknown" })).success) return json({ error: "Too many tries. Wait a minute." }, 429);
  if (g.p.submittedAt) return json({ done: true, ...publicView(g.p) });
  const key = g.env.STRIPE_SECRET_KEY;

  if (typeof b.confirm === "string") {
    if (!key) return json({ error: PAYMENTS_OFF }, 503);
    const paid = await checkPaid(key, g.p, b.confirm);
    if (paid === "down") return json({ error: PAYMENTS_DOWN }, 502);
    if (!paid) return json({ error: "That payment did not go through." }, 402);
    return json({ done: true, ...publicView(await finalize(g.env, g.kv, g.s, g.p, paid)) });
  }

  if (!isEmail(b.email)) return json({ error: "Add your email first." }, 400);
  const selects = cleanSelects(b.selects, g.p.frames);
  if (!selects.length) return json({ error: "Select at least one frame." }, 400);
  // Notes are gone from the gallery (Julian 2026-11-08); old ones are dropped with the send.
  const p: Proof = { ...logged(g.p, b.email, { picks: selects }), selects, notes: {}, message: undefined, submittedBy: b.email.trim() };

  if (owed(p).cents === 0) return json({ done: true, ...publicView(await finalize(g.env, g.kv, g.s, p)) });
  if (!key) return json({ error: PAYMENTS_OFF }, 503);
  try {
    const c = await checkout(key, p, b.method === "card" ? "card" : "bank");
    await writeProof(g.kv, g.s, { ...p, checkout: c.id });
    return json({ checkout: c.url });
  } catch {
    return json({ error: PAYMENTS_DOWN }, 502);
  }
}
