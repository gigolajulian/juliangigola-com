"use client";

import * as React from "react";
import { credentials, KEY_STORE } from "@/lib/admin-github";
import { isLate, myMove, paperDue, quoteNudge, renewDue, STAGES, type LeadEvent, type LeadSummary, type Stage } from "@/lib/leads";
import { cn } from "@/lib/utils";

export type Filter = "today" | "traffic" | "seo" | "site" | "device" | "needs" | "open" | "upcoming" | Stage | "snoozed" | "archived" | "trash" | "more" | "new" | "stats" | "money" | "templates" | "hours" | "proofs" | "licences";

const DAY = 864e5;

const now = () => Date.now();
const snoozed = (l: LeadSummary) => !!l.snoozeUntil && Date.parse(l.snoozeUntil) > now();
const closed = (s: Stage) => s === "Delivered" || s === "Lost";
/** Archived or in the trash: out of every list but its own. */
const aside = (l: LeadSummary) => !!(l.archivedAt || l.trashedAt);
/** His reminder has come round: it beats a snooze. */
const due = (l: LeadSummary) => !!l.due && Date.parse(l.due) <= now();
/** The desk's search: name, email, type of shoot or their message. */
export const matches = (l: LeadSummary, words: string) => !words || [l.name, l.email, l.kind, l.snippet].some((v) => v?.toLowerCase().includes(words));
/** A licence ending soon brings back even a Delivered lead; a snooze holds it off. */
const renew = (l: LeadSummary) => !snoozed(l) && renewDue(l, now());
const needsMe = (l: LeadSummary) => renew(l) || (!aside(l) && !closed(l.stage) && (due(l) || (!snoozed(l) && (l.unread || isLate(l, now()) || !!l.flags?.length || !!paperDue(l, now()) || !!myMove(l, now())))));

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

/** The site's headings are Black capitals; the desk's are the wordmark face at 600, as written. */
const HEAD: React.CSSProperties = { fontFamily: "var(--font-display)", textTransform: "none", fontWeight: 600, letterSpacing: "-0.02em", wordSpacing: 0 };
/** "intro-call" as "Intro call". */
const kindOf = (k?: string) => (k ? k.charAt(0).toUpperCase() + k.slice(1).replace(/-/g, " ") : undefined);

export const ago = (iso: string) => {
  const mins = Math.round((now() - Date.parse(iso)) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)} h`;
  return `${Math.round(mins / 1440)} d`;
};
const day = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" }).format(new Date(iso));
const at = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/** The chip a row shows: trouble first, then late, then the stage. */
/** A shape per stage, so the chip never relies on color alone. */
const MARK: Record<Stage, string> = {
  Inquiry: "○", Replied: "◐", "Call booked": "◐", Quoted: "◐", Confirmed: "●", Shot: "●", Invoiced: "●", Selecting: "●", Delivered: "✓", Lost: "×",
};

function Tag({ tone, mark, children }: { tone: "plain" | "needs" | "bad" | "quiet"; mark: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-2 whitespace-nowrap rounded-[4px] px-3 font-mono text-[12.5px]",
        tone === "plain" && "bg-card text-foreground",
        tone === "needs" && "bg-accent/12 text-accent ring-1 ring-inset ring-accent/40",
        tone === "bad" && "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/40",
        tone === "quiet" && "text-muted-foreground ring-1 ring-inset ring-border",
      )}
    >
      <span aria-hidden="true">{mark}</span>
      {children}
    </span>
  );
}

const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-border px-4 text-[15px] font-medium transition-colors duration-200 hoverable:hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const primary = "border-accent bg-accent font-semibold text-accent-foreground hoverable:hover:bg-accent/90";

/** A Gmail draft from hello@ (the second account in his Chrome, the Gmail app on the phone). */
const q = (o: Record<string, string>) => new URLSearchParams(o).toString().replace(/\+/g, "%20");
/** iPhone, or an iPad asking for the desktop site (it says Macintosh, with touch). */
const ios = () => /iPhone|iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

function compose(to: string, subject: string, body: string) {
  return ios()
    ? `googlegmail://co?${q({ to, subject, body })}`
    : `https://mail.google.com/mail/u/1/?${q({ view: "cm", fs: "1", to, su: subject, body })}`;
}

