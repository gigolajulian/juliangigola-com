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
 * the gallery is open. The token is the only secret: 16 random base62
 * characters, about 95 bits.
 * ─────────────────────────────────────────────────────────────── */

export type ProofFrame = {
  /** Short id, stable across publishes: the Lightroom photo's remote id. */
  id: string;
  /** The file name as Lightroom exported it, for the selects list. */
  file: string;
  w: number;
  h: number;
};

export type Proof = {
  token: string;
  /** The collection name in Lightroom: "Nov 1 portraits". Never shown to the client. */
  name: string;
  email?: string;
  /** The optional line in the email. */
  note?: string;
  included: number;
  /** Dollars per frame past `included`. */
  price: number;
  /** Days open, counted from when the email goes out (or the link is first copied). */
  days: number;
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
  paid?: { session: string; amount: number; at: string };
  /** When the client hit Send: selects are locked from here. */
  submittedAt?: string;
  views: number;
};

export const DEFAULTS = { included: 10, price: 15, days: 14 } as const;

export const proofKey = (token: string) => `proof:${token}`;
export const frameKey = (token: string, id: string) => `${token}/${id}.jpg`;

const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** 16 base62 characters from the platform's CSPRNG (rejection sampling keeps it uniform). */
export function newToken(): string {
  let out = "";
  while (out.length < 16) {
    for (const b of crypto.getRandomValues(new Uint8Array(24))) {
      if (b < 248 && out.length < 16) out += B62[b % 62];
    }
  }
  return out;
}
export const isToken = (t: unknown): t is string => typeof t === "string" && /^[0-9A-Za-z]{16}$/.test(t);
export const isFrameId = (t: unknown): t is string => typeof t === "string" && /^[0-9A-Za-z_-]{1,64}$/.test(t);

/** How many frames are past the included ones, and what they cost in dollars. */
export function extras(selected: number, included: number, price: number) {
  const n = Math.max(0, selected - included);
  return { n, dollars: n * price };
}

/** Whether the client can still see the gallery. Unsent galleries are open (Julian previews them). */
/** Extra frames still to pay for: a reopened gallery keeps what was already paid. */
export function owed(p: Pick<Proof, "selects" | "included" | "price" | "paid">) {
  const already = p.price ? Math.floor((p.paid?.amount ?? 0) / (p.price * 100)) : 0;
  const n = Math.max(0, extras(p.selects.length, p.included, p.price).n - already);
  return { n, cents: n * p.price * 100 };
}

export const isOpen = (p: Pick<Proof, "closesAt">, now = Date.now()) => !p.closesAt || Date.parse(p.closesAt) > now;

export const closesAt = (days: number, from = Date.now()) => new Date(from + days * 864e5).toISOString();

/** What the client page gets: no address, no Lightroom name. */
export function publicView(p: Proof) {
  return {
    frames: p.frames.map(({ id, file, w, h }) => ({ id, file, w, h })),
    selects: p.selects,
    notes: p.notes,
    included: p.included,
    price: p.price,
    closesAt: p.closesAt ?? null,
    submitted: !!p.submittedAt,
    paid: p.paid?.amount ?? 0,
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
export function cleanSettings(given: Record<string, unknown>): Partial<Pick<Proof, "name" | "email" | "note" | "included" | "price" | "days">> {
  const out: Partial<Pick<Proof, "name" | "email" | "note" | "included" | "price" | "days">> = {};
  const int = (v: unknown, lo: number, hi: number) => (typeof v === "number" || typeof v === "string") && Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : undefined;
  if (typeof given.name === "string" && given.name.trim()) out.name = given.name.trim().slice(0, 120);
  if (typeof given.email === "string") out.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(given.email.trim()) ? given.email.trim().slice(0, 200) : undefined;
  if (typeof given.note === "string") out.note = given.note.trim().slice(0, 600) || undefined;
  const inc = int(given.included, 0, 500), pr = int(given.price, 0, 500), d = int(given.days, 1, 90);
  if (inc !== undefined) out.included = inc;
  if (pr !== undefined) out.price = pr;
  if (d !== undefined) out.days = d;
  return out;
}

type KV = Pick<NonNullable<CloudflareEnv["INBOX"]>, "get" | "put" | "list" | "delete">;
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
