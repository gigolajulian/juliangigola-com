import { sealer, type Sealer } from "./lead-crypto";
import { notify, pushFor } from "./lead-push";
import type { Invoice } from "./invoice";

/* ── leads: one record per person ─────────────────────────────────
 * Julian (2026-11-03, PLAN-lead-desk.md): every inquiry, call and booking
 * in one list, with a stage on each person. Until now one person who
 * wrote, then booked a call, then paid was two or three unrelated rows.
 *
 * So beside the raw rows (`msg:`, still written first and kept as the
 * log) the INBOX namespace holds one `lead:<id>` per person, sealed with
 * LEADS_KEY (`lib/lead-crypto.ts`). Each event
 * that reaches the site (the form, a Cal.com booking, a deposit in
 * trouble) is folded into it here. KV is the source of truth; Notion is a
 * mirror of it, never the other way.
 *
 * Automatic events only move a lead forward: a second inquiry from a
 * client already Confirmed must not drop them back to Inquiry. A new
 * inquiry from someone Delivered or Lost opens them again. Julian moves
 * the rest by hand (Replied, Quoted, Shot, Invoiced, Selecting, Delivered, Lost).
 *
 * The record's summary rides sealed in KV metadata, so the list costs one
 * request. Pure functions here; `recordLead` is the one place
 * that touches the binding, and it never throws: the raw row is already
 * stored, and a lead that failed to update must not fail the form.
 * ─────────────────────────────────────────────────────────────── */

export const STAGES = ["Inquiry", "Replied", "Call booked", "Quoted", "Confirmed", "Shot", "Invoiced", "Selecting", "Delivered", "Lost"] as const;
export type Stage = (typeof STAGES)[number];

/** What happened, as it reached the site. `stage` is Julian's own move. */
export type LeadEvent = {
  at: string;
  kind: "inquiry" | "call" | "booking" | "no-deposit" | "deposit-stuck" | "stage" | "snooze" | "mail" | "replied" | "wrote" | "archive" | "trash"
    // Julian's own hand (`lib/lead-crm.ts`): added, details changed, merged, a reminder, a quote.
    | "added" | "edit" | "merge" | "remind" | "quote" | "invoice";
  /* "replied" / "wrote": mail between hello@ and them in Gmail, ref = the Gmail message id (`lib/gmail-sync.ts`). */
  /** The raw row (`msg:` key), Cal.com uid or Stripe intent, so a retry folds in once. */
  ref?: string;
  /** Booking time, session, new stage, a mail's subject: a short line for the timeline. */
  note?: string;
  /** Kind "mail": who it went to, which mail, and the booking it was about. */
  mail?: Sent;
};

/** A mail the site sent about this person: to them (book@), or about them to hello@. */
export type Sent = { to: "client" | "hello@"; kind: string; booking?: string };

/** Contract and model release, tracked from Confirmed on. */
export const PAPER = ["Not sent", "Sent", "Signed", "Not needed"] as const;
export type Paper = (typeof PAPER)[number];

/** Something on the lead that needs him, beyond its stage. */
export type Flag = "stuck" | "no-deposit";

