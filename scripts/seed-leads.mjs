/* Example leads in the local INBOX, for working on the lead desk in
 * `next dev` (/admin/leads). Writes only to wrangler's local state
 * (.wrangler/), never to the real namespace. Names are made up. Sealed
 * like the real ones (`lib/lead-crypto.ts`), with LEADS_KEY from .dev.vars.
 *
 *   node scripts/seed-leads.mjs
 */
import { getPlatformProxy } from "wrangler";

const { env, dispose } = await getPlatformProxy();
if (!env.LEADS_KEY) throw new Error("Put a LEADS_KEY (32 random bytes, base64) in .dev.vars first.");

// The same two derived keys as lib/lead-crypto.ts.
const enc = new TextEncoder();
const raw = Uint8Array.from(atob(env.LEADS_KEY.trim()), (c) => c.charCodeAt(0));
const derive = async (label) => new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array([...enc.encode(label), ...raw])));
const aes = await crypto.subtle.importKey("raw", await derive("jg-leads:seal"), "AES-GCM", false, ["encrypt"]);
const mac = await crypto.subtle.importKey("raw", await derive("jg-leads:id"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
const b64 = (u) => btoa(String.fromCharCode(...u));
const seal = async (v) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return `${b64(iv)}.${b64(new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, enc.encode(JSON.stringify(v)))))}`;
};
const idOf = async (email) => [...new Uint8Array(await crypto.subtle.sign("HMAC", mac, enc.encode(email))).slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");

for (const { name } of (await env.INBOX.list({ prefix: "lead:" })).keys) await env.INBOX.delete(name);
const H = 3600e3;
const ago = (h) => new Date(Date.now() - h * H).toISOString();
const ahead = (h) => new Date(Date.now() + h * H).toISOString();

const lead = (o) => ({ unread: false, flags: undefined, ...o, firstAt: o.firstAt ?? o.stageAt, lastAt: o.lastAt ?? o.stageAt });
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const summary = ({ events, notion, deposit, ...rest }) => ({ ...rest, ...(deposit ? { paid: true } : {}) });

const mayaKey = `msg:${String(Date.now() - 26 * H).padStart(15, "0")}:seed0001`;
const leads = [
  lead({ email: "maya.okafor@example.com", name: "Maya Okafor", stage: "Inquiry", stageAt: ago(26), kind: "portrait", unread: true, refs: 2, snippet: "Hi Julian, I saw the Portraits set and want something like the red-lit frames. Two of us,",
    events: [{ at: ago(26), kind: "inquiry", ref: mayaKey, note: "portrait" }, { at: ago(26), kind: "mail", note: "Portrait inquiry · Maya Okafor · A weekend before Dec 14", mail: { to: "hello@", kind: "inquiry" } }] }),
  lead({ email: "priya.shah@example.com", name: "Priya Shah", stage: "Inquiry", stageAt: ago(3), kind: "headshots", flags: ["stuck"],
    events: [{ at: ago(3), kind: "deposit-stuck", ref: "pi_seed1", note: "Headshots, Sat 10:00 AM, $100" }, { at: ago(3), kind: "mail", note: "Deposit stuck: check Stripe and Cal.com", mail: { to: "hello@", kind: "deposit-stuck" } }] }),
  lead({ email: "lena.park@example.com", name: "Lena Park", stage: "Quoted", stageAt: ago(6 * 24), firstAt: ago(9 * 24), kind: "campaign", snippet: "Thanks, sharing the quote with the brand team this week.",
    events: [{ at: ago(9 * 24), kind: "inquiry", note: "campaign" }, { at: ago(8 * 24), kind: "stage", note: "Replied" }, { at: ago(6 * 24), kind: "stage", note: "Quoted" }] }),
  lead({ email: "daniel.reyes@example.com", name: "Daniel Reyes", stage: "Call booked", stageAt: ago(5), kind: "intro-call", when: ahead(44), unread: true,
    events: [{ at: ago(5), kind: "call", ref: "cal-seed1", note: "Intro call" }, { at: ago(5), kind: "mail", note: "Booked: Intro call", mail: { to: "client", kind: "confirm" } }] }),
  lead({ email: "sofia.marin@example.com", name: "Sofia Marin", stage: "Confirmed", stageAt: ago(30), kind: "headshots", when: ahead(100), deposit: "https://dashboard.stripe.com/test/payments/pi_seed2",
    events: [{ at: ago(30), kind: "booking", ref: "cal-seed2", note: "Headshots" }, { at: ago(30), kind: "mail", note: "Booked: Headshots", mail: { to: "client", kind: "confirm" } }] }),
  lead({ email: "noor.haddad@example.com", name: "Noor Haddad", stage: "Shot", stageAt: ago(50), firstAt: ago(20 * 24), kind: "graduation",
    events: [{ at: ago(20 * 24), kind: "booking", note: "Graduation" }, { at: ago(50), kind: "stage", note: "Shot" }] }),
  lead({ email: "camille.roy@example.com", name: "Camille Roy", stage: "Replied", stageAt: ago(7 * 24), kind: "editorial", snoozeUntil: ahead(60), refs: 3, snippet: "Moodboard attached, open to a night shoot downtown.",
    events: [{ at: ago(8 * 24), kind: "inquiry", note: "editorial" }, { at: ago(7 * 24), kind: "stage", note: "Replied" }] }),
  lead({ email: "theo.brandt@example.com", name: "Theo Brandt", stage: "Lost", stageAt: ago(12 * 24), kind: "event",
    events: [{ at: ago(14 * 24), kind: "inquiry", note: "event" }, { at: ago(12 * 24), kind: "stage", note: "Lost" }] }),
];

for (const l of leads) {
  for (const k of Object.keys(l)) if (l[k] === undefined) delete l[k];
  await env.INBOX.put(`lead:${await idOf(l.email)}`, await seal(l), { metadata: { s: await seal(summary(l)) } });
}
const maya = {
  id: "seed0001", at: ago(26), type: "portrait", name: "Maya Okafor", email: "maya.okafor@example.com", read: false,
  detail: "A weekend before Dec 14, studio or East Bay",
  message: "Hi Julian, I saw the Portraits set and want something like the red-lit frames. Two of us, before mid December if you have a weekend. Happy to come to the studio.",
  context: { referrer: "instagram.com", landing: "/portfolio/portraits" },
  files: ["mood-1.jpg", "mood-2.jpg"],
  picks: ["/work/abril/02.jpg"],
};
// Two uploads, as the form stores them beside the row (stand-ins from public/work).
const { readFile } = await import("node:fs/promises");
for (const [n, src] of ["public/work/aegis/01.jpg", "public/work/accomplice/01.jpg"].entries())
  await env.INBOX.put(`ref:${mayaKey}:${n}`, await readFile(src), { metadata: { type: "image/jpeg", name: maya.files[n] } });
await env.INBOX.put(mayaKey, JSON.stringify(maya), { metadata: { id: maya.id, at: maya.at, type: maya.type, name: maya.name, email: maya.email, read: false } });
console.log(`seeded ${leads.length} leads`);
await dispose();
