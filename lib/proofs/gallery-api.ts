import { getCloudflareContext } from "@opennextjs/cloudflare";
import { later } from "@/lib/later";
import { sealedStore } from "@/lib/kv";
import { recordLead } from "@/lib/leads/lead-store";
import { checkout, checkPaid, finalize } from "@/lib/proofs/submit";
import { PAYMENTS_DOWN, PAYMENTS_OFF } from "@/lib/stripe";
import {
  cleanSelects,
  device,
  isTestEmail,
  amountOwed,
  isToken,
  publicView,
  withViewerEvent,
  viewerKey,
  type Proof,
} from "@/lib/proofs/proof-model";
import { isEmail } from "@/lib/utils";
import { checkPass, guardOf, passCookie, passValue, shutReason, readPublic, writeProof } from "@/lib/proofs/proof-store";
import { bodyOf, json, limited, upstreamError } from "@/lib/http";
import { alertHello } from "@/lib/email/hello-mail";
import { actionAlert, worthMail } from "@/lib/proofs/proof-mail";

/* ── proofs, the client's side (the routes under `app/api/proof/[token]`) ────────────────────────────────────
 * The token in the path is the only key; the email typed at the gate (any
 * address) names who is picking, and every call logs under it. PATCH saves
 * that address's picks as they go; POST {action:"track"} logs an open, the
 * review screen, time on the page and per-frame looks; POST sends the
 * picks, through Checkout when there are extras; POST {confirm} checks a
 * Checkout session on the way back.
 * ─────────────────────────────────────────────────────────────── */

/** A gallery that is there but will not open (a rotated LEADS_KEY): JSON, like every other answer. */
const unopenable = () => json({ error: "This gallery cannot be opened right now." }, 500);

/** The gallery for this request: open, online, and past its password when it has one (the gate's cookie). */
async function load(token: string, request: Request) {
  const { env, seal, kv } = await sealedStore();
  if (!kv || !seal || !isToken(token)) return null;
  const proof = await readPublic(kv, seal, token, guardOf(env, request.headers));
  if (proof === undefined) return unopenable();
  return proof && !(await shutReason(proof, request.headers.get("cookie"), env.LEADS_KEY)) ? { env, kv, seal, proof } : null;
}

/** The gate's password: rate-limited per address, and a right one answers with the cookie every later call needs. */
export async function unlock(token: string, request: Request, password: unknown) {
  const { env, seal, kv } = await sealedStore();
  if (!kv || !seal || !isToken(token)) return json({ error: "This gallery closed." }, 404);
  const p = await readPublic(kv, seal, token, guardOf(env, request.headers));
  if (p === undefined) return unopenable();
  const why = await shutReason(p, null, env.LEADS_KEY);
  if (!p || (why && why !== "locked")) return json({ error: why === "offline" ? "This gallery is offline." : "This gallery closed." }, 404);
  if (!p.pass) return json({ ok: true });
  // Its own key prefix: wrong passwords never use up the pay attempts on the same limiter.
  const slow = await limited(env.PUBLIC_WRITE_LIMIT, "pass", request);
  if (slow) return slow;
  if (typeof password !== "string" || password.length > 200 || !(await checkPass(p.pass, password)))
    return json({ error: "That password is not right." }, 403);
  const res = json({ ok: true });
  res.headers.append(
    "set-cookie",
    `${passCookie(p)}=${await passValue(p, env.LEADS_KEY!)}; Path=/; Max-Age=${60 * 864e2}; HttpOnly; Secure; SameSite=Lax`,
  );
  return res;
}

/** The gallery with one visitor's record updated. shortcut: read, change, write is not atomic, so two people picking in the same second can drop one log line; a Durable Object if that ever matters. */
/** Addresses one gallery keeps: a real shoot has a handful, so past this a new address is a script minting leads. */
const MAX_VIEWERS = 100;