export type Lead = {
  email: string;
  name: string;
  stage: Stage;
  /** When the stage last changed: the late check counts from here. */
  stageAt: string;
  firstAt: string;
  lastAt: string;
  /** Form type or Cal.com slug of the latest event that had one. */
  kind?: string;
  /** Next session or call, ISO. */
  when?: string;
  /** Stripe dashboard link of a deposit paid for this person. */
  deposit?: string;
  flags?: Flag[];
  snoozeUntil?: string;
  /** Set aside by Julian: out of every list but Archived. A new message brings it back. */
  archivedAt?: string;
  /** In the trash: out of every list but Trash, until he recovers it or empties the trash. */
  trashedAt?: string;
  /** Notion page this lead is mirrored to. */
  notion?: string;
  /** Something new since he last opened it. */
  unread: boolean;
  /** The start of their latest message, for the list row. */
  snippet?: string;
  /** Pictures they attached to it. */
  refs?: number;
  /** Where they first came from: the referring site, "Booking page", or what he typed. */
  source?: string;
  /** His own: private notes, a reminder, contact details, the quote and why it was lost. */
  notes?: string;
  remind?: { at: string; text: string };
  phone?: string;
  ig?: string;
  company?: string;
  /** Quoted price in dollars. */
  quote?: number;
  lostReason?: string;
  /** Paperwork for the shoot; unset reads as Not sent. */
  contract?: Paper;
  release?: Paper;
  /** Invoices made from this lead (`lib/invoice.ts`), oldest first. */
  invoices?: Invoice[];
  /** Opt-in, for commercial work: what the photos may be used for, and the day that ends (YYYY-MM-DD). */
  licence?: Licence;
  events: LeadEvent[];
};

export type Licence = { use: string; end: string };

/** What the list shows, sealed into KV metadata (under its 1024-byte cap). `id` is added when listed. */
export type LeadSummary = Omit<Lead, "events" | "notion" | "deposit" | "notes" | "remind" | "phone" | "ig" | "company" | "lostReason" | "source" | "invoices"> & {
  paid?: true;
  id?: string;
  /** When his reminder is due, and its words, cut short. */
  due?: string;
  dueText?: string;
  /** A quote's follow-ups, from the timeline: see `quoteTrail`. */
  quiet?: QuoteTrail;
};

/** Events kept per lead: the timeline needs the recent ones, KV values stay small. */
const KEEP = 50;

/** A lead's KV key: its id (an HMAC of the address, `lib/lead-crypto.ts`), never the address. */
export const leadKey = (id: string) => `lead:${id}`;

const rank = (s: Stage) => STAGES.indexOf(s);
const closed = (s: Stage) => s === "Delivered" || s === "Lost";

/** The stage an automatic event asks for, or none. */
const asks: Partial<Record<LeadEvent["kind"], Stage>> = {
  inquiry: "Inquiry",
  call: "Call booked",
  booking: "Confirmed",
};

export type Change = {
  event: LeadEvent;
  name?: string;
  kind?: string;
  when?: string;
  deposit?: string;
  flag?: Flag;
  /** Julian's own stage move (kind "stage"): any direction. */
  stage?: Stage;
  /** Kind "snooze": ISO time, or "" to wake it. */
  snoozeUntil?: string;
  /** Kind "archive" / "trash": in (true) or back out (false). */
  on?: boolean;
  /** An inquiry's message and how many pictures came with it. */
  snippet?: string;
  refs?: number;
  /** Where they came from; only the first one sticks. */
  source?: string;
};

/** One event folded into a lead. Returns the lead unchanged when the event
    was already folded in (a webhook retry carries the same ref). */
