/* ── the lead desk as a CRM ───────────────────────────────────────
 * Julian (2026-11-04), on what a CRM usually has: "add all of them".
 * Leads added by hand (DMs, texts, referrals), merging two records of one
 * person, the numbers (inquiries a week, reply time, booked rate, where
 * bookings come from, quotes), an export, and reply templates.
 * Pure functions: `app/api/inbox/route.ts` reads and writes, these decide.
 * ─────────────────────────────────────────────────────────────── */

import { TZ } from "./booking/booking-rules";
import { STAGES, type Lead, type Stage } from "./leads";

/** A lead's identity: the address, or an Instagram handle or phone for someone who never wrote from one. */
export function identity(o: { email?: string; ig?: string; phone?: string }): string | null {
  const email = o.email?.trim().toLowerCase();
  if (email?.includes("@") && !email.startsWith("@")) return email;
  const ig = o.ig?.trim().replace(/^@/, "").toLowerCase();
  if (ig && /^[a-z0-9._]{1,30}$/.test(ig)) return `ig:@${ig}`;
  const tel = o.phone?.replace(/[^\d+]/g, "");
  if (tel && tel.replace(/\D/g, "").length >= 7) return `tel:${tel}`;
  return null;
}

/** Whether there is an address to reply to (not an Instagram or phone identity). */
export const mailable = (email: string) => email.includes("@") && !email.startsWith("ig:") && !email.startsWith("tel:");

export type NewLead = {
  name: string;
  email?: string;
  phone?: string;
  ig?: string;
  company?: string;
  kind?: string;
  stage?: Stage;
  source?: string;
  notes?: string;
};

const clip = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined);

/** A lead he added by hand: read already (it is his own news), at the stage he picked. */
export function manualLead(given: NewLead, at: string): Lead | { error: string } {
  const name = clip(given.name, 80);
  if (!name) return { error: "A name, please." };
  const email = identity(given);
  if (!email) return { error: "An email, an Instagram handle or a phone number, please." };
  const stage = given.stage && (STAGES as readonly string[]).includes(given.stage) ? given.stage : "Inquiry";
  const lead: Lead = {
    email,
    name,
    stage,
    stageAt: at,
    firstAt: at,
    lastAt: at,
    unread: false,
    phone: clip(given.phone, 40),
    ig: clip(given.ig, 31)?.replace(/^@?/, "@"),
    company: clip(given.company, 80),
    kind: clip(given.kind, 40)?.toLowerCase(),
    source: clip(given.source, 40),
    notes: clip(given.notes, 5000),
    events: [{ at, kind: "added", note: clip(given.source, 40) }],
  };
  for (const k of Object.keys(lead) as (keyof Lead)[]) if (lead[k] === undefined) delete lead[k];
  return lead;
}

/**
 * Two records of one person folded into one: the timelines together, the
 * furthest stage, the latest booking, nothing he typed lost. The other
 * record's address is kept in the notes so a search still finds it.
 */
export function merge(into: Lead, from: Lead, at: string): Lead {
  const rank = (s: Stage) => (s === "Lost" ? -1 : STAGES.indexOf(s));
  const events = [...into.events, ...from.events]
    .filter((e, i, all) => !e.ref || all.findIndex((x) => x.ref === e.ref && x.kind === e.kind) === i)
    .sort((a, b) => a.at.localeCompare(b.at));
  const ahead = rank(from.stage) > rank(into.stage) ? from : into;
  const notes = [into.notes, from.notes, `Also: ${from.email}`].filter(Boolean).join("\n\n");
  const out: Lead = {
    ...from,
    ...into,
    stage: ahead.stage,
    stageAt: ahead.stageAt,
    firstAt: into.firstAt < from.firstAt ? into.firstAt : from.firstAt,
    lastAt: into.lastAt > from.lastAt ? into.lastAt : from.lastAt,
    unread: into.unread || from.unread,
    when: [into.when, from.when].filter(Boolean).sort().pop(),
    flags: [...new Set([...(into.flags ?? []), ...(from.flags ?? [])])],
    notes: notes.slice(0, 5000),
    invoices: [...(from.invoices ?? []), ...(into.invoices ?? [])].sort((a, b) => a.at.localeCompare(b.at)),
    events: [...events, { at, kind: "merge" as const, note: from.name }].slice(-50),
  };
  if (!out.flags?.length) delete out.flags;
  if (!out.when) delete out.when;
  if (!out.invoices?.length) delete out.invoices;
  return out;
}

