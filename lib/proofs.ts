/* ── client proofs ────────────────────────────────────────────────
 * Julian (2026-11-06): a Lightroom collection becomes a private gallery at
 * /proof/<token>. The client selects frames, ten are included, each extra is
 * $15 and paid through Stripe Checkout, and the selects go back to Lightroom
 * as a color label and Comments on the next Publish.
 *
 * One `proof:<token>` record per gallery in the INBOX namespace (beside the
 * `lead:` records), sealed with LEADS_KEY because it carries the client's
 * address. Frames live in the private R2 bucket `jg-proofs` under
 * `<token>/<frame id>.jpg`, served only through `/proof/<token>/f/<id>` while
 * the gallery is open. The token is the only secret. Older galleries: 16
 * random base62 characters, about 95 bits. New ones (Julian 2026-11-11) read
 * by the day they were made, Pacific: `MMDDYYYY-NN-xxxx`, a counter for that
 * day and 4 random base36 characters, about 20 bits per date and counter.
 * A renamed gallery keeps its storage token (R2 keys, Stripe metadata, the
 * Lightroom remote id) and gets a date id in `link`, found through a
 * `proofalias:<id>` key; its old public link stops.
 * ─────────────────────────────────────────────────────────────── */

import { looksLikeEmail } from "@/lib/inbox";
import type { InboxKV as KV } from "@/lib/leads/lead-store";

export type ProofFrame = {
  /** Short id, stable across publishes: the Lightroom photo's remote id. */
  id: string;
  /** The file name as Lightroom exported it, for the selects list. */
  file: string;
  w: number;
  h: number;
  /** Capture time, Unix seconds, from Lightroom. Older galleries have none: they keep upload order and no looks. */
  t?: number;
};

export type Proof = {
  /** The storage id: KV key, R2 prefix, Stripe metadata, Lightroom's remote id. Never changes. */
  token: string;
  /** The public id after a rename (`relink`): the client's link uses this, and the old token's page closes. */
  link?: string;
  /** The collection name in Lightroom: "Nov 1 portraits". Never shown to the client. */
  name: string;
  email?: string;
  /** The optional line in the email. */
  note?: string;
  included: number;
  /** Dollars per frame past `included`. */
  price: number;
  /** Dollars left on the shoot, paid with the extras at Send (Julian 2026-11-08: pay the balance to send selects). */
  balance?: number;
  /** Days open, counted from when the email goes out (or the link is first copied). */
  days: number;
  /** The "Julian Gigola" wordmark baked into every served frame (Julian 2026-11-10). On for new galleries; unset reads as off. */
  watermark?: boolean;
  /** Julian's pick for the link preview: a frame and the crop of it, in source pixels (height follows the card). Unset: the first frame, auto-cropped. */
  card?: CardCrop;
  createdAt: string;
  /** Set when the proof mail goes out; the clock starts here. */
  sentAt?: string;
  /** Close time, ISO. Unset until sent. */
  closesAt?: string;
  frames: ProofFrame[];
  /** Selected frame ids, in the order they were picked. */
  selects: string[];
  /** Per-frame notes, by frame id. */
  notes: Record<string, string>;
  /** "Anything else" on the review screen. */
  message?: string;
  /** Open Checkout session for the extras, while one is pending. */
  checkout?: string;
  /** `pending`: a bank (ACH) payment Stripe has accepted but not settled, about 4 business days; `failed`: it bounced, so `amount` no longer counts it. */
  paid?: { session: string; amount: number; at: string; pending?: boolean; failed?: boolean };
  /** When the client hit Send: selects are locked from here. */
  submittedAt?: string;
  views: number;
  /** The pipeline in /admin: first client view after sending, first select, and when Lightroom pulled the selects. */
  firstViewAt?: string;
  firstSelectAt?: string;
  pulledAt?: string;
  /** Who sent the selects: the address typed at the gate. */
  submittedBy?: string;
  /** Everyone who opened the gallery, by lowercased email (Julian 2026-11-08: any email opens it, log everything). */
  viewers?: Record<string, Viewer>;
};

export type CardCrop = { id: string; x: number; y: number; w: number };