export function fold(lead: Lead | null, email: string, c: Change): Lead {
  const { event } = c;
  if (lead && event.ref && lead.events.some((e) => e.kind === event.kind && e.ref === event.ref)) return lead;

  const base: Lead = lead ?? {
    email: email.trim().toLowerCase(),
    name: c.name || email,
    stage: "Inquiry",
    stageAt: event.at,
    firstAt: event.at,
    lastAt: event.at,
    unread: true,
    events: [],
  };
  const next: Lead = { ...base, events: [...base.events, event].slice(-KEEP) };

  if (event.kind === "stage" && c.stage) {
    if (c.stage !== next.stage) Object.assign(next, { stage: c.stage, stageAt: event.at });
    // A stage he set clears what it answers.
    if (c.stage !== "Confirmed") next.flags = next.flags?.filter((f) => f !== "no-deposit");
    return tidy(next);
  }
  // A mail the site sent is a line on the timeline, not news.
  if (event.kind === "mail") return tidy(next);
  // His own reply from Gmail answers the inquiry: Replied, and off Needs me.
  if (event.kind === "replied") {
    if (next.stage === "Inquiry") Object.assign(next, { stage: "Replied", stageAt: event.at });
    return tidy({ ...next, unread: false });
  }
  if (event.kind === "snooze") {
    next.snoozeUntil = c.snoozeUntil || undefined;
    // Unsnoozed by hand: back under Needs me.
    if (!c.snoozeUntil) next.unread = true;
    return tidy(next);
  }

  if (event.kind === "archive") return tidy({ ...next, archivedAt: c.on ? event.at : undefined });
  if (event.kind === "trash") return tidy({ ...next, trashedAt: c.on ? event.at : undefined });

  // Something arrived from outside: it is news, and out of Archived. The
  // trash keeps it: what he threw out (spam, mostly) stays there.
  Object.assign(next, { lastAt: event.at, unread: true, snoozeUntil: undefined, archivedAt: undefined });
  if (c.name && (!lead || next.name === next.email)) next.name = c.name;
  if (c.kind) next.kind = c.kind;
  if (c.when) next.when = c.when;
  if (c.deposit) next.deposit = c.deposit;
  if (c.flag && !next.flags?.includes(c.flag)) next.flags = [...(next.flags ?? []), c.flag];
  if (c.snippet !== undefined) Object.assign(next, { snippet: c.snippet.replace(/\s+/g, " ").trim().slice(0, 140), refs: c.refs });
  if (c.source && !next.source) next.source = c.source.slice(0, 40);

  const want = asks[event.kind];
  if (want && (rank(want) > rank(next.stage) || (want === "Inquiry" && closed(next.stage)) || !lead)) {
    Object.assign(next, { stage: want, stageAt: event.at });
  }
  return tidy(next);
}

const tidy = (l: Lead): Lead => {
  if (!l.flags?.length) delete l.flags;
  if (!l.snoozeUntil) delete l.snoozeUntil;
  if (!l.archivedAt) delete l.archivedAt;
  if (!l.trashedAt) delete l.trashedAt;
  if (!l.snippet) delete l.snippet;
  if (!l.refs) delete l.refs;
  return l;
};

/** Julian: "yes, empty trash after 30 days". Days a lead keeps in the trash. */
export const TRASH_DAYS = 30;
/** Whole days before a trashed lead is deleted for good; 0 or less means due. */
export const trashDaysLeft = (trashedAt: string, now: number) => Math.ceil((Date.parse(trashedAt) + TRASH_DAYS * 864e5 - now) / 864e5);

/** Hours Julian promises to answer in; the site says "within a day". */
export const REPLY_HOURS = 24;
/** Days of silence after a quote before each nudge: a check-in, something useful, a polite close. */
export const NUDGE_DAYS = [3, 7, 14];
export const NUDGES = ["Nudge 1", "Nudge 2", "Last nudge"] as const;
/** Quiet days after the last nudge before he is asked whether it is lost. Never automatic. */
export const LOST_DAYS = 7;
const DAY = 864e5;

/** Since when a quote has been waiting, and the nudges he has sent since. */
export type QuoteTrail = { from: string; n: number; last?: string };

/** Counted from the timeline, not stored: silence starts at the quote or at their latest mail,
    and his mails a day or more after that are nudges (sooner is the quote itself, or his answer). */
export function quoteTrail(l: Pick<Lead, "stage" | "stageAt" | "events">): QuoteTrail | undefined {
  if (l.stage !== "Quoted") return undefined;
  const at = (e: LeadEvent) => Date.parse(e.at);
  const wrote = Math.max(0, ...l.events.filter((e) => e.kind === "wrote").map(at));
  const from = Math.max(Date.parse(l.stageAt), wrote);
  const sent = l.events.filter((e) => e.kind === "replied" && at(e) >= from + DAY).map(at).sort((a, b) => a - b);
  return { from: new Date(from).toISOString(), n: sent.length, ...(sent.length ? { last: new Date(sent[sent.length - 1]).toISOString() } : {}) };
}

