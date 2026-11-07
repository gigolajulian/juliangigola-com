import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sealer } from "@/lib/lead-crypto";
import { checkout, finalize, paidFor } from "@/lib/proof-submit";
import { cleanNotes, cleanSelects, isOpen, owed, isToken, publicView, readProof, writeProof } from "@/lib/proofs";

/* ── proofs, the client's side ────────────────────────────────────
 * The token in the path is the only key. Closed or sent galleries refuse
 * changes. PATCH saves selects as they go (so a reload keeps them); POST
 * sends them, through Checkout when there are extras; POST {confirm}
 * checks a Checkout session on the way back.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const H = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: H });

async function load(token: string) {
  const { env } = await getCloudflareContext({ async: true });
  const seal = sealer(env.LEADS_KEY);
  if (!env.INBOX || !seal || !isToken(token)) return null;
  const s = await seal;
  const p = await readProof(env.INBOX, s, token);
  return p && isOpen(p) ? { env, kv: env.INBOX, s, p } : null;
}

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const b: unknown = await request.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const g = await load((await params).token);
  if (!g) return json({ error: "This gallery closed." }, 404);
  if (g.p.submittedAt) return json({ error: "Selects are already in." }, 409);
  const b = await body(request);
  const selects = cleanSelects(b.selects, g.p.frames);
  const next = { ...g.p, selects, notes: cleanNotes(b.notes, selects), firstSelectAt: g.p.firstSelectAt ?? (selects.length && g.p.sentAt ? new Date().toISOString() : undefined) };
  await writeProof(g.kv, g.s, next);
  return json(publicView(next));
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const g = await load((await params).token);
  if (!g) return json({ error: "This gallery closed." }, 404);
  if (!(await g.env.DEPOSIT_LIMIT.limit({ key: request.headers.get("cf-connecting-ip") ?? "unknown" })).success) return json({ error: "Too many tries. Wait a minute." }, 429);
  if (g.p.submittedAt) return json({ done: true, ...publicView(g.p) });
  const b = await body(request);
  const key = g.env.STRIPE_SECRET_KEY;

  if (typeof b.confirm === "string") {
    if (!key) return json({ error: "Payments are off." }, 503);
    const paid = await paidFor(key, g.p, b.confirm).catch(() => null);
    if (!paid) return json({ error: "That payment did not go through." }, 402);
    return json({ done: true, ...publicView(await finalize(g.env, g.kv, g.s, g.p, paid)) });
  }

  const selects = cleanSelects(b.selects, g.p.frames);
  if (!selects.length) return json({ error: "Select at least one frame." }, 400);
  const p = { ...g.p, selects, notes: cleanNotes(b.notes, selects), message: typeof b.message === "string" ? b.message.trim().slice(0, 1000) || undefined : undefined };

  if (owed(p).cents === 0) return json({ done: true, ...publicView(await finalize(g.env, g.kv, g.s, p)) });
  if (!key) return json({ error: "Payments are off. Reply to my email and I'll sort it." }, 503);
  try {
    const c = await checkout(key, p);
    await writeProof(g.kv, g.s, { ...p, checkout: c.id });
    return json({ checkout: c.url });
  } catch {
    return json({ error: "Payments are down. Try again in a minute." }, 502);
  }
}