export type ViewerEvent = { at: string; kind: "open" | "pick" | "unpick" | "review" | "pay" | "send"; id?: string; device?: string; place?: string };

export type Viewer = {
  /** The name they typed at the gate (`?proofwall=1`), latest wins. */
  name?: string;
  first: string;
  last: string;
  visits: number;
  /** Seconds with the gallery in front of them. */
  seconds: number;
  devices: string[];
  places: string[];
  /** This address's own picks, in pick order. */
  picks: string[];
  /** Milliseconds each frame was open in the lightbox or on screen, by frame id. */
  looks: Record<string, number>;
  events: ViewerEvent[];
};

/** Kept per address so a busy gallery stays well under KV's value size. */
const MAX_EVENTS = 400;

export const isEmail = (v: unknown): v is string => typeof v === "string" && v.length <= 200 && looksLikeEmail(v.trim());
/** A reserved test address (RFC 2606/6761: example.com/net/org, .test, .invalid, .example, .localhost): QA at a gallery's gate, never a client. */
export const isTestEmail = (v: string) => /@(?:[^@\s]+\.)?(?:example\.(?:com|net|org)|[^@\s]+\.(?:test|invalid|example|localhost))$/i.test(v.trim());
export const viewerKey = (email: string) => email.trim().toLowerCase();

/** "iPhone · Safari" from a user agent. shortcut: the common devices and browsers only, "Other" for the rest. */
export function device(ua: string): string {
  const d = /iPad/.test(ua) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Other";
  const b = /Edg\//.test(ua) ? "Edge" : /Firefox\/|FxiOS/.test(ua) ? "Firefox" : /Chrome\/|CriOS/.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Other";
  return `${d} · ${b}`;
}

/** One visitor's record with an event added; picks diffed into pick and unpick events. */
export function track(
  v: Viewer | undefined,
  at: string,
  e: { kind?: ViewerEvent["kind"]; picks?: string[]; looks?: Record<string, number>; seconds?: number; device?: string; place?: string; name?: string },
): Viewer {
  const base: Viewer = v ?? { first: at, last: at, visits: 0, seconds: 0, devices: [], places: [], picks: [], looks: {}, events: [] };
  const out: Viewer = { ...base, last: at, events: [...base.events], looks: { ...base.looks } };
  if (e.name) out.name = e.name;
  if (e.kind === "open") {
    out.visits += 1;
    if (e.device && !out.devices.includes(e.device)) out.devices = [...out.devices, e.device];
    if (e.place && !out.places.includes(e.place)) out.places = [...out.places, e.place];
  }
  if (e.kind) out.events.push({ at, kind: e.kind, ...(e.kind === "open" ? { device: e.device, place: e.place } : {}) });
  if (e.picks) {
    for (const id of e.picks) if (!base.picks.includes(id)) out.events.push({ at, kind: "pick", id });
    for (const id of base.picks) if (!e.picks.includes(id)) out.events.push({ at, kind: "unpick", id });
    out.picks = e.picks;
  }
  // Beacons are capped so a stuck tab cannot claim hours.
  if (e.seconds) out.seconds += Math.min(120, Math.max(0, Math.round(e.seconds)));
  for (const [id, ms] of Object.entries(e.looks ?? {})) if (typeof ms === "number" && ms > 0) out.looks[id] = (out.looks[id] ?? 0) + Math.min(120_000, Math.round(ms));
  out.events = out.events.slice(-MAX_EVENTS);
  return out;
}

export const STAGES = ["Draft", "Sent", "Opened", "Selecting", "Selects in", "Paid", "In Lightroom"] as const;
export type ProofStage = (typeof STAGES)[number];

/** How far a gallery has got. "Paid" only counts when there were extras to pay for. */
export function stage(p: Pick<Proof, "sentAt" | "firstViewAt" | "firstSelectAt" | "submittedAt" | "paid" | "pulledAt">): ProofStage {
  if (p.pulledAt) return "In Lightroom";
  if (p.submittedAt) return p.paid ? "Paid" : "Selects in";
  if (p.firstSelectAt) return "Selecting";
  if (p.firstViewAt) return "Opened";
  return p.sentAt ? "Sent" : "Draft";
}