type Quoted = Pick<Lead, "stage" | "stageAt" | "snoozeUntil"> & { events?: LeadEvent[]; quiet?: QuoteTrail };

/** The follow-up a quote is due, or null: three nudges at 3, 7 and 14 days, then "Mark as lost?". */
export function quoteNudge(l: Quoted, now: number): (typeof NUDGES)[number] | "Mark as lost?" | null {
  if (l.stage !== "Quoted" || (l.snoozeUntil && Date.parse(l.snoozeUntil) > now)) return null;
  const t = (l.events ? quoteTrail(l as Lead) : l.quiet) ?? { from: l.stageAt, n: 0 };
  const last = t.last ? Date.parse(t.last) : 0;
  if (t.n >= NUDGES.length) return now > last + LOST_DAYS * DAY ? "Mark as lost?" : null;
  // Three days between nudges at least, so a late first one does not bring the second straight after.
  return now > Math.max(Date.parse(t.from) + NUDGE_DAYS[t.n] * DAY, last + 3 * DAY) ? NUDGES[t.n] : null;
}

/** Days before a licence ends that the lead comes back to Your move. */
export const LICENCE_DAYS = 60;
/** Whether a licence is ending within LICENCE_DAYS (or has ended): time to offer a renewal. */
export const renewDue = (l: Pick<Lead, "licence">, now: number) =>
  !!l.licence && Date.parse(`${l.licence.end}T12:00:00Z`) - LICENCE_DAYS * 864e5 <= now;

/** Whether a lead has waited past what was promised. Snoozed leads never are. */
export function isLate(l: Quoted, now: number, replyHours = REPLY_HOURS): boolean {
  if (l.snoozeUntil && Date.parse(l.snoozeUntil) > now) return false;
  if (l.stage === "Inquiry") return now - Date.parse(l.stageAt) > replyHours * 3600e3;
  return quoteNudge(l, now) !== null;
}

/** The step that is Julian's with no reminder needed, or null: the invoice after a shoot, proofs after the invoice, a quote owed after the call. */
export function myMove(l: Pick<Lead, "stage" | "when">, now: number): string | null {
  if (l.stage === "Shot") return "Send invoice";
  if (l.stage === "Invoiced") return "Send proofs";
  if (l.stage === "Call booked" && (!l.when || Date.parse(l.when) <= now)) return "Send the quote";
  return null;
}

/** How close the shoot has to be before unsigned paperwork needs him. */
export const PAPER_DAYS = 7;

/** The paper to chase: Confirmed, the shoot within a week, and it is not Signed or Not needed. */
export function paperDue(l: Pick<Lead, "stage" | "when" | "contract" | "release">, now: number): "contract" | "release" | null {
  if (l.stage !== "Confirmed" || !l.when) return null;
  const left = Date.parse(l.when) - now;
  if (!(left >= 0 && left <= PAPER_DAYS * 864e5)) return null;
  const open = (p?: Paper) => p !== "Signed" && p !== "Not needed";
  return open(l.contract) ? "contract" : open(l.release) ? "release" : null;
}

// Name and email capped: KV metadata holds 1024 bytes, and the sealed summary
// grows by a third, so one long Cal.com name must not cost the whole lead.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const leadSummary = ({ events, notion, deposit, notes, remind, phone, ig, company, lostReason, source, invoices, ...rest }: Lead): LeadSummary => ({
  ...rest,
  ...(rest.stage === "Quoted" ? { quiet: quoteTrail({ ...rest, events }) } : {}),
  ...(remind ? { due: remind.at, dueText: remind.text.slice(0, 40) } : {}),
  name: rest.name?.slice(0, 80),
  email: rest.email.slice(0, 120),
  ...(rest.snippet ? { snippet: rest.snippet.slice(0, 90) } : {}),
  ...(rest.licence ? { licence: { use: rest.licence.use.slice(0, 40), end: rest.licence.end } } : {}),
  ...(deposit ? { paid: true as const } : {}),
});

