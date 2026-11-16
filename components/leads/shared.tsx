"use client";

import type { CSSProperties } from "react";

import { at, day, type Filter } from "@/lib/leads/lead-desk";
import type { LeadEvent } from "@/lib/leads/leads";

/** "intro-call" as "Intro call". */
const kindOf = (k?: string) => (k ? k.charAt(0).toUpperCase() + k.slice(1).replace(/-/g, " ") : undefined);


const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-border px-4 text-[15px] font-medium transition-colors duration-200 hoverable:hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
/** A form field and its label, as the desk's forms draw them. */
const field = "min-h-11 w-full rounded-[10px] border border-border bg-transparent px-3.5 text-base normal-case placeholder:normal-case placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-accent";
const fieldLabel = "grid gap-1.5 text-[14px] text-muted-foreground";
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


/** The unread count on the app icon (iPhone home screen, desktop dock), and
 * where the service worker reads it to add one per push. */
function badge(n: number) {
  try {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    (n ? nav.setAppBadge?.(n) : nav.clearAppBadge?.())?.catch(() => {});
    caches?.open("leads-badge").then((c) => c.put("n", new Response(String(n)))).catch(() => {});
  } catch {}
}

const LABEL: Partial<Record<Filter, string>> = { today: "Today", traffic: "Traffic", seo: "SEO", site: "Site", device: "This device", needs: "Your move", open: "All open", upcoming: "Upcoming", snoozed: "Snoozed", archived: "Archived", trash: "Trash", more: "More", new: "New lead", stats: "Stats", money: "Money", templates: "Templates", hours: "Hours", proofs: "Proofs", licences: "Licences" };
const label = (f: Filter) => LABEL[f] ?? f;

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
    // A delivery's opens carry ", finals" (`app/api/proof/[token]`): those are the finals, not proofs.
    case "proofs": return e.note?.endsWith(", finals") ? `Opened the finals: ${e.note.slice(0, -8)}` : `Opened proofs${e.note ? `: ${e.note}` : ""}`;
    case "download": return `Downloaded the finals${e.note ? `: ${e.note}` : ""}`;
    case "contract": return `Signed the contract${e.note ? `: ${e.note}` : ""}`;
    case "wrote": return `They wrote${e.note ? `: ${e.note}` : ""}`;
    case "mail": return `Mail to ${e.mail?.to === "client" ? "them" : "hello@"}: ${e.note ?? ""}`;
    case "added": return `Added by hand${e.note ? `, from ${e.note}` : ""}`;
    case "edit": return e.note === "people" ? "People changed" : "Details changed";
    case "merge": return `Merged with another record${e.note ? ` (${e.note})` : ""}`;
    case "remind": return e.note ? `Reminder set for ${at(e.note)}` : "Reminder cleared";
    case "quote": return e.note ? `Quote: $${Number(e.note).toLocaleString("en-US")}` : "Quote cleared";
    case "invoice": return `Invoice ${e.note ?? ""}`;
    case "payment": return `Paid $${(e.amount ?? 0).toLocaleString("en-US")}${e.note ? `, ${e.note}` : ""}`;
    case "refund": return `Refunded $${(e.amount ?? 0).toLocaleString("en-US")}${e.note ? `, ${e.note}` : ""}`;
    case "reschedule": return `Moved the session${e.note ? ` to ${e.note}` : ""}`;
    case "cancel": return `Cancelled the session${e.note ? `. ${e.note}` : ""}`;
    case "no-show": return `No-show${e.note ? `. ${e.note}` : ""}`;
    case "selects": return `Sent selects${e.note ? `: ${e.note}` : ""}`;
    case "invoice-paid": return `Invoice ${e.note ?? ""}`;
  }
}

/* The phone's bars, frosted like the desktop app's panels (LEADS DESKTOP glass.css: the card colour at about half,
 * over a blur). They float over the page, so the list shows through as it scrolls; FROST_ROOM keeps the last row clear. */
const frostBar: CSSProperties = {
  position: "absolute", insetInline: 0, bottom: 0, zIndex: 5,
  background: "var(--leads-bar, color-mix(in srgb, var(--color-background-card) 50%, transparent))",
  backdropFilter: "blur(24px) saturate(1.5)", WebkitBackdropFilter: "blur(24px) saturate(1.5)",
  borderTop: "1px solid color-mix(in srgb, currentColor 12%, transparent)",
  paddingBottom: "env(safe-area-inset-bottom)",
};
const FROST_ROOM = '[data-astryx-desk][data-bars] [role="main"]::after{content:"";display:block;flex:none;height:calc(72px + env(safe-area-inset-bottom))}';

/* Glass on a phone and an iPad, dark only (Julian picked "soft" in the mock, 2026-11-14): a teal glow behind the page, and
 * panels clear enough to show it, as LEADS DESKTOP glass.css does over its window. That shell's rules are !important and win there. */
const GLASS = "[data-astryx-desk][data-glass]{--color-background-body:transparent;--color-background-card:rgb(255 255 255/.055);--color-background-surface:rgb(255 255 255/.055);--color-background-muted:rgb(255 255 255/.09);--leads-bar:rgb(22 22 22/.47);background:radial-gradient(120% 55% at 0% 0%,rgb(88 198 202/.15) 0,transparent 62%),radial-gradient(95% 50% at 100% 100%,rgb(88 198 202/.1) 0,transparent 66%),oklch(0.145 0.003 70)}[data-astryx-desk][data-glass] :is(dialog,[role=dialog],[role=menu],[role=listbox],[popover]){--color-background-body:oklch(0.145 0.003 70);--color-background-card:oklch(0.185 0.003 70);--color-background-surface:oklch(0.185 0.003 70);--color-background-muted:oklch(0.21 0.003 70)}";

/* The win button (Julian, 2026-11-14): under a mouse the plane flies off and comes back, in a loop. */
const WIN_CSS = ".jg-win:hover svg{animation:jg-fly 1.1s cubic-bezier(.5,0,.3,1) infinite}@keyframes jg-fly{0%{transform:none;opacity:1}45%{transform:translate(16px,-16px);opacity:0}46%{transform:translate(-14px,14px);opacity:0}100%{transform:none;opacity:1}}@media (prefers-reduced-motion:reduce){.jg-win:hover svg{animation:none}}";

export { frostBar, FROST_ROOM, GLASS, WIN_CSS, kindOf, btn, field, fieldLabel, primary, ios, compose, mailto, badge, label, line };
