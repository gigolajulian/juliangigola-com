/* KV reads and writes for proof galleries and the gate's password: server only.
   The record's shape and the pure helpers live in `proof-model.ts`. */

import type { InboxKV as KV } from "@/lib/kv";
import type { Seal } from "@/lib/seal";
import { type Proof, aliasKey, isDateId, isOpen, proofDay, proofKey, publicId, shootIdTag } from "@/lib/proofs/proof-model";

/* ── the gate's password ──────────────────────────────────────────
   PBKDF2-SHA256, 100,000 rounds (the most Workers allows) and a random salt. A right password sets an HttpOnly
   cookie: an HMAC of the gallery and its hash under LEADS_KEY, so a new password, or none, ends every old cookie. */
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const enc = (s: string) => new TextEncoder().encode(s);
async function pbkdf2(pw: string, salt: Uint8Array<ArrayBuffer>) {
  const k = await crypto.subtle.importKey("raw", enc(pw), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 }, k, 256));
}
export async function hashPass(pw: string): Promise<NonNullable<Proof["pass"]>> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64(salt), hash: b64(await pbkdf2(pw, salt)) };
}
export async function checkPass(pass: NonNullable<Proof["pass"]>, pw: string): Promise<boolean> {
  const a = await pbkdf2(pw, unb64(pass.salt)), b = unb64(pass.hash);
  let d = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ (b[i] ?? 0);
  return d === 0;
}
export const passCookie = (p: Pick<Proof, "token" | "link">) => `gp_${publicId(p)}`;
const hmacKey = (secret: string) => crypto.subtle.importKey("raw", enc(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
const passMsg = (p: Pick<Proof, "token" | "pass">) => enc(`${p.token}:${p.pass?.hash}`);
export const passValue = async (p: Pick<Proof, "token" | "pass">, secret: string) => b64(await crypto.subtle.sign("HMAC", await hmacKey(secret), passMsg(p)));
/** No password, or the request's cookie (the raw Cookie header) carries this gallery's current one. */
export async function passOk(p: Pick<Proof, "token" | "link" | "pass">, cookie: string | null | undefined, secret: string | undefined): Promise<boolean> {
  if (!p.pass) return true;
  const name = passCookie(p);
  const v = cookie?.split(/;\s*/).find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!v || !secret) return false;
  try {
    return await crypto.subtle.verify("HMAC", await hmacKey(secret), unb64(v), passMsg(p));
  } catch {
    return false;
  }
}
/** Why a client cannot see a gallery right now, or null when they can. Closed is the clock (or a missing gallery). */
export async function shutReason(p: Proof | null, cookie: string | null | undefined, secret: string | undefined): Promise<"closed" | "offline" | "locked" | null> {
  if (!p) return "closed";
  if (p.offline) return "offline";
  if (!isOpen(p)) return "closed";
  return (await passOk(p, cookie, secret)) ? null : "locked";
}
/** A gallery as the desk gets it: never the password hash. */
export function forDesk<T extends Proof>(p: T): Omit<T, "pass"> & { hasPass: boolean } {
  const { pass, ...rest } = p;
  return { ...rest, hasPass: !!pass };
}


/** One gallery, opened. Null when it is not there; throws when it cannot be opened (a rotated LEADS_KEY), like `readLead` and `readContract`. */
export async function readProof(kv: KV, s: Seal, token: string): Promise<Proof | null> {
  const raw = await kv.get(proofKey(token));
  return raw ? s.open<Proof>(raw) : null;
}

/** A gallery by its storage token or a renamed gallery's date id. */
export async function findProof(kv: KV, s: Seal, id: string): Promise<Proof | null> {
  const p = await readProof(kv, s, id);
  if (p) return p;
  const token = isDateId(id) ? await kv.get(aliasKey(id)) : null;
  return token ? readProof(kv, s, token) : null;
}
/** The gallery a link opens (page, frames, card): only by its public id, so a renamed gallery's old link closes. */
export async function readPublic(kv: KV, s: Seal, id: string): Promise<Proof | null> {
  const p = await findProof(kv, s, id);
  return p && publicId(p) === id ? p : null;
}
/** A new shoot id: the shoot day Lightroom sent, else today in Pacific, and a tag no gallery or alias has. */
export async function nextProofId(kv: KV, day: string = proofDay()): Promise<string> {
  for (;;) {
    const id = `${day}-${shootIdTag()}`;
    if (!(await kv.get(proofKey(id))) && !(await kv.get(aliasKey(id)))) return id;
  }
}

/** Listed with a small summary in metadata so the desk never opens every record. */
export async function writeProof(kv: KV, s: Seal, p: Proof): Promise<void> {
  await kv.put(proofKey(p.token), await s.seal(p), {
    metadata: { name: p.name.slice(0, 80), frames: p.frames.length, selects: p.selects.length, sentAt: p.sentAt ?? null, submittedAt: p.submittedAt ?? null, closesAt: p.closesAt ?? null },
  });
}

export type ProofSummary = { token: string; name: string; frames: number; selects: number; sentAt: string | null; submittedAt: string | null; closesAt: string | null };

/** Its own paging, not `everyKey`: `lib/kv.ts` loads OpenNext, which the delivery downloads in `worker.ts` must not. */
export async function listProofs(kv: KV): Promise<ProofSummary[]> {
  const prefix = proofKey("");
  const out: ProofSummary[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list<Omit<ProofSummary, "token">>({ prefix, cursor });
    for (const k of page.keys) if (k.metadata) out.push({ token: k.name.slice(prefix.length), ...k.metadata });
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out;
}