function withVisit(p: Proof, email: string, e: Parameters<typeof withViewerEvent>[2]): Proof {
  const k = viewerKey(email);
  if (!p.viewers?.[k] && Object.keys(p.viewers ?? {}).length >= MAX_VIEWERS) return p;
  return { ...p, viewers: { ...p.viewers, [k]: withViewerEvent(p.viewers?.[k], new Date().toISOString(), e) } };
}

async function where() {
  const { cf } = await getCloudflareContext({ async: true });
  // The city Cloudflare places them in, never the address.
  return [cf?.city, cf?.region, cf?.country].filter((v) => typeof v === "string" && v).join(", ") || undefined;
}

/** Every public proof body: picks and looks for a few hundred frames fit well under this. */
export const BODY_MAX = 256 * 1024;

export async function selectsPatch(token: string, request: Request) {
  const g = await load(token, request);
  if (!g) return json({ error: "This gallery closed." }, 404);
  if (g instanceof Response) return g;
  // Autosave writes a beat after each change, more often than the five a minute of PUBLIC_WRITE_LIMIT: its own kind on the download limiter (60 a minute).
  const slow = await limited(g.env.DOWNLOAD_LIMIT, "selects", request);
  if (slow) return slow;
  if (g.proof.submittedAt) return json({ error: "Selects are already in." }, 409);
  const b = (await bodyOf(request, BODY_MAX)) ?? {};
  if (typeof b.email !== "string" || !isEmail(b.email)) return json({ error: "Add your email first." }, 400);
  const selects = cleanSelects(b.selects, g.proof.frames);
  const next = {
    ...withVisit(g.proof, b.email, { picks: selects }),
    selects,
    firstSelectAt: g.proof.firstSelectAt ?? (selects.length && g.proof.sentAt ? new Date().toISOString() : undefined),
  };
  await writeProof(g.kv, g.seal, next);
  return json({ ok: true });
}

/** POST track: an open, the review screen, time on the page, per-frame looks or a download. */
export async function track(token: string, request: Request, b: Record<string, unknown>) {
  const g = await load(token, request);
  if (!g) return json({ error: "This gallery closed." }, 404);
  if (g instanceof Response) return g;
  const busy = await limited(g.env.DOWNLOAD_LIMIT, "track", request);
  if (busy) return busy;
  if (typeof b.email !== "string" || !isEmail(b.email)) return json({ error: "Add your email first." }, 400);
  // "download" (a delivery's Save or Download all) names the final, "all" for the zip, or a model ("M04") for its zip.
  const dl =
    b.kind === "download" && g.proof.finals?.length && (b.id === "all" || g.proof.finals.some((f) => f.id === b.id || f.model === b.id))
      ? (b.id as string)
      : undefined;
  const kind = b.kind === "open" || b.kind === "review" ? b.kind : dl ? "download" : undefined;
  const looks =
    b.looks && typeof b.looks === "object"
      ? (Object.fromEntries(
          Object.entries(b.looks as Record<string, unknown>).filter(
            ([id, ms]) => g.proof.frames.some((f) => f.id === id) && typeof ms === "number",
          ),
        ) as Record<string, number>)
      : undefined;
  const open = kind === "open" ? { device: device(request.headers.get("user-agent") ?? ""), place: await where() } : {};
  // The name from the gate, sent with the open only.
  const name = kind === "open" && typeof b.name === "string" && b.name.trim() ? b.name.trim().replace(/\s+/g, " ").slice(0, 80) : undefined;
  let next = withVisit(g.proof, b.email, { kind, id: dl, looks, seconds: Number(b.seconds) || 0, ...open, name });
  // The client's first download of the finals moves their lead to Delivered. Against the gallery's address, so the right lead moves.
  const first = dl && g.proof.deliveredAt && !g.proof.firstDownloadAt && !isTestEmail(b.email);
  if (first) next = { ...next, firstDownloadAt: new Date().toISOString() };
  await writeProof(g.kv, g.seal, next);
  if (first)
    await recordLead(g.env, g.proof.email ?? b.email, {
      event: { at: next.firstDownloadAt!, kind: "download", ref: g.proof.token, note: g.proof.name },
    });
  // "each": hello@ hears of an open or a download as it happens, once per address per half hour (opens) or ten minutes (downloads).
  // Past MAX_VIEWERS a new address is not kept: no mail, no lead.
  const kept = !!next.viewers?.[viewerKey(b.email)];
  const mailed = kept && (kind === "open" || kind === "download") ? kind : null;
  if (
    mailed &&
    g.proof.notify === "each" &&
    (g.proof.sentAt || g.proof.deliveredAt) &&
    !isTestEmail(b.email) &&
    worthMail(g.proof.viewers?.[viewerKey(b.email)]?.events ?? [], mailed, new Date().toISOString(), mailed === "open" ? 30 : 10)
  ) {
    const a = actionAlert(next, viewerKey(b.email), mailed, dl);
    await later(alertHello(g.env.EMAIL, a.subject, a.lines));
  }
  // A test address opening the gate (QA) stays in the gallery's own log, not on the desk as a lead.
  if (kind === "open" && kept && !isTestEmail(b.email))
    await recordLead(g.env, b.email, {
      event: {
        at: new Date().toISOString(),
        kind: "proofs",
        ref: g.proof.token,
        note: g.proof.deliveredAt ? `${g.proof.name}, finals` : g.proof.name,
      },
      name,
    });
  // An address coming back gets its own picks; once sent, everyone sees what was sent.
  return json({ picks: g.proof.submittedAt ? g.proof.selects : (next.viewers?.[viewerKey(b.email)]?.picks ?? []) });
}