/** "Hi {first}" and friends, filled for one lead. */
export type Template = { id: string; name: string; subject: string; body: string };
export const TEMPLATES: Template[] = [
  { id: "quote", name: "Quote", subject: "Your {kind} quote", body: "Hi {first},\n\nThanks for the details. Here is what I would suggest for the {kind} shoot, and what it costs:\n\n\n\nIf that works, I will hold a date for you.\n\nJulian" },
  { id: "book", name: "Booking link", subject: "Booking a time", body: "Hi {first},\n\nYou can pick a time here: https://juliangigola.com/book\n\nJulian" },
  { id: "follow", name: "Follow up", subject: "Checking in", body: "Hi {first},\n\nChecking in on the {kind} shoot. Happy to answer anything, or hold a date while you decide.\n\nJulian" },
  { id: "nudge1", name: "Nudge 1", subject: "Your {kind} quote", body: "Hi {first},\n\nChecking in on the quote I sent for the {kind} shoot. Any questions, just ask.\n\nJulian" },
  { id: "nudge2", name: "Nudge 2", subject: "Your {kind} quote", body: "Hi {first},\n\nI still have a few dates open this month if you want one held. Here is a recent shoot close to what you described:\n\n\n\nJulian" },
  { id: "nudge3", name: "Last nudge", subject: "Your {kind} quote", body: "Hi {first},\n\nI haven't heard back, so I'll close this out unless you want to keep going. If the timing changes, write any time.\n\nJulian" },
  { id: "renew", name: "Renew licence", subject: "Renewing your licence", body: "Hi {first},\n\nThe licence on the photos ({licence}) ends on {ends}. If you still need them after that, I can renew it. Same terms, or tell me what changed and I will quote it.\n\nJulian" },
  { id: "decline", name: "Not a fit", subject: "Your {kind} inquiry", body: "Hi {first},\n\nThank you for thinking of me. This one is not a fit for my schedule right now, but I hope it goes well.\n\nJulian" },
];
export function fill(text: string, l: Pick<Lead, "name" | "kind" | "when" | "licence">): string {
  const when = l.when
    ? new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" }).format(new Date(l.when))
    : "";
  return text
    .replace(/\{first\}/g, l.name.split(/\s+/)[0] ?? "")
    .replace(/\{name\}/g, l.name)
    .replace(/\{kind\}/g, (l.kind ?? "shoot").replace(/-/g, " "))
    .replace(/\{when\}/g, when)
    .replace(/\{licence\}/g, l.licence?.use ?? "")
    .replace(/\{ends\}/g, l.licence ? new Date(`${l.licence.end}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "");
}
/** Templates as he saved them, or the defaults; anything malformed is dropped. */
export function cleanTemplates(v: unknown): Template[] {
  if (!Array.isArray(v)) return TEMPLATES;
  const saved = v
    .filter((t): t is Template => !!t && typeof t === "object" && typeof t.name === "string" && typeof t.subject === "string" && typeof t.body === "string")
    .slice(0, 30)
    .map((t, i) => ({ id: typeof t.id === "string" && t.id ? t.id.slice(0, 40) : `t${i}`, name: t.name.slice(0, 60), subject: t.subject.slice(0, 200), body: t.body.slice(0, 5000) }));
  // Quote nudges came after his first save: added to a saved list, so a deleted one comes back.
  return [...saved, ...TEMPLATES.filter((t) => t.id.startsWith("nudge") && !saved.some((s) => s.id === t.id))];
}

const WON: Stage[] = ["Confirmed", "Shot", "Invoiced", "Selecting", "Delivered"];
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export type Stats = {
  total: number;
  weeks: { start: string; inquiries: number; booked: number }[];
  replyHours: number | null;
  bookedRate: number | null;
  sources: { source: string; leads: number; booked: number }[];
  lost: { reason: string; n: number }[];
  pipeline: number;
  won: number;
  stages: Partial<Record<Stage, number>>;
};

/** The desk's numbers. Trash is left out; archived leads count. */
export function stats(all: Lead[], now: number): Stats {
  const leads = all.filter((l) => !l.trashedAt);
  const week = 7 * 864e5;
  // Weeks start Monday, Pacific time is close enough at this scale.
  const monday = (t: number) => {
    const d = new Date(t);
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5;
  };
  const start = monday(now) - 11 * week;
  const weeks = Array.from({ length: 12 }, (_, i) => ({ start: new Date(start + i * week).toISOString().slice(0, 10), inquiries: 0, booked: 0 }));
  const at = (iso: string) => Math.floor((Date.parse(iso) - start) / week);
  for (const l of leads) {
    const i = at(l.firstAt);
    if (i >= 0 && i < 12) weeks[i].inquiries++;
    const b = l.events.find((e) => e.kind === "booking" || (e.kind === "stage" && WON.includes(e.note as Stage)));
    const j = b ? at(b.at) : -1;
    if (j >= 0 && j < 12) weeks[j].booked++;
  }
  // First answer: from the first inquiry to the first move off Inquiry.
  const waits = leads.flatMap((l) => {
    const asked = l.events.find((e) => e.kind === "inquiry");
    const moved = asked && l.events.find((e) => e.kind === "stage" && e.at >= asked.at && e.note !== "Inquiry");
    return asked && moved ? [(Date.parse(moved.at) - Date.parse(asked.at)) / 3600e3] : [];
  });
  // Booked rate over leads old enough to have been decided (a week in).
  const decided = leads.filter((l) => now - Date.parse(l.firstAt) > week);
  const won = (l: Lead) => WON.includes(l.stage);
  const src = new Map<string, { leads: number; booked: number }>();
  for (const l of leads) {
    const k = l.source || "Not recorded";
    const s = src.get(k) ?? { leads: 0, booked: 0 };
    s.leads++;
    if (won(l)) s.booked++;
    src.set(k, s);
  }
  const lost = new Map<string, number>();
  for (const l of leads) if (l.stage === "Lost") lost.set(l.lostReason || "No reason given", (lost.get(l.lostReason || "No reason given") ?? 0) + 1);
  const stages: Partial<Record<Stage, number>> = {};
  for (const l of leads) stages[l.stage] = (stages[l.stage] ?? 0) + 1;
  return {
    total: leads.length,
    weeks,
    replyHours: median(waits),
    bookedRate: decided.length ? decided.filter(won).length / decided.length : null,
    sources: [...src].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.leads - a.leads),
    lost: [...lost].map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n),
    pipeline: leads.filter((l) => l.stage === "Quoted" && !l.archivedAt).reduce((n, l) => n + (l.quote ?? 0), 0),
    won: leads.filter(won).reduce((n, l) => n + (l.quote ?? 0), 0),
    stages,
  };
}

/** Every lead as CSV, for his records. Spreadsheet formulas are defused. */
export function csv(leads: Lead[]): string {
  const cols = ["name", "email", "phone", "instagram", "company", "stage", "kind", "source", "quote", "lost reason", "first seen", "last activity", "booked for", "archived", "notes"] as const;
  const cell = (v: unknown) => {
    let s = v === undefined || v === null ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = leads.map((l) =>
    [l.name, mailable(l.email) ? l.email : "", l.phone, l.ig, l.company, l.stage, l.kind, l.source, l.quote, l.lostReason, l.firstAt, l.lastAt, l.when, l.archivedAt ? "yes" : "", l.notes].map(cell).join(","),
  );
  return [cols.join(","), ...rows].join("\r\n") + "\r\n";
}
