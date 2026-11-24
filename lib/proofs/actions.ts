/* The desk's gallery workflows that mail the client or move the public link: send, deliver, remind, relink.
   Server only. Each returns the new record (and what else the route answers) or the refusal with its status;
   `lib/proofs/desk-api.ts` gates, parses and answers. */

import { copiesFor, recordLead } from "@/lib/leads/lead-store";
import { aliasKey, closesAt, DELIVERY_DAYS, frameKeys, isDateId, isStrongId, publicId, remindState, type Proof } from "@/lib/proofs/proof-model";
import { nextProofId, writeProof } from "@/lib/proofs/proof-store";
import { deliveryMail, deliveryUrl, proofMail, proofUrl, reminderMail, sendClient, subjectOr } from "@/lib/proofs/proof-mail";
import { servedFrame } from "@/lib/proofs/watermark";
import type { InboxKV } from "@/lib/kv";
import { logged } from "@/lib/utils";
import type { Sealer } from "@/lib/seal";

/** What the gate opened: the Worker env, INBOX, the lead sealer and the PROOFS bucket. */
export type ProofBindings = { env: CloudflareEnv; kv: InboxKV; s: Sealer; r2: NonNullable<CloudflareEnv["PROOFS"]> };

/** A refusal: the message and the HTTP status the route answers it with. */
export type Refused = { error: string; status: number };

const NO_EMAIL: Refused = { error: "Add the client's email first.", status: 400 };
const NOT_SENT: Refused = { error: "The mail did not go out. Try again.", status: 502 };

/** R2 deletes at most 1000 keys a call. */
export async function dropKeys(r2: ProofBindings["r2"], keys: string[]) {
  for (let i = 0; i < keys.length; i += 1000) await r2.delete(keys.slice(i, i + 1000));
}

/** A mail to the client, copied to the lead's other addresses when they can be read. */
const mailClient = async (d: ProofBindings, to: string, m: Parameters<typeof sendClient>[2]) =>
  sendClient(d.env.CLIENT_EMAIL, to, m, await copiesFor(d.kv, d.s, to).catch(() => []));

/** The proof mail with the first four frames (watermarked when it is on); the clock starts. `origin` is the request url. */
export async function sendProofs(d: ProofBindings, p: Proof, subject: unknown, origin: string): Promise<{ proof: Proof } | Refused> {
  if (!p.email) return NO_EMAIL;
  if (!p.frames.length) return { error: "Publish frames from Lightroom first.", status: 400 };
  const strip = await Promise.all(
    p.frames.slice(0, 4).map(async (f) => {
      const o = await servedFrame(d.env, p, f.id, origin);
      return o ? { id: f.id, bytes: new Uint8Array(await new Response(o.body).arrayBuffer()) } : null;
    }),
  )
    .then((all) => all.filter((x) => x !== null))
    .catch(logged("proof strip", p.token));
  if (!strip) return { error: "The watermark could not be drawn. Try again.", status: 502 };
  const now = Date.now();
  const sentAt = new Date(now).toISOString();
  const sent: Proof = { ...p, sentAt, closesAt: closesAt(p.days, now) };
  const mail = proofMail(sent, strip);
  const m = { ...mail, subject: subjectOr(subject, mail.subject) };
  if (!(await mailClient(d, p.email, m))) return NOT_SENT;
  await writeProof(d.kv, d.s, sent);
  await recordLead(d.env, p.email, { event: { at: sentAt, kind: "mail", note: m.subject, mail: { to: "client", kind: "proofs" } } });
  return { proof: sent };
}

/** Send finals: the "your photos are ready" mail, /delivery/<id> open 60 days, then the proof's web copies go. */
export async function deliverFinals(d: ProofBindings, p: Proof, subject: unknown): Promise<{ proof: Proof; url: string } | Refused> {
  if (!p.email) return NO_EMAIL;
  if (!p.finals?.length) return { error: "Publish the finals from Lightroom first.", status: 400 };
  // A Nov 11 id is too short to front full-size files: the finals go out on a new shoot id and the old link closes.
  const was = publicId(p);
  const link = isStrongId(was) ? was : await nextProofId(d.kv, isDateId(was) ? was.slice(0, 8) : undefined);
  if (link !== was) await d.kv.put(aliasKey(link), p.token);
  const now = Date.now();
  const deliveredAt = new Date(now).toISOString();
  const sent: Proof = { ...p, ...(link !== p.token ? { link } : {}), deliveredAt, closesAt: closesAt(DELIVERY_DAYS, now) };
  const mail = deliveryMail(sent);
  const m = { ...mail, subject: subjectOr(subject, mail.subject) };
  if (!(await mailClient(d, p.email, m))) return NOT_SENT;
  await writeProof(d.kv, d.s, sent);
  if (link !== was && p.link) await d.kv.delete(aliasKey(p.link));
  await recordLead(d.env, p.email, { event: { at: deliveredAt, kind: "mail", note: m.subject, mail: { to: "client", kind: "finals" } } });
  // Only web copies: never an original.
  await dropKeys(d.r2, p.frames.flatMap((f) => frameKeys(p.token, f.id)));
  return { proof: sent, url: deliveryUrl(link) };
}

/** The one reminder for the gallery's stage (`remindState`), stamped before the mail so a retry never sends a second. */
export async function sendReminder(d: ProofBindings, p: Proof): Promise<{ proof: Proof } | Refused> {
  const r = remindState(p);
  if (r.state === "sent") return { error: "Already reminded for this stage.", status: 409 };
  if (r.state === "locked") return { error: "The reminder opens in the last 5 days before the gallery closes.", status: 409 };
  if (r.state !== "ready") return { error: r.why, status: 409 };
  // Unreachable today: a gallery with no email is never "ready".
  if (!p.email) return NO_EMAIL;
  // The close date stays.
  const at = new Date().toISOString();
  const stamped: Proof = { ...p, reminded: { ...p.reminded, [r.stage]: at } };
  await writeProof(d.kv, d.s, stamped);
  const m = reminderMail(p, r.stage);
  if (!(await mailClient(d, p.email, m))) {
    // Undo the stamp so he can try again. KV allows one write per key per second, so wait that out first.
    await new Promise((ok) => setTimeout(ok, 1100));
    const undone = await writeProof(d.kv, d.s, p).then(() => true, () => false);
    return undone ? NOT_SENT : { error: "The mail did not go out, and the reminder is still marked as sent. Tell Claude.", status: 502 };
  }
  await recordLead(d.env, p.email, { event: { at, kind: "mail", note: m.subject, mail: { to: "client", kind: r.stage } } });
  return { proof: stamped };
}

/** A new date id for the client's link; the old link closes. Storage stays put (R2, Stripe metadata, Lightroom's remote id). */
export async function relinkProof(d: ProofBindings, p: Proof): Promise<{ proof: Proof; url: string }> {
  const link = await nextProofId(d.kv);
  await d.kv.put(aliasKey(link), p.token);
  const next: Proof = { ...p, link };
  await writeProof(d.kv, d.s, next);
  if (p.link) await d.kv.delete(aliasKey(p.link));
  return { proof: next, url: proofUrl(link) };
}