/**
 * Julian: "allow replying in native mail app ios". The same reply for
 * iOS Mail, with their message quoted. iOS Mail sends from its default
 * account, so hello@ has to be that. The quote is cut so the link stays
 * well under what Mail takes in.
 */
function mailto(to: string, subject: string, body: string, quote?: { name: string; at: string; text: string }) {
  const cut = (t: string) => (t.length > 1500 ? `${t.slice(0, 1500).trimEnd()}…` : t);
  const quoted = quote
    ? `\n\nOn ${new Date(quote.at).toDateString()}, ${quote.name} wrote:\n${cut(quote.text).split("\n").map((line) => `> ${line}`).join("\n")}`
    : "";
  return `mailto:${to}?${q({ subject, body: body + quoted })}`;
}

/** The road a lead travels; Lost is off it. */
const STEPS: readonly Stage[] = STAGES.filter((s) => s !== "Lost");

export const OFFLINE = "Offline. The desk loads again when you are back online.";
/** The unread count on the app icon (iPhone home screen, desktop dock), and
 * where the service worker reads it to add one per push. */
function badge(n: number) {
  try {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    (n ? nav.setAppBadge?.(n) : nav.clearAppBadge?.())?.catch(() => {});
    caches?.open("leads-badge").then((c) => c.put("n", new Response(String(n)))).catch(() => {});
  } catch {}
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
const LABEL: Partial<Record<Filter, string>> = { today: "Today", traffic: "Traffic", seo: "SEO", site: "Site", device: "This device", needs: "Your move", open: "All open", upcoming: "Upcoming", snoozed: "Snoozed", archived: "Archived", trash: "Trash", more: "More", new: "New lead", stats: "Stats", money: "Money", templates: "Templates", hours: "Hours", proofs: "Proofs", licences: "Licences" };
const label = (f: Filter) => LABEL[f] ?? f;

type Call = (init?: RequestInit & { query?: string }) => Promise<Record<string, unknown>>;

/** One timeline line, in words. */
function line(e: LeadEvent): string {
  switch (e.kind) {
    case "inquiry": return `Inquiry from the form${e.note ? `, ${e.note}` : ""}`;
    case "call": return `Call booked${e.note ? `: ${e.note}` : ""}`;
    case "booking": return `Session booked${e.note ? `: ${e.note}` : ""}`;
    case "no-deposit": return "Booked without a deposit";
    case "deposit-stuck": return `Deposit stuck${e.note ? `: ${e.note}` : ""}`;
    case "stage": return `Moved to ${e.note}`;
    case "snooze": return e.note === "woken" ? "Unsnoozed" : `Snoozed until ${day(e.note ?? "")}`;
    case "archive": return e.note === "in" ? "Archived" : "Unarchived";
    case "trash": return e.note === "in" ? "Moved to trash" : "Recovered from trash";
    case "replied": return `You replied${e.note ? `: ${e.note}` : ""}`;
    case "wrote": return `They wrote${e.note ? `: ${e.note}` : ""}`;
    case "mail": return `Mail to ${e.mail?.to === "client" ? "them" : "hello@"}: ${e.note ?? ""}`;
    case "added": return `Added by hand${e.note ? `, from ${e.note}` : ""}`;
    case "edit": return "Details changed";
    case "merge": return `Merged with another record${e.note ? ` (${e.note})` : ""}`;
    case "remind": return e.note ? `Reminder set for ${at(e.note)}` : "Reminder cleared";
    case "quote": return e.note ? `Quote: $${Number(e.note).toLocaleString("en-US")}` : "Quote cleared";
    case "invoice": return `Invoice ${e.note ?? ""}`;
  }
}

export const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

type Template = { id: string; name: string; subject: string; body: string };

const authed = () => credentials(window.localStorage.getItem(KEY_STORE) ?? "");

const cash = (cents: number) => `${cents < 0 ? "−" : ""}$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export { DAY, now, snoozed, closed, aside, renew, needsMe, HEAD, kindOf, day, at, MARK, Tag, btn, primary, ios, compose, mailto, STEPS, badge, label, line, authed, cash };
export type { Call, Template };