export const DEFAULTS = { included: 10, price: 15, days: 14, watermark: true } as const;

export const proofKey = (token: string) => `proof:${token}`;
export const aliasKey = (id: string) => `proofalias:${id}`;
/** The id the client's link carries. */
export const publicId = (p: Pick<Proof, "token" | "link">) => p.link ?? p.token;
export const frameKey = (token: string, id: string) => `${token}/${id}.jpg`;
/** The watermarked copy beside the clean original. The version bumps when the mark changes, so old bakes are never served. */
export const markedKey = (token: string, id: string) => `${token}/${id}.wm1.jpg`;
/** The link-preview card made from a gallery's first frame. Keyed by that frame, so a new first frame gets a new card. */
export const cardKey = (token: string, id: string) => `${token}/card-${id}.v1.jpg`;
/** The smaller copy the gate's wall and the grid show (`?w=` on a frame's URL), clean or marked: a phone decoding fifty
    full-size frames at once lagged (Julian 2026-11-10). Made once by Cloudflare Images, then read from R2. */
export const THUMB_W = 800;
export const thumbKey = (token: string, id: string, marked: boolean) => `${token}/${id}.t${THUMB_W}${marked ? ".wm1" : ""}.jpg`;
/** Every derived file a frame can have in R2, for deletes. */
export const frameKeys = (token: string, id: string) => [frameKey(token, id), markedKey(token, id), cardKey(token, id), thumbKey(token, id, true), thumbKey(token, id, false)];

const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** 16 base62 characters from the platform's CSPRNG (rejection sampling keeps it uniform). Older galleries only; new ones get `proofId`. */
export function newToken(): string {
  let out = "";
  while (out.length < 16) {
    for (const b of crypto.getRandomValues(new Uint8Array(24))) {
      if (b < 248 && out.length < 16) out += B62[b % 62];
    }
  }
  return out;
}
const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";
/** 4 base36 characters, uniform: the part of a date id nobody can guess. */
export function tail(): string {
  let out = "";
  while (out.length < 4) {
    for (const b of crypto.getRandomValues(new Uint8Array(8))) {
      if (b < 252 && out.length < 4) out += B36[b % 36];
    }
  }
  return out;
}
/** `MMDDYYYY` for a moment, in Pacific time. */
export const proofDay = (t: Date | number = new Date()) => {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(t).split("-");
  return `${m}${d}${y}`;
};
const DATE_ID = /^(\d{8})-(\d{2})-[0-9a-z]{4}$/;
/** `MMDDYYYY-NN-xxxx`: the next free counter for that day among `taken` ids (storage tokens and aliases). shortcut: caps at 99 a day, widen the counter if that is ever reached. */
export function proofId(day: string, taken: Iterable<string>, rand = tail()): string {
  let n = 0;
  for (const t of taken) {
    const m = DATE_ID.exec(t);
    if (m && m[1] === day) n = Math.max(n, Number(m[2]));
  }
  if (n >= 99) throw new Error("99 galleries on one day already.");
  return `${day}-${String(n + 1).padStart(2, "0")}-${rand}`;
}
export const isDateId = (t: unknown): t is string => typeof t === "string" && DATE_ID.test(t);
/** Either format, nothing looser: the random part is the only secret. */
export const isToken = (t: unknown): t is string => typeof t === "string" && (/^[0-9A-Za-z]{16}$/.test(t) || DATE_ID.test(t));
export const isFrameId = (t: unknown): t is string => typeof t === "string" && /^[0-9A-Za-z_-]{1,64}$/.test(t);

/** How many frames are past the included ones, and what they cost in dollars. */
export function extras(selected: number, included: number, price: number) {
  const n = Math.max(0, selected - included);
  return { n, dollars: n * price };
}

/** Whether the client can still see the gallery. Unsent galleries are open (Julian previews them). */
/**
 * The card price for what bank pays in full: Stripe's card fee (2.9% + 30c) on top, rounded up to the dollar,
 * so Julian keeps at least the bank amount either way. Shown as the list price; bank is the discount
 * (Julian 2026-11-09). A discount for another way to pay is allowed in California; a card surcharge is not safe.
 */