type KV = Pick<NonNullable<CloudflareEnv["INBOX"]>, "get" | "put" | "list" | "delete">;
/** Where leads live: the INBOX namespace, sealed with LEADS_KEY. */
export type LeadStore = { INBOX?: KV; LEADS_KEY?: string; VAPID_KEY?: string };

/** One lead, opened. Null when it is not there. */
export async function readLead(kv: KV, s: Sealer, id: string): Promise<Lead | null> {
  const raw = await kv.get(leadKey(id));
  return raw ? s.open<Lead>(raw) : null;
}

/** Bytes the sealed summary may take: KV metadata holds 1024, as JSON. */
const META_MAX = 1000;
/** What a summary gives up, in order, when non-Latin text makes it too big:
    the message, then most of the name, then most of the address. */
const SHRINK: ((m: LeadSummary) => LeadSummary)[] = [
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ({ snippet, dueText, ...m }) => ({ ...m, ...(m.licence ? { licence: { ...m.licence, use: "" } } : {}) }),
  (m) => ({ ...m, name: m.name.slice(0, 24) }),
  (m) => ({ ...m, name: m.name.slice(0, 8), email: m.email.slice(0, 40) }),
];

/** One lead, sealed, with its sealed summary as the metadata the list reads.
    The summary shrinks until it fits, so a long CJK name and message never
    make the put throw and the lead go unrecorded. */
export async function writeLead(kv: KV, s: Sealer, id: string, lead: Lead): Promise<void> {
  let summary = leadSummary(lead);
  let meta = await s.seal(summary);
  for (const cut of SHRINK) {
    if (JSON.stringify({ s: meta }).length <= META_MAX) break;
    summary = cut(summary);
    meta = await s.seal(summary);
  }
  await kv.put(leadKey(id), await s.seal(lead), { metadata: { s: meta } });
}

const CANON = "leads:canon";
/**
 * Once: moves each lead stored before ids ignored Gmail dots and "+tags"
 * (`canonical` in lib/lead-crypto.ts, 2026-11-04) to its new id. A lead whose
 * new id is already taken stays put, for Merge on the desk. Returns how many moved.
 */
export async function canonLeads(kv: KV, s: Sealer): Promise<number> {
  if ((await kv.get(CANON)) !== null) return 0;
  let moved = 0;
  let cursor: string | undefined;
  for (;;) {
    const listed = await kv.list({ prefix: "lead:", cursor });
    for (const k of listed.keys) {
      const lead = await readLead(kv, s, k.name.slice(5));
      if (!lead?.email.includes("@")) continue;
      const id = await s.id(lead.email);
      if (leadKey(id) === k.name || (await kv.get(leadKey(id))) !== null) continue;
      await writeLead(kv, s, id, lead);
      await kv.delete(k.name);
      moved++;
    }
    if (listed.list_complete || !listed.cursor) break;
    cursor = listed.cursor;
  }
  await kv.put(CANON, new Date().toISOString());
  return moved;
}

/** Logs a mail the site sent against the person it was about. Never throws. */
export const logMail = (env: LeadStore, email: string | undefined, subject: string, mail: Sent) =>
  recordLead(env, email ?? "", { event: { at: new Date().toISOString(), kind: "mail", note: subject, mail } });

/**
 * Work that may run after the response: a push service can take seconds,
 * and the form, Cal.com and Stripe all wait on recordLead. In the Worker it
 * goes to waitUntil; with no request around it (tests, scripts) it runs
 * inline. Imported lazily so the desk's client bundle never loads it.
 */
async function later(p: Promise<void>) {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    getCloudflareContext().ctx.waitUntil(p);
  } catch {
    await p;
  }
}

