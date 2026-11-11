/**
 * The lead desk's non-UI half (components/leads-astryx.tsx and its
 * screens): the admin fetch, the list filters and the
 * small formatters. Browser only: the fetch reads the key from localStorage.
 */
import { credentials, KEY_STORE } from "@/lib/admin/admin-github";
import { TZ } from "@/lib/booking/booking-rules";
import { isLate, myMove, paperDue, quoteNudge, renewDue, type Lead, type LeadPatch, type LeadSummary, type Stage } from "@/lib/leads/leads";

export type Filter = "today" | "traffic" | "seo" | "site" | "device" | "needs" | "open" | "upcoming" | Stage | "snoozed" | "archived" | "trash" | "more" | "new" | "stats" | "money" | "templates" | "hours" | "proofs" | "licences";

/** The inbox key if one was pasted, else the /admin GitHub token. */
export const authed = () => credentials(window.localStorage.getItem(KEY_STORE) ?? "");

/** A failed admin request, with the status the route answered. */
export class AdminError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** One authed JSON request to an admin route. A non-JSON body (an HTML 502) reads as {}, so the status still shows. */
/** `fail` is what a failure says when the route gave no error of its own. */
export async function adminCall<T = Record<string, unknown>>(path: string, init: RequestInit = {}, fail?: string): Promise<T> {
  const res = await fetch(path, { ...init, headers: { ...authed(), "content-type": "application/json", ...init.headers }, cache: "no-store" });
  const out = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new AdminError(out.error ?? fail ?? `Request failed (${res.status})`, res.status);
  return out;
}

export type Call = <T = Record<string, unknown>>(init?: RequestInit & { query?: string }) => Promise<T>;
/** /api/inbox, with the query string beside the request. */
export const inboxCall: Call = ({ query = "", ...init } = {}) => adminCall(`/api/inbox${query}`, init);

/** A change to the open lead; answers with the lead as stored. */
export type Patch = (b: LeadPatch) => Promise<Lead>;

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
export const OFFLINE = "Offline. The desk loads again when you are back online.";
/** What a failed load says: offline, or the route's own words. */
export const loadError = (e: unknown) => (navigator.onLine === false || e instanceof TypeError ? OFFLINE : errorText(e));

/** "Nov 11, 4:05 PM" in Julian's time. */
export const stampPT = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/** A licence's end date, "Mar 4, 2027". */
export const endDay = (end: string) => new Date(`${end}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export const DAY = 864e5;
export const now = () => Date.now();

/** A day in Pacific time as YYYY-MM-DD, today by default. */
export const ymdPT = (t: Date | number = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(t);
/** A YYYY-MM-DD day moved by n days. */
export const plusDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const snoozed = (l: LeadSummary) => !!l.snoozeUntil && Date.parse(l.snoozeUntil) > now();
export const closed = (s: Stage) => s === "Delivered" || s === "Lost";
/** Archived or in the trash: out of every list but its own. */
export const aside = (l: LeadSummary) => !!(l.archivedAt || l.trashedAt);
/** His reminder has come round: it beats a snooze. */
const due = (l: LeadSummary) => !!l.due && Date.parse(l.due) <= now();
/** The desk's search: name, email, type of shoot or their message. */
export const matches = (l: LeadSummary, words: string) => !words || [l.name, l.email, l.kind, l.snippet].some((v) => v?.toLowerCase().includes(words));
/** A licence ending soon brings back even a Delivered lead; a snooze holds it off. */
export const renew = (l: LeadSummary) => !snoozed(l) && renewDue(l, now());
export const needsMe = (l: LeadSummary) => renew(l) || (!aside(l) && !closed(l.stage) && (due(l) || (!snoozed(l) && (l.unread || isLate(l, now()) || !!l.flags?.length || !!paperDue(l, now()) || !!myMove(l, now())))));

/** What to do next, in a word or two, and whether it is late. */
export function nextStep(l: LeadSummary): string | null {
  // A due reminder on a stage that has its own short step shows the step; the reminder's text stays in the lead.
  if (due(l)) return myMove(l, now()) ?? (l.dueText || "Your reminder");
  if (l.flags?.includes("stuck")) return "Refund or rebook";
  if (l.flags?.includes("no-deposit")) return "Ask for the deposit";
  const paper = paperDue(l, now());
  if (paper) return paper === "contract" ? "Sign contract" : "Sign release";
  if (renew(l)) return "Renew licence";
  if (l.stage === "Inquiry") return "Reply";
  if (l.stage === "Quoted") return quoteNudge(l, now());
  return myMove(l, now());
}

export function pass(l: LeadSummary, f: Filter) {
  if (f === "trash") return !!l.trashedAt;
  if (f === "archived") return !!l.archivedAt && !l.trashedAt;
  if (f === "needs") return needsMe(l);
  if (aside(l)) return false;
  if (f === "upcoming") return !!l.when && Date.parse(l.when) > now() - 2 * 3600e3 && !closed(l.stage);
  if (f === "more" || f === "hours" || f === "proofs" || f === "licences") return false;
  if (f === "snoozed") return snoozed(l);
  if (f === "open") return !closed(l.stage);
  return l.stage === f && !snoozed(l);
}

export const ago = (iso: string) => {
  const mins = Math.round((now() - Date.parse(iso)) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)} h`;
  return `${Math.round(mins / 1440)} d`;
};
export const day = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" }).format(new Date(iso));
export const at = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
export const cash = (cents: number) => `${cents < 0 ? "−" : ""}$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