export const cardPrice = (cents: number) => (cents > 0 ? Math.ceil((cents + 30) / 0.971 / 100) * 100 : 0);

/** What is still to pay at Send: the shoot balance first, then extra frames. A reopened gallery keeps what was already paid. */
export function owed(p: Pick<Proof, "selects" | "included" | "price" | "paid" | "balance">) {
  let left = p.paid?.amount ?? 0;
  const bal = Math.max(0, (p.balance ?? 0) * 100 - left);
  left = Math.max(0, left - (p.balance ?? 0) * 100);
  const already = p.price ? Math.floor(left / (p.price * 100)) : 0;
  const n = Math.max(0, extras(p.selects.length, p.included, p.price).n - already);
  return { n, balance: bal, cents: bal + n * p.price * 100 };
}

export const isOpen = (p: Pick<Proof, "closesAt">, now = Date.now()) => !p.closesAt || Date.parse(p.closesAt) > now;

/** The gallery's cover for link previews: its first frame, the site's rule for every set. Only when watermarked and open, so a preview never carries a clean file. */
export const coverFrame = (p: Pick<Proof, "frames" | "watermark" | "closesAt" | "card">): ProofFrame | null =>
  (p.watermark && isOpen(p) && (p.frames.find((f) => f.id === p.card?.id) ?? p.frames[0])) || null;

export const closesAt = (days: number, from = Date.now()) => new Date(from + days * 864e5).toISOString();

/** What the client page gets: no address, no Lightroom name. */
/** Frames by capture time when every frame has one, else as uploaded (a frame published later went to the end). */
export function shotOrder<F extends { t?: number }>(frames: F[]): F[] {
  return frames.every((f) => f.t) ? [...frames].sort((a, b) => a.t! - b.t!) : frames;
}

/** Where each look starts, by index into frames in shot order: a gap of `gap` seconds starts a new one. Empty with no times or one look. */
export function lookStarts(frames: { t?: number }[], gap = 600): number[] {
  if (!frames.length || !frames.every((f) => f.t)) return [];
  const out = [0];
  for (let i = 1; i < frames.length; i++) if (frames[i].t! - frames[i - 1].t! > gap) out.push(i);
  return out.length > 1 ? out : [];
}

export function publicView(p: Proof) {
  return {
    // No file name: Lightroom names are Julian's, the client sees proof numbers.
    frames: p.frames.map(({ id, w, h, t }) => (t ? { id, w, h, t } : { id, w, h })),
    // Picks belong to whoever typed their email; only the sent ones are shared.
    selects: p.submittedAt ? p.selects : [],
    included: p.included,
    price: p.price,
    balance: p.balance ?? 0,
    closesAt: p.closesAt ?? null,
    submitted: !!p.submittedAt,
    paid: p.paid?.amount ?? 0,
    paidPending: !!p.paid?.pending,
  };
}
export type PublicProof = ReturnType<typeof publicView>;

/** The client's selects, kept to frames that exist, deduped, in pick order. */
export function cleanSelects(given: unknown, frames: ProofFrame[]): string[] {
  if (!Array.isArray(given)) return [];
  const ids = new Set(frames.map((f) => f.id));
  return [...new Set(given.filter((x): x is string => typeof x === "string" && ids.has(x)))];
}

/** Notes kept to selected frames, trimmed, 500 characters each. */
export function cleanNotes(given: unknown, selects: string[]): Record<string, string> {
  if (!given || typeof given !== "object") return {};
  const out: Record<string, string> = {};
  for (const id of selects) {
    const v = (given as Record<string, unknown>)[id];
    if (typeof v === "string" && v.trim()) out[id] = v.trim().slice(0, 500);
  }
  return out;
}

