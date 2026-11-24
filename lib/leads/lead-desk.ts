/**
 * The lead desk's non-UI half (components/leads/desk.tsx and its
 * screens): the desk fetch, the list filters and the
 * small formatters. Browser only: the fetch reads the key from localStorage.
 */
import { errorText } from "@/lib/utils";
import { adminCall, AdminError } from "@/lib/admin/admin-call";
import { TZ } from "@/lib/time-zone";
import { isLate, myMove, paperDue, quoteNudge, renewDue, type Lead, type LeadPatch, type LeadSummary, type Stage } from "@/lib/leads/leads";

export type Filter = "today" | "traffic" | "seo" | "site" | "device" | "needs" | "open" | "upcoming" | Stage | "snoozed" | "archived" | "trash" | "more" | "new" | "stats" | "money" | "templates" | "hours" | "proofs" | "licences";

/** The desk's three layouts, by window width. */
export type Size = "phone" | "mid" | "wide";
/** A request to the lead desk's routes: `path` is under /api/leads ("" the leads themselves, "/templates", "/log?id=..."). */
export type Call = <T = Record<string, unknown>>(init?: RequestInit & { path?: string }) => Promise<T>;
export const deskCall: Call = ({ path = "", ...init } = {}) => adminCall(`/api/leads${path}`, init);

/** A change to the open lead; answers with the lead as stored. */
export type Patch = (b: LeadPatch) => Promise<Lead>;

export const OFFLINE = "Offline. The desk loads again when you are back online.";
/** Any 401 from the admin gate (`refuseAdmin`): a missing key or a token GitHub refused. The desks show sign-in for it. */
export const isLocked = (e: unknown) => e instanceof AdminError && e.status === 401;
export const LOCKED = "Not authorized.";
/** What a failed load says: offline, or the route's own words. */
export const loadErrorText = (e: unknown) => (navigator.onLine === false || e instanceof TypeError ? OFFLINE : isLocked(e) ? LOCKED : errorText(e));

/** "Nov 11, 4:05 PM" in Julian's time. */
export const stampPT = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/** A licence's end date, "Mar 4, 2027". */
export const endDay = (end: string) => new Date(`${end}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export const DAY = 864e5;
/** Date.now behind a call: the desk reads the clock in render, which the React compiler lint refuses for a bare Date.now(). */
export const now = () => Date.now();

/** A day in Pacific time as YYYY-MM-DD, today by default. */
export const ymdPT = (t: Date | number = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(t);
/** A YYYY-MM-DD day moved by n days. */
export const plusDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const isSnoozed = (l: LeadSummary) => !!l.snoozeUntil && Date.parse(l.snoozeUntil) > now();
export const isFinishedStage = (s: Stage) => s === "Delivered" || s === "Lost";
/** Archived or in the trash: out of every list but its own. */
export const isSetAside = (l: LeadSummary) => !!(l.archivedAt || l.trashedAt);
/** His reminder has come round: it beats a snooze. */
const due = (l: LeadSummary) => !!l.due && Date.parse(l.due) <= now();
/** The desk's search: name, email, type of shoot or their message. */
export const matches = (l: LeadSummary, words: string) => !words || [l.name, l.email, l.kind, l.snippet].some((v) => v?.toLowerCase().includes(words));
/** A licence ending soon brings back even a Delivered lead; a snooze holds it off. */
export const needsRenewal = (l: LeadSummary) => !isSnoozed(l) && renewDue(l, now());
export function needsMe(l: LeadSummary) {
  if (needsRenewal(l)) return true;
  if (isSetAside(l) || isFinishedStage(l.stage)) return false;
  if (due(l)) return true;
  if (isSnoozed(l)) return false;
  return l.unread || isLate(l, now()) || !!l.flags?.length || !!paperDue(l, now()) || !!myMove(l, now());
}

/** What to do next, in a word or two, and whether it is late. */
export function nextStep(l: LeadSummary): string | null {
  // A due reminder on a stage that has its own short step shows the step; the reminder's text stays in the lead.
  if (due(l)) return myMove(l, now()) ?? (l.dueText || "Your reminder");
  if (l.flags?.includes("stuck")) return "Refund or rebook";
  if (l.flags?.includes("no-deposit")) return "Ask for the deposit";
  const paper = paperDue(l, now());
  if (paper) return paper === "contract" ? "Sign contract" : "Sign release";
  if (needsRenewal(l)) return "Renew licence";
  if (l.stage === "Inquiry") return "Reply";
  if (l.stage === "Quoted") return quoteNudge(l, now());
  return myMove(l, now());
}

export function inFilter(l: LeadSummary, f: Filter) {
  if (f === "trash") return !!l.trashedAt;
  if (f === "archived") return !!l.archivedAt && !l.trashedAt;
  if (f === "needs") return needsMe(l);
  if (isSetAside(l)) return false;
  if (f === "upcoming") return !!l.when && Date.parse(l.when) > now() - 2 * 3600e3 && !isFinishedStage(l.stage);
  if (f === "more" || f === "hours" || f === "proofs" || f === "licences") return false;
  if (f === "snoozed") return isSnoozed(l);
  if (f === "open") return !isFinishedStage(l.stage);
  return l.stage === f && !isSnoozed(l);
}

export const ago = (iso: string) => {
  const mins = Math.round((now() - Date.parse(iso)) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)} h`;
  return `${Math.round(mins / 1440)} d`;
};
export const dayLabel = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" }).format(new Date(iso));
export const dateTimeLabel = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export const dollarsLabel = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
export const centsLabel = (cents: number) => `${cents < 0 ? "−" : ""}$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