/** POST send: the picks, through Checkout when there are extras, or `{confirm}` to check that Checkout session on the way back. */
export async function send(token: string, request: Request, b: Record<string, unknown>) {
  const g = await load(token, request);
  if (!g) return json({ error: "This gallery closed." }, 404);
  if (g instanceof Response) return g;
  const slow = await limited(g.env.PUBLIC_WRITE_LIMIT, "picks", request);
  if (slow) return slow;
  if (g.proof.submittedAt) return json({ done: true, ...publicView(g.proof) });
  const key = g.env.STRIPE_SECRET_KEY;

  if (typeof b.confirm === "string") {
    if (!key) return json({ error: PAYMENTS_OFF }, 503);
    const paid = await checkPaid(key, g.proof, b.confirm);
    if (paid === "down") return json({ error: PAYMENTS_DOWN }, 502);
    if (!paid) return json({ error: "That payment did not go through." }, 402);
    return json({ done: true, ...publicView(await finalize(g.env, g.kv, g.seal, g.proof, paid)) });
  }

  if (typeof b.email !== "string" || !isEmail(b.email)) return json({ error: "Add your email first." }, 400);
  const selects = cleanSelects(b.selects, g.proof.frames);
  if (!selects.length) return json({ error: "Select at least one frame." }, 400);
  // Notes are gone from the gallery; old ones are dropped with the send.
  const p: Proof = {
    ...withVisit(g.proof, b.email, { picks: selects }),
    selects,
    notes: {},
    message: undefined,
    submittedBy: b.email.trim(),
  };

  if (amountOwed(p).cents === 0) return json({ done: true, ...publicView(await finalize(g.env, g.kv, g.seal, p)) });
  if (!key) return json({ error: PAYMENTS_OFF }, 503);
  try {
    const c = await checkout(key, p, b.method === "card" ? "card" : "bank");
    await writeProof(g.kv, g.seal, { ...p, checkout: c.id });
    return json({ checkout: c.url });
  } catch (e) {
    return upstreamError("proof checkout", e, PAYMENTS_DOWN);
  }
}

/** The old single POST, picking the job by body shape. Kept while open tabs and older pages still call it. */
export async function legacyPost(token: string, request: Request) {
  const b = (await bodyOf(request, BODY_MAX)) ?? {};
  if (b.action === "unlock") return unlock(token, request, b.password);
  return b.action === "track" ? track(token, request, b) : send(token, request, b);
}