/**
 * Folds one event into the person's record and stores it, sealed. Without
 * LEADS_KEY nothing is recorded: never a lead in the clear.
 * shortcut: read, fold, write is not atomic, so two events for the same
 * person in the same second can lose one. Webhooks and the form for one
 * person are minutes apart; a Durable Object if that ever changes.
 */
export async function recordLead(env: LeadStore, email: string, c: Change): Promise<Lead | null> {
  const seal = sealer(env.LEADS_KEY);
  if (!env.INBOX || !email.includes("@")) return null;
  if (!seal) {
    console.error("lead", "LEADS_KEY unset or malformed, not recorded");
    return null;
  }
  try {
    const s = await seal;
    const id = await s.id(email);
    const before = await readLead(env.INBOX, s, id);
    const after = fold(before, email, c);
    if (after === before) return after;
    await writeLead(env.INBOX, s, id, after);
    // Something reached the site: ping his devices (`lib/lead-push.ts`).
    const push = pushFor(after, c.event);
    if (push && env.VAPID_KEY) await later(notify(env.INBOX, env.VAPID_KEY, push));
    return after;
  } catch (e) {
    console.error("lead", String(e));
    return null;
  }
}

/* ── the Inbox, backfilled ────────────────────────────────────────
 * Julian (2026-11-04): "add the stuff i have in my juliangigola admin inbox
 * to my leads". The `msg:` rows from before the desk, folded into leads at
 * their own times. Nothing is mailed, Notion is not touched, no row deleted.
 * ─────────────────────────────────────────────────────────────── */

/** One Inbox row as its KV key plus the summary its metadata carries. */
export type InboxRow = { key: string; at: string; type: string; name: string; email: string; read: boolean; detail?: string };

/** What an old row was: the form, a call, a booking, or a deposit gone wrong. */
export function rowEvent(r: InboxRow): Change {
  const booked = r.type === "booking";
  const kind: LeadEvent["kind"] = !booked
    ? "inquiry"
    : r.detail?.startsWith("Deposit paid, not booked")
      ? "deposit-stuck"
      : /\bcall\b/i.test(r.detail ?? "")
        ? "call"
        : "booking";
  return { event: { at: r.at, kind, ref: r.key, note: booked ? r.detail : r.type }, name: r.name, ...(booked ? {} : { kind: r.type }) };
}

const ARRIVED: LeadEvent["kind"][] = ["inquiry", "call", "booking", "deposit-stuck"];

/**
 * A person's old rows folded into their lead, or null when every row is
 * already there (run twice, changes nothing). Already there: the same row
 * (`ref`), or something that arrived within two minutes of it, which is
 * the same booking recorded live under its Cal.com uid.
 * A new lead is built in time order and is unread only if a row was;
 * one whose rows were all read, still at Inquiry, lands at Replied.
 * An existing lead only gains the events and an earlier First seen: its
 * stage, snooze and unread are Julian's and stay.
 */
export function backfillLead(lead: Lead | null, email: string, rows: InboxRow[]): Lead | null {
  const sorted = [...rows].sort((a, b) => a.at.localeCompare(b.at));
  const near = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) < 120e3;
  const add = sorted
    .map(rowEvent)
    .filter(({ event }) => !lead?.events.some((x) => x.ref === event.ref || (ARRIVED.includes(x.kind) && near(x.at, event.at))));
  if (!add.length) return null;
  if (!lead) {
    let built: Lead | null = null;
    for (const c of add) built = fold(built, email, c);
    const unread = sorted.some((r) => !r.read);
    // Julian: "import read ones as replied". All read means he dealt with it.
    return { ...built!, unread, ...(!unread && built!.stage === "Inquiry" ? { stage: "Replied" as const } : {}) };
  }
  const events = [...lead.events, ...add.map((c) => c.event)].sort((a, b) => a.at.localeCompare(b.at)).slice(-KEEP);
  return { ...lead, events, firstAt: add[0].event.at < lead.firstAt ? add[0].event.at : lead.firstAt };
}