/** Settings Lightroom or /admin may set. Numbers are clamped so a typo cannot price a frame at $15,000. */
type Settings = Partial<Pick<Proof, "name" | "email" | "note" | "included" | "price" | "days" | "balance" | "watermark" | "card">>;
export function cleanSettings(given: Record<string, unknown>): Settings {
  const out: Settings = {};
  const int = (v: unknown, lo: number, hi: number) => (typeof v === "number" || typeof v === "string") && Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : undefined;
  if (typeof given.name === "string" && given.name.trim()) out.name = given.name.trim().slice(0, 120);
  if (typeof given.email === "string") out.email = looksLikeEmail(given.email.trim()) ? given.email.trim().slice(0, 200) : undefined;
  if (typeof given.note === "string") out.note = given.note.trim().slice(0, 600) || undefined;
  const inc = int(given.included, 0, 500), pr = int(given.price, 0, 500), d = int(given.days, 1, 90);
  if (inc !== undefined) out.included = inc;
  if (pr !== undefined) out.price = pr;
  if (d !== undefined) out.days = d;
  const bal = int(given.balance, 0, 20000);
  if (bal !== undefined) out.balance = bal;
  // Lightroom's checkbox and the desk send a boolean; a form field may send "true"/"false".
  // The preview pick: {id, x, y, w} in source pixels, or null to go back to the first frame.
  if (given.card === null) out.card = undefined;
  else if (given.card && typeof given.card === "object") {
    const c = given.card as Record<string, unknown>, x = int(c.x, 0, 20000), y = int(c.y, 0, 20000), w = int(c.w, 50, 20000);
    if (isFrameId(c.id) && x !== undefined && y !== undefined && w !== undefined) out.card = { id: c.id, x, y, w };
  }
  if (typeof given.watermark === "boolean" || given.watermark === "true" || given.watermark === "false") out.watermark = given.watermark === true || given.watermark === "true";
  return out;
}

type Seal = { seal(v: unknown): Promise<string>; open<T>(s: string): Promise<T> };

export async function readProof(kv: KV, s: Seal, token: string): Promise<Proof | null> {
  const raw = await kv.get(proofKey(token));
  if (!raw) return null;
  try {
    return await s.open<Proof>(raw);
  } catch {
    return null;
  }
}

/** A gallery by its storage token or a renamed gallery's date id. Frames and cards read this, so the desk's thumbnails keep working. */
export async function findProof(kv: KV, s: Seal, id: string): Promise<Proof | null> {
  const p = await readProof(kv, s, id);
  if (p) return p;
  const token = isDateId(id) ? await kv.get(aliasKey(id)) : null;
  return token ? readProof(kv, s, token) : null;
}
/** The gallery a client link opens: only by its public id, so a renamed gallery's old link closes. */
export async function readPublic(kv: KV, s: Seal, id: string): Promise<Proof | null> {
  const p = await findProof(kv, s, id);
  return p && publicId(p) === id ? p : null;
}
/** A new date id for today, past every gallery and alias already made today. shortcut: two creates in the same instant can take the same counter; the random tail still keeps the ids apart. */
export async function nextProofId(kv: KV, now: Date | number = new Date()): Promise<string> {
  const day = proofDay(now);
  const taken: string[] = [];
  for (const prefix of [`proof:${day}-`, `proofalias:${day}-`]) {
    let cursor: string | undefined;
    do {
      const page = await kv.list({ prefix, cursor });
      for (const k of page.keys) taken.push(k.name.slice(k.name.indexOf(":") + 1));
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  }
  return proofId(day, taken);
}

/** Listed with a small summary in metadata so the desk never opens every record. */
export async function writeProof(kv: KV, s: Seal, p: Proof): Promise<void> {
  await kv.put(proofKey(p.token), await s.seal(p), {
    metadata: { name: p.name.slice(0, 80), frames: p.frames.length, selects: p.selects.length, sentAt: p.sentAt ?? null, submittedAt: p.submittedAt ?? null, closesAt: p.closesAt ?? null },
  });
}

export type ProofSummary = { token: string; name: string; frames: number; selects: number; sentAt: string | null; submittedAt: string | null; closesAt: string | null };

export async function listProofs(kv: KV): Promise<ProofSummary[]> {
  const out: ProofSummary[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list<Omit<ProofSummary, "token">>({ prefix: "proof:", cursor });
    for (const k of page.keys) if (k.metadata) out.push({ token: k.name.slice(6), ...k.metadata });
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out;
}
