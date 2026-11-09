"use client";

import * as React from "react";
import { credentials, KEY_STORE, References } from "@/components/admin-inbox";
import { LeadBoard } from "@/components/lead-board";
import { LeadHours } from "@/components/lead-hours";
import { LeadProofs, ProofsDesk } from "@/components/admin-proofs";
import { LeadUpcoming } from "@/components/lead-upcoming";
import { TOKEN_STORE } from "@/lib/admin-github";
import type { Enquiry } from "@/lib/inbox";
import { isLate, leadSummary, myMove, NUDGES, PAPER, paperDue, quoteNudge, REMIND_MAX, renewDue, shootTag, STAGES, trashDaysLeft, type Lead, type LeadEvent, type LeadSummary, type Paper, type Stage } from "@/lib/leads";
import { cn } from "@/lib/utils";
import { fill, mailable, TEMPLATES } from "@/lib/lead-crm";
import { endDay, LicenceField, LicenceList } from "@/components/lead-licence";
import { balance, DEPOSIT, MAX_LINES, usd, type Invoice, type InvoiceFrom } from "@/lib/invoice";
import { LEAD_KEYS, leadKey, typingIn } from "@/lib/lead-keys";

// The /admin tabs the One Desk folds in, loaded only when opened.
const AdminTraffic = React.lazy(() => import("@/components/admin-traffic").then((m) => ({ default: m.AdminTraffic })));
const AdminSeo = React.lazy(() => import("@/components/admin-seo").then((m) => ({ default: m.AdminSeo })));
/** Site: the /admin editor's own tabs, opened there (`?view=`), since they need the server's project data. */
const SITE: [string, string][] = [["Pages", "/admin?view=home"], ["Work", "/admin?view=projects"], ["Motion", "/admin?view=video"]];

/* ── the lead desk ────────────────────────────────────────────────
 * Julian (2026-11-03, PLAN-lead-desk.md, mock v3): every inquiry, call
 * and booking as one row per person, with where it stands and the one
 * thing to do next. Reads `lead:` records through `/api/inbox`, with the
 * same key or GitHub token as the Inbox tab.
 *
 * One filled accent button per lead (the next step), the rest outlined.
 * Every state is a word as well as a color. Wide: filters, list and the
 * open lead side by side. Narrow: the list, then the lead with Back.
 * ─────────────────────────────────────────────────────────────── */

type Filter = "today" | "traffic" | "seo" | "needs" | "open" | "upcoming" | Stage | "snoozed" | "archived" | "trash" | "more" | "new" | "stats" | "money" | "templates" | "hours" | "proofs" | "licences";
/** Views that are not a list of leads. */
/** Pull-to-refresh: how far the finger travels (px) to commit, and the most the pull shows. iOS rubber-band already halves it at the top. */
const PULL_AT = 56;
const PULL_MAX = 80;
const TOOLS: Filter[] = ["today", "traffic", "seo", "more", "new", "stats", "money", "templates", "hours", "proofs", "licences"];

const DAY = 864e5;
const BOARD_STORE = "jg-leads-board";
const now = () => Date.now();
const snoozed = (l: LeadSummary) => !!l.snoozeUntil && Date.parse(l.snoozeUntil) > now();
const closed = (s: Stage) => s === "Delivered" || s === "Lost";
/** Archived or in the trash: out of every list but its own. */
const aside = (l: LeadSummary) => !!(l.archivedAt || l.trashedAt);
/** His reminder has come round: it beats a snooze. */
const due = (l: LeadSummary) => !!l.due && Date.parse(l.due) <= now();
/** The desk's search: name, email, type of shoot or their message. */
const matches = (l: LeadSummary, words: string) => !words || [l.name, l.email, l.kind, l.snippet].some((v) => v?.toLowerCase().includes(words));
/** A licence ending soon brings back even a Delivered lead; a snooze holds it off. */
const renew = (l: LeadSummary) => !snoozed(l) && renewDue(l, now());
const needsMe = (l: LeadSummary) => renew(l) || (!aside(l) && !closed(l.stage) && (due(l) || (!snoozed(l) && (l.unread || isLate(l, now()) || !!l.flags?.length || !!paperDue(l, now()) || !!myMove(l, now())))));

/** What to do next, in a word or two, and whether it is late. */
function nextStep(l: LeadSummary): string | null {
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

const ago = (iso: string) => {
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

export function AdminLeads() {
  const [leads, setLeads] = React.useState<LeadSummary[] | null>(null);
  const [fresh, setFresh] = React.useState<Lead | null>(null);
  /** `?desk`: the One Desk (Today first, the /admin tabs folded in), opt-in until Julian says yes. */
  const [desk] = React.useState(() => typeof window !== "undefined" && new URLSearchParams(location.search).has("desk"));
  const [filter, setFilter] = React.useState<Filter>(desk ? "today" : "needs");
  const [open, setOpen] = React.useState<string | null>(null);
  // The row a phone came back from: the list was hidden, so focus fell to the body.
  const back = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (open || !back.current) return;
    document.querySelector<HTMLElement>(`[data-lead="${CSS.escape(back.current)}"]`)?.focus();
    back.current = null;
  }, [open]);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [templates, setTemplates] = React.useState<Template[]>([]);
  // List or Board, kept on this device. Leads load after hydration, so the first paint never differs.
  const [board, setBoardState] = React.useState(() => typeof window !== "undefined" && (() => { try { return localStorage.getItem(BOARD_STORE) === "1"; } catch { return false; } })());
  const setBoard = (on: boolean) => { setBoardState(on); try { localStorage.setItem(BOARD_STORE, on ? "1" : "0"); } catch {} };
  // A board move of the open lead: remount its pane so it shows the new stage.
  const [moved, setMoved] = React.useState(0);
  const [listW, setListW] = React.useState<number | null>(() => {
    try {
      const w = Number(window.localStorage.getItem(LIST_W_STORE));
      return w ? clampW(w) : null;
    } catch {
      return null;
    }
  });

  const call = React.useCallback(async (init: RequestInit & { query?: string } = {}) => {
    const res = await fetch(`/api/inbox${init.query ?? ""}`, {
      ...init,
      headers: { ...credentials(window.localStorage.getItem(KEY_STORE) ?? ""), "content-type": "application/json" },
      cache: "no-store",
    });
    const out = (await res.json()) as Record<string, unknown> & { error?: string };
    if (!res.ok) throw new Error(out.error ?? `Request failed (${res.status})`);
    return out;
  }, []);

  const load = React.useCallback(() => {
    call({ query: "?leads" })
      .then((o) => setLeads(o.leads as LeadSummary[]))
      .catch((e: unknown) => setError(navigator.onLine === false || e instanceof TypeError ? OFFLINE : e instanceof Error ? e.message : String(e)));
  }, [call]);
  React.useEffect(load, [load]);
  /** Julian: the installed app has no reload. The list and the open lead again,
   * in place: rows keep their keys, so the scroll and the selection stay. */
  const [refreshing, setRefreshing] = React.useState(false);
  const [tick, setTick] = React.useState(0);
  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    call({ query: "?leads" })
      .then((o) => {
        const rows = o.leads as LeadSummary[];
        // KV lists lag a fresh write (#662): keep a lead added a moment ago.
        setLeads((had) => [...(had ?? []).filter((r) => fresh && r.email === fresh.email && !rows.some((n) => n.id === r.id)), ...rows]);
        // The open lead fetches again in place: a remount would drop his unsaved drafts.
        setTick((n) => n + 1);
      })
      .catch((e: unknown) => alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setRefreshing(false));
  };
  /** Julian: "on iPhone, swiping down on the queries should refresh". Phone list
   * only, from the very top; passive listeners, so iOS keeps its own bounce. */
  const [pull, setPull] = React.useState(0);
  const latest = React.useRef(refresh);
  React.useEffect(() => { latest.current = refresh; });
  const listUp = !open && !TOOLS.includes(filter);
  React.useEffect(() => {
    if (!listUp) return;
    let from: number | null = null;
    let by = 0;
    const start = (e: TouchEvent) => { from = innerWidth < 1024 && scrollY <= 0 ? e.touches[0].clientY : null; by = 0; };
    const move = (e: TouchEvent) => {
      if (from === null) return;
      by = scrollY <= 0 ? Math.min(PULL_MAX, Math.max(0, e.touches[0].clientY - from)) : 0;
      setPull(by);
    };
    const end = () => {
      if (from !== null && by >= PULL_AT) latest.current();
      from = null;
      by = 0;
      setPull(0);
    };
    addEventListener("touchstart", start, { passive: true });
    addEventListener("touchmove", move, { passive: true });
    addEventListener("touchend", end);
    addEventListener("touchcancel", end);
    return () => {
      removeEventListener("touchstart", start);
      removeEventListener("touchmove", move);
      removeEventListener("touchend", end);
      removeEventListener("touchcancel", end);
    };
  }, [listUp]);
  React.useEffect(() => {
    call({ query: "?templates" }).then((o) => setTemplates(o.templates as Template[])).catch(() => {});
  }, [call]);
  // Back online: load again on its own.
  React.useEffect(() => {
    const back = () => { setError(null); load(); };
    addEventListener("online", back);
    return () => removeEventListener("online", back);
  }, [load]);
  // The installed app: offline shell (production only) and the unread count on its icon.
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "development") navigator.serviceWorker?.register(SW_URL, { scope: swScope() }).catch(() => {});
  }, []);
  React.useEffect(() => {
    if (leads) badge(leads.filter((l) => l.unread && !aside(l)).length);
  }, [leads]);

  /** Julian: "make it one page and scrollable columns". Wide, the desk fills
   * the screen from where it starts and each column scrolls on its own. */
  const fit = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const size = () => {
      el.style.height = matchMedia("(min-width: 1024px)").matches
        ? `${Math.max(480, innerHeight - (el.getBoundingClientRect().top + scrollY) - 24)}px`
        : "";
    };
    size();
    addEventListener("resize", size);
    return () => removeEventListener("resize", size);
  }, []);

  /** A change from the open lead, reflected in its row at once. */
  // A cleared snooze comes back without the key, so set it outright.
  const changed = (l: Lead) => setLeads((rows) => rows?.map((r) => (r.email === l.email ? { ...r, ...l, snoozeUntil: l.snoozeUntil, archivedAt: l.archivedAt, trashedAt: l.trashedAt, due: l.remind?.at, dueText: l.remind?.text.slice(0, 40), quote: l.quote, licence: l.licence, id: r.id } : r)) ?? null);

  if (error === "Not authorized." || error?.startsWith("GitHub did not accept"))
    return (
      <SignIn
        onKey={(k) => {
          // A GitHub token goes where /admin keeps it, so it is sent as Bearer;
          // the inbox key would win over it, so that one is dropped.
          if (/^(ghp_|github_pat_)/.test(k)) {
            window.localStorage.setItem(TOKEN_STORE, k);
            window.localStorage.removeItem(KEY_STORE);
          } else window.localStorage.setItem(KEY_STORE, k);
          setError(null);
          load();
        }}
        wrong={!!(window.localStorage.getItem(KEY_STORE) || window.localStorage.getItem(TOKEN_STORE))}
      />
    );
  if (error) return <p className="py-8 text-[15px] text-muted-foreground">{error}</p>;
  if (!leads) return <p className="py-8 font-mono text-[13px] text-muted-foreground">Loading leads</p>;

  const count = (f: Filter) => leads.filter((l) => pass(l, f)).length;
  const words = query.trim().toLowerCase();
  const shown = leads
    .filter((l) => pass(l, filter))
    .filter((l) => matches(l, words))
    .sort(filter === "upcoming" ? (a, b) => a.when!.localeCompare(b.when!) : (a, b) => b.lastAt.localeCompare(a.lastAt));
  const current = leads.find((l) => l.id === open);
  const tab = tabOf(filter);
  const tool = TOOLS.includes(filter);
  const needs = count("needs");
  const pick = (f: Filter) => { setFilter(f); setOpen(null); scrollTo(0, 0); };
  const signOut = () => {
    try { localStorage.removeItem(KEY_STORE); localStorage.removeItem(TOKEN_STORE); } catch {}
    setLeads(null);
    setError("Not authorized.");
  };
  const boarding = board && filter === "open";
  /** A card dropped on a column: the same PATCH the stage buttons send. */
  const move = (l: LeadSummary, stage: Stage) => {
    setLeads((rows) => rows?.map((r) => (r.id === l.id ? { ...r, stage } : r)) ?? null);
    call({ method: "PATCH", body: JSON.stringify({ key: `lead:${l.id}`, stage }) })
      .then((o) => { changed(o.lead as Lead); if (l.id === open) setMoved((n) => n + 1); })
      .catch((e: unknown) => { alert(e instanceof Error ? e.message : String(e)); load(); });
  };
  const doExport = () => exportCsv().catch((e: unknown) => alert(e instanceof Error ? e.message : String(e)));
  // The new lead from the POST itself: KV lists lag a fresh write and cache the
  // duplicate check's miss for ~60s, so a reload here would not find it yet.
  const added = (id: string, lead: Lead) => {
    setFresh(lead);
    setLeads((rows) => [{ ...leadSummary(lead), id }, ...(rows ?? []).filter((r) => r.id !== id)]);
    setFilter("open");
    setOpen(id);
  };
  // A lead picked from the palette: its own list, if this one does not show it.
  const jump = (l: LeadSummary) => {
    if (!shown.includes(l)) {
      setFilter(l.trashedAt ? "trash" : l.archivedAt ? "archived" : snoozed(l) ? "snoozed" : l.stage);
      setQuery("");
    }
    setOpen(l.id ?? null);
  };
  const device = (
    <>
      <PushSwitch call={call} />
      <ImportInbox call={call} done={load} />
      <button type="button" onClick={signOut} className="min-h-11 w-fit px-3 text-left font-mono text-[12.5px] text-muted-foreground hoverable:hover:text-foreground">
        Sign out on this device
      </button>
    </>
  );

  return (
    // Sentence case and a text face, as in the approved mock: the site sets
    // everything else in mono capitals, buttons included.
    <div
      // The global Lenis eats wheel events, so the panes and board columns would not scroll.
      data-lenis-prevent
      style={{ fontFamily: 'var(--font-v2-text, "Helvetica Neue", Helvetica, Arial, sans-serif)', letterSpacing: 0, ...(listW ? { "--list-w": `${listW}px` } : {}) } as React.CSSProperties}
      ref={fit}
      className={cn(
        "normal-case text-foreground max-lg:pb-[calc(84px+env(safe-area-inset-bottom))] lg:relative lg:grid lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden lg:rounded-[14px] lg:border lg:border-border lg:bg-background [&_button]:normal-case [&_h1]:normal-case [&_h2]:normal-case [&_h3]:normal-case",
        // Proofs runs its own list + card, so it takes the lead pane's width too.
        filter === "proofs" || filter === "today" ? "lg:grid-cols-[220px_minmax(0,1fr)]" : boarding ? "lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,420px)]" : "lg:grid-cols-[220px_minmax(0,var(--list-w,420px))_minmax(0,1fr)]",
      )}
    >
      {/* Desktop: the sidebar. Every list, then this device's switches. */}
      <nav aria-label="Lead lists" className="hidden min-h-0 flex-col overflow-y-auto border-r border-border p-3.5 lg:flex">
        <button type="button" onClick={() => pick("new")} className={cn(btn, primary, "mb-2 min-h-10 text-[14.5px]")}>New lead</button>
        {desk ? (
          <>
            <SideLink on={filter === "today"} n={needs} onClick={() => pick("today")}>Today</SideLink>
            <SideGroup>Clients</SideGroup>
            <SideLink on={filter === "needs"} n={needs} onClick={() => pick("needs")}>Your move</SideLink>
            <SideLink on={filter === "open" || STAGES.includes(filter as Stage) || MORE.includes(filter)} n={count("open")} onClick={() => pick("open")}>Leads</SideLink>
            <SideLink on={filter === "upcoming"} n={count("upcoming")} onClick={() => pick("upcoming")}>Calendar</SideLink>
            <SideLink on={filter === "proofs"} onClick={() => pick("proofs")}>Proofs</SideLink>
            <SideLink on={filter === "money"} onClick={() => pick("money")}>Money</SideLink>
            <SideLink on={filter === "licences"} onClick={() => pick("licences")}>Licences</SideLink>
            <SideGroup>Site</SideGroup>
            {SITE.map(([t, href]) => <SideLink key={t} on={false} href={href}>{t}</SideLink>)}
            <SideGroup>Numbers</SideGroup>
            <SideLink on={filter === "traffic"} onClick={() => pick("traffic")}>Traffic</SideLink>
            <SideLink on={filter === "seo"} onClick={() => pick("seo")}>SEO</SideLink>
            <SideLink on={filter === "stats"} onClick={() => pick("stats")}>Stats</SideLink>
            <SideGroup>Setup</SideGroup>
            <SideLink on={filter === "hours"} onClick={() => pick("hours")}>Hours</SideLink>
            <SideLink on={filter === "templates"} onClick={() => pick("templates")}>Templates</SideLink>
            <SideLink on={false} onClick={doExport}>Export CSV</SideLink>
          </>
        ) : <>
        {(["needs", "open", "upcoming"] as const).map((f) => (
          <SideLink key={f} on={filter === f} n={count(f)} onClick={() => pick(f)}>{label(f)}</SideLink>
        ))}
        <SideGroup>Stage</SideGroup>
        {OPEN_STAGES.map((s) => <SideLink key={s} on={filter === s} n={count(s)} onClick={() => pick(s)}>{s}</SideLink>)}
        <SideGroup>Closed</SideGroup>
        {(["Delivered", "Lost"] as const).map((s) => <SideLink key={s} on={filter === s} n={count(s)} onClick={() => pick(s)}>{s}</SideLink>)}
        <SideGroup>Put aside</SideGroup>
        {(["snoozed", "archived", "trash"] as const).map((f) => <SideLink key={f} on={filter === f} n={count(f)} onClick={() => pick(f)}>{label(f)}</SideLink>)}
        <SideGroup>Tools</SideGroup>
        <SideLink on={filter === "stats"} onClick={() => pick("stats")}>Stats</SideLink>
        <SideLink on={filter === "money"} onClick={() => pick("money")}>Money</SideLink>
        <SideLink on={filter === "templates"} onClick={() => pick("templates")}>Templates</SideLink>
        <SideLink on={filter === "licences"} onClick={() => pick("licences")}>Licences</SideLink>
        <SideLink on={false} onClick={doExport}>Export CSV</SideLink>
        <SideGroup>Proofs</SideGroup>
        <SideLink on={filter === "proofs"} onClick={() => pick("proofs")}>Galleries</SideLink>
        <SideGroup>Booking</SideGroup>
        <SideLink on={filter === "hours"} onClick={() => pick("hours")}>Hours</SideLink>
        </>}
        <div className="mt-auto grid border-t border-border pt-2">{device}</div>
      </nav>

      <section aria-label="Leads" className={cn("min-w-0 lg:min-h-0 lg:border-r lg:border-border", boarding ? "lg:flex lg:flex-col" : "lg:overflow-y-auto", open && "max-lg:hidden")}>
        {/* Phone: the pull. Turns as it fills, spins once it commits. */}
        <div aria-hidden="true" className="grid place-items-center overflow-hidden text-muted-foreground lg:hidden" style={{ height: pull || (refreshing ? 40 : 0), transition: pull ? "none" : "height 200ms ease-out" }}>
          <svg viewBox="0 0 24 24" className={cn("size-[18px] fill-none stroke-current stroke-[1.8]", refreshing && "animate-spin", pull >= PULL_AT && "text-accent")} style={refreshing ? undefined : { transform: `rotate(${(pull / PULL_AT) * 270}deg)` }}><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" /></svg>
        </div>
        {filter === "today" ? null : <header className="grid gap-3.5 border-b border-border px-3 pb-4 pt-3 lg:px-7 lg:pt-6">
          {tabOf(filter) !== "more" && (
            <p className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
              {needs ? `${needs} waiting on you` : "Nothing waiting on you"}
            </p>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <h1 style={HEAD} className="min-w-0 whitespace-nowrap text-[40px] leading-none tracking-[-0.03em] lg:text-[28px]">{desk && filter === "upcoming" ? "Calendar" : label(filter)}</h1>
            {tool ? null : (
              <span className="flex items-center gap-3">
                {filter === "open" ? (
                  <span className="hidden overflow-hidden rounded-lg border border-border font-mono text-[12px] lg:inline-flex">
                    {(["List", "Board"] as const).map((v) => (
                      <button key={v} type="button" aria-pressed={board === (v === "Board")} onClick={() => setBoard(v === "Board")} className={cn("px-2.5 py-1", board === (v === "Board") ? "bg-card text-foreground" : "text-muted-foreground hoverable:hover:text-foreground")}>{v}</button>
                    ))}
                  </span>
                ) : null}
                <span className="hidden font-mono text-[12.5px] text-muted-foreground lg:inline">{shown.length} {shown.length === 1 ? "lead" : "leads"}</span>
                <button type="button" onClick={refresh} disabled={refreshing} aria-label="Refresh" title="Refresh (U)" className="grid size-11 place-items-center rounded-[10px] text-muted-foreground hoverable:hover:text-foreground disabled:opacity-60 lg:size-8">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className={cn("size-[17px] fill-none stroke-current stroke-[1.8]", refreshing && "animate-spin")}><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" /></svg>
                </button>
                <button type="button" onClick={() => pick("new")} aria-label="New lead" className="grid size-11 place-items-center rounded-[10px] border border-border text-[22px] leading-none text-accent lg:hidden">+</button>
              </span>
            )}
          </div>
          {tool ? null : (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email or message"
              aria-label="Search leads"
              className="min-h-11 w-full rounded-[10px] border border-border bg-transparent px-3.5 text-base normal-case placeholder:normal-case placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-accent lg:text-[14.5px]"
            />
          )}
          {/* Phone: the stages ride in the Open tab as one row of chips. */}
          {tab === "open" || (desk && MORE.includes(filter)) ? (
            <div className={cn("-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5", desk ? "lg:flex-wrap" : "lg:hidden")}>
              {(["open", ...OPEN_STAGES, ...(desk ? MORE : [])] as const).map((f) => (
                <Pill key={f} on={filter === f} n={count(f)} onClick={() => pick(f)}>{f === "open" ? "All" : label(f)}</Pill>
              ))}
            </div>
          ) : null}
          {MORE.includes(filter) || (tool && filter !== "more") ? (
            <button type="button" onClick={() => pick("more")} className="inline-flex min-h-11 w-fit items-center gap-1 text-[16px] text-accent lg:hidden">
              <span aria-hidden="true">‹</span> More
            </button>
          ) : null}
        </header>}

        {filter === "today" ? (
          <DeskToday leads={leads} go={(l) => { setFilter(pass(l, "needs") ? "needs" : "open"); setOpen(l.id ?? null); }} pick={pick} />
        ) : filter === "traffic" ? (
          <div className="px-1 py-5 lg:px-7"><React.Suspense fallback={null}><AdminTraffic /></React.Suspense></div>
        ) : filter === "seo" ? (
          <div className="px-1 py-5 lg:px-7"><React.Suspense fallback={null}><AdminSeo /></React.Suspense></div>
        ) : filter === "more" ? (
          <div className="grid gap-6 py-4 lg:hidden">
            <ul className="grid">
              {MORE.map((f) => (
                <li key={f}>
                  <button type="button" onClick={() => pick(f)} className="flex min-h-[52px] w-full items-center justify-between border-b border-border px-1 text-left text-[17px]">
                    {label(f)}
                    <span className="flex items-center gap-3 font-mono text-[13px] text-muted-foreground">{count(f)} <span aria-hidden="true">›</span></span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={() => pick("hours")} className="flex min-h-[52px] w-full items-center justify-between border-b border-border px-1 text-left text-[17px]">
                  Hours <span aria-hidden="true" className="font-mono text-[13px] text-muted-foreground">›</span>
                </button>
              </li>
            </ul>
            <ul className="grid">
              <li><p className="px-1 pb-1 font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">Tools</p></li>
              {([["new", "New lead"], ["stats", "Stats"], ["money", "Money"], ["templates", "Templates"], ["licences", "Licences"], ["proofs", "Proofs"]] as const).map(([f, t]) => (
                <li key={f}>
                  <button type="button" onClick={() => pick(f)} className="flex min-h-[52px] w-full items-center justify-between border-b border-border px-1 text-left text-[17px]">
                    {t}<span aria-hidden="true" className="font-mono text-[13px] text-muted-foreground">›</span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={doExport} className="flex min-h-[52px] w-full items-center justify-between border-b border-border px-1 text-left text-[17px]">
                  Export CSV<span aria-hidden="true" className="font-mono text-[13px] text-muted-foreground">↓</span>
                </button>
              </li>
            </ul>
            <div className="grid">
              <p className="px-1 pb-1 font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">This device</p>
              {device}
            </div>
          </div>
        ) : filter === "new" ? (
          <NewLeadForm call={call} done={added} />
        ) : filter === "stats" ? (
          <StatsView call={call} />
        ) : filter === "money" ? (
          <MoneyView />
        ) : filter === "templates" ? (
          <TemplatesEditor call={call} templates={templates} saved={setTemplates} />
        ) : filter === "licences" ? (
          <LicenceList leads={leads.filter((l) => !l.trashedAt)} row={(l) => <Row l={l} on={open === l.id} upcoming={false} onClick={() => setOpen(l.id ?? null)} />} />
        ) : filter === "hours" ? (
          <LeadHours />
        ) : filter === "proofs" ? (
          <ProofsDesk />
        ) : filter === "upcoming" && !words ? (
          <LeadUpcoming
            leads={leads.filter((l) => l.when && !pass(l, "trash"))}
            row={(l) => <Row l={l} on={open === l.id} upcoming onClick={() => setOpen(l.id ?? null)} />}
          />
        ) : (
          <>
            {filter === "trash" && shown.length ? <EmptyTrash n={shown.length} call={call} done={() => { setOpen(null); load(); }} /> : null}
            {boarding ? (
              <div className="hidden min-h-0 flex-1 lg:flex">
                <LeadBoard leads={leads.filter((l) => !aside(l) && l.stage !== "Lost" && (!words || [l.name, l.email, l.kind, l.snippet].some((v) => v?.toLowerCase().includes(words))))} onMove={move} card={(l) => <Card l={l} on={open === l.id} onClick={() => setOpen(l.id ?? null)} />} />
              </div>
            ) : null}
            {shown.length ? (
              <ul className={cn(boarding && "lg:hidden")}>
                {shown.map((l) => (
                  <li key={l.id}>
                    <Row l={l} on={open === l.id} upcoming={filter === "upcoming"} onClick={() => setOpen(l.id ?? null)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className={cn("px-1 py-10 text-[15px] text-muted-foreground lg:px-5", boarding && "lg:hidden")}>
                {words ? "Nothing matches." : filter === "needs" ? "Nothing waiting on you." : filter === "upcoming" ? "No calls or sessions coming up." : "No leads here."}
              </p>
            )}
          </>
        )}
      </section>

      {boarding || filter === "proofs" || filter === "today" ? null : <ListResizer w={listW ?? LIST_W} onChange={setListW} />}

      <section aria-label="Lead" className={cn("min-w-0 lg:min-h-0 lg:overflow-y-auto lg:bg-card/40", !open && "max-lg:hidden", (filter === "proofs" || filter === "today") && "hidden")}>
        {current ? (
          <Detail key={`${current.id}-${moved}`} summary={current} initial={fresh?.email === current.email ? fresh : null} call={call} onChange={changed} onBack={() => { back.current = current.id ?? null; setOpen(null); }} reload={load} tick={tick} templates={templates} others={leads.filter((o) => o.id !== current.id && !o.trashedAt)} />
        ) : (
          <p className="px-8 py-10 text-[15px] text-muted-foreground max-lg:hidden">Pick a lead to see it here.</p>
        )}
      </section>

      <DeskKeys leads={leads} shown={shown} open={open} setOpen={setOpen} jump={jump} pick={pick} refresh={refresh} />

      {/* Phone: the tab bar, in thumb reach, above the home indicator. */}
      <nav
        aria-label="Lead tabs"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-background/95 px-1.5 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-md lg:hidden"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pick(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn("relative flex min-h-[52px] flex-col items-center justify-center gap-1 font-mono text-[10.5px] tracking-[0.02em]", tab === t.id ? "text-accent" : "text-muted-foreground")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[23px] fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]">{t.icon}</svg>
            {t.label}
            {t.id === "needs" && needs ? (
              <span className="absolute left-[calc(50%+5px)] top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-accent px-1 text-[10.5px] font-semibold text-accent-foreground">{needs}</span>
            ) : null}
          </button>
        ))}
      </nav>
    </div>
  );
}

/**
 * Julian (2026-11-08): keyboard shortcuts. List keys live here, on capture so
 * an open overlay can keep them from the lead; the lead's own keys live in
 * Detail. Nothing renders until a key opens it, so the phone never sees it.
 */
function DeskKeys({ leads, shown, open, setOpen, jump, pick, refresh }: { leads: LeadSummary[]; shown: LeadSummary[]; open: string | null; setOpen: (id: string | null) => void; jump: (l: LeadSummary) => void; pick: (f: Filter) => void; refresh: () => void }) {
  const [palette, setPalette] = React.useState(false);
  const [help, setHelp] = React.useState(false);
  // Where the open lead sat: once read, it can drop out of Your move, and J / K go on from its place.
  const row = React.useRef(-1);
  React.useEffect(() => {
    const i = shown.findIndex((l) => l.id === open);
    if (i >= 0 || !open) row.current = i;
  });
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const k = leadKey(e, typingIn(e.target), false);
      if (palette) {
        // Its own field takes the rest; Cmd K again closes it.
        if (k?.do === "palette") { e.preventDefault(); setPalette(false); }
        return;
      }
      if (help) {
        if (!k) return;
        e.preventDefault();
        if (k.do === "close" || k.do === "help") setHelp(false);
        return;
      }
      if (!k) return;
      if (k.do === "palette") setPalette(true);
      else if (k.do === "help") setHelp(true);
      else if (k.do === "new") pick("new");
      else if (k.do === "refresh") refresh();
      else if (k.do === "move") {
        const i = shown.findIndex((l) => l.id === open);
        // Gone from the list: the row below has slid into its place, so J stays put.
        const to = i >= 0 ? i + k.by : row.current < 0 ? 0 : row.current + (k.by < 0 ? -1 : 0);
        const next = shown[Math.min(shown.length - 1, Math.max(0, to))];
        if (!next?.id) return;
        setOpen(next.id);
        document.querySelector(`[data-lead="${CSS.escape(next.id)}"]`)?.scrollIntoView({ block: "nearest" });
      } else return;
      e.preventDefault();
    };
    addEventListener("keydown", on, true);
    return () => removeEventListener("keydown", on, true);
  });
  if (palette) return <Palette leads={leads} close={() => setPalette(false)} go={jump} />;
  if (!help) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={() => setHelp(false)} className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm">
      <div className="mx-auto mt-[16vh] w-[min(420px,calc(100%-32px))] rounded-[14px] border border-border bg-background p-5 shadow-2xl">
        <p className="pb-3 font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">Shortcuts</p>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2.5 text-[14.5px]">
          {LEAD_KEYS.map(([k, t]) => (
            <React.Fragment key={k}><dt>{t}</dt><dd className="text-right font-mono text-[12.5px] text-muted-foreground">{k}</dd></React.Fragment>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** Cmd K: jump to any lead by name, email or type of shoot. */
function Palette({ leads, close, go }: { leads: LeadSummary[]; close: () => void; go: (l: LeadSummary) => void }) {
  const [q, setQ] = React.useState("");
  const [at, setAt] = React.useState(0);
  const words = q.trim().toLowerCase();
  const hits = leads.filter((l) => !l.trashedAt && matches(l, words)).sort((a, b) => b.lastAt.localeCompare(a.lastAt)).slice(0, 8);
  const choose = (l?: LeadSummary) => { if (!l) return; close(); go(l); };
  return (
    <div role="dialog" aria-modal="true" aria-label="Jump to a lead" onMouseDown={(e) => e.target === e.currentTarget && close()} className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm">
      <div className="mx-auto mt-[16vh] w-[min(520px,calc(100%-32px))] overflow-hidden rounded-[14px] border border-border bg-background shadow-2xl">
        <input
          autoFocus
          value={q}
          onChange={(e) => { setQ(e.target.value); setAt(0); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            else if (e.key === "ArrowDown") setAt((i) => Math.min(hits.length - 1, i + 1));
            else if (e.key === "ArrowUp") setAt((i) => Math.max(0, i - 1));
            else if (e.key === "Enter") choose(hits[at]);
            else return;
            e.preventDefault();
          }}
          placeholder="Jump to a lead"
          aria-label="Jump to a lead"
          className="min-h-12 w-full border-b border-border bg-transparent px-4 text-[15px] outline-none placeholder:text-muted-foreground"
        />
        {hits.length ? (
          <ul className="max-h-[50vh] overflow-y-auto py-1">
            {hits.map((l, i) => (
              <li key={l.id}>
                <button type="button" onMouseEnter={() => setAt(i)} onClick={() => choose(l)} aria-current={i === at ? "true" : undefined} className={cn("flex w-full items-baseline gap-3 px-4 py-2.5 text-left", i === at && "bg-card shadow-[inset_3px_0_0_var(--accent)]")}>
                  <span className="truncate text-[15px] font-medium">{l.name}</span>
                  <span className="truncate font-mono text-[12px] text-muted-foreground">{[kindOf(l.kind), l.email].filter(Boolean).join(" · ")}</span>
                  <span className="ml-auto shrink-0 font-mono text-[12px] text-muted-foreground">{l.stage}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-4 text-[14.5px] text-muted-foreground">Nothing matches.</p>
        )}
      </div>
    </div>
  );
}

type Tab = "needs" | "open" | "upcoming" | "more";
const OPEN_STAGES = STAGES.filter((s) => !closed(s));
/** The lists under More on the phone (the sidebar's lower groups on desktop). */
const MORE: Filter[] = ["snoozed", "archived", "trash", "Delivered", "Lost"];
const tabOf = (f: Filter): Tab => (f === "needs" || f === "upcoming" ? f : TOOLS.includes(f) || MORE.includes(f) ? "more" : "open");
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "needs", label: "Your move", icon: <><path d="M4 13l3-8h10l3 8v6H4z" /><path d="M4 13h5l1 2h4l1-2h5" /></> },
  { id: "open", label: "Open", icon: <path d="M5 6h14M5 12h14M5 18h9" /> },
  { id: "upcoming", label: "Upcoming", icon: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></> },
  { id: "more", label: "More", icon: <><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></> },
];

/** The road a lead travels; Lost is off it. */
const STEPS: readonly Stage[] = STAGES.filter((s) => s !== "Lost");

/** How far a lead has come: a short segment per stage, then its name. */
function StageLine({ l }: { l: LeadSummary }) {
  const at = STEPS.indexOf(l.stage);
  return (
    <span className="flex shrink-0 items-center gap-2.5 font-mono text-[12px] text-muted-foreground">
      {at >= 0 ? (
        <span aria-hidden="true" className="flex shrink-0 gap-[3px]">
          {STEPS.map((s, k) => <i key={s} className={cn("h-[3px] w-3 rounded-full", k < at ? "bg-foreground/55" : k === at ? "bg-foreground" : "bg-border")} />)}
        </span>
      ) : null}
      <span className="truncate font-medium text-foreground">{l.stage}</span>
      {isLate(l, now()) ? <span className="shrink-0 text-accent">{ago(l.stageAt)}</span> : null}
    </span>
  );
}

/** The one thing to do, in teal; money stuck in red; otherwise why it is put aside. */
function RowAction({ l, next }: { l: LeadSummary; next: string | null }) {
  // Wraps instead of cutting: Julian wants the whole step on the row.
  const cls = "min-w-0 text-right font-mono text-[12.5px] font-medium [text-wrap:balance]";
  if (l.trashedAt) return <span className={cn(cls, "text-muted-foreground")}>Deletes in {Math.max(1, trashDaysLeft(l.trashedAt, now()))} d</span>;
  const bad = l.flags?.includes("stuck") ? "Deposit stuck" : l.flags?.includes("no-deposit") ? "No deposit" : null;
  if (bad) return <span className={cn(cls, "text-destructive")}>! {bad} →</span>;
  if (next) return <span title={next} className={cn(cls, "text-accent")}>{next}{" "}→</span>;
  if (snoozed(l)) return <span className={cn(cls, "text-muted-foreground")}>Until {day(l.snoozeUntil!)}</span>;
  return l.refs ? <span className={cn(cls, "text-muted-foreground")}>{l.refs} {l.refs === 1 ? "picture" : "pictures"}</span> : null;
}

/** One lead in a list: who, what and when, the start of their message, where it stands and what is next. */
function Row({ l, on, upcoming, onClick }: { l: LeadSummary; on: boolean; upcoming: boolean; onClick: () => void }) {
  const next = nextStep(l);
  return (
    <button
      type="button"
      onClick={onClick}
      data-lead={l.id}
      aria-current={on ? "true" : undefined}
      className={cn(
        "flex w-full gap-3 border-b border-border px-3 py-[18px] text-left transition-colors duration-200 hoverable:hover:bg-card lg:px-7",
        on && "bg-card shadow-[inset_3px_0_0_var(--accent)]",
      )}
    >
      <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-0.5">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
            {l.kind ? <b className="font-medium text-foreground" title={kindOf(l.kind)}>{shootTag(l.kind)}</b> : null}
            {l.kind && l.when ? " · " : null}
            {l.when ? at(l.when) : null}
          </span>
          <span className="shrink-0 font-mono text-[12px] text-muted-foreground">{upcoming && l.when ? day(l.when) : ago(l.lastAt)}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2 text-[18px] font-semibold tracking-[-0.01em]">
          {l.unread ? <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="New" /> : null}
          <span className="truncate">{l.name}</span>
        </span>
        {l.snippet ? <span className="line-clamp-2 text-[14.5px] leading-snug text-muted-foreground">{l.snippet}</span> : null}
        <span className="mt-2 flex items-center justify-between gap-3">
          <StageLine l={l} />
          <RowAction l={l} next={next} />
        </span>
      </span>
    </button>
  );
}

/** A row cut down for the board: kind and age, name, the next step, the quote. */
function Card({ l, on, onClick }: { l: LeadSummary; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-lead={l.id}
      aria-current={on ? "true" : undefined}
      className={cn("grid w-full gap-0.5 rounded-[10px] bg-card px-2.5 py-2 text-left transition-colors duration-200 hoverable:hover:bg-muted", on && "shadow-[inset_3px_0_0_var(--accent)]")}
    >
      <span className="flex justify-between gap-2 font-mono text-[10.5px] uppercase tracking-[0.09em] text-muted-foreground">
        <span className="truncate" title={kindOf(l.kind)}>{shootTag(l.kind)}</span>
        <span className="shrink-0">{ago(l.lastAt)}</span>
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold">
        {l.unread ? <span className="size-[7px] shrink-0 rounded-full bg-accent" aria-label="New" /> : null}
        <span className="truncate">{l.name}</span>
      </span>
      <span className="mt-1 flex items-center justify-between gap-2">
        <span className="min-w-0 text-left"><RowAction l={l} next={nextStep(l)} /></span>
        {l.quote ? <span className="shrink-0 font-mono text-[11.5px] text-muted-foreground">{money(l.quote)}</span> : null}
      </span>
    </button>
  );
}

const LIST_W_STORE = "jg-leads-list-w";
const LIST_W = 420;
const clampW = (w: number) => Math.min(720, Math.max(300, Math.round(w)));

/** Desktop: the line between the list and the open lead. Drag or arrow keys to move it, double-click to reset. */
function ListResizer({ w, onChange }: { w: number; onChange: (w: number | null) => void }) {
  const drag = React.useRef<{ x: number; w: number } | null>(null);
  const save = (v: number | null) => {
    onChange(v);
    try {
      if (v) window.localStorage.setItem(LIST_W_STORE, String(v));
      else window.localStorage.removeItem(LIST_W_STORE);
    } catch {}
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="List width"
      aria-valuenow={w}
      aria-valuemin={300}
      aria-valuemax={720}
      tabIndex={0}
      title="Drag to resize, double-click to reset"
      style={{ left: `calc(220px + ${w}px - 3px)` }}
      className="absolute inset-y-0 z-10 hidden w-1.5 cursor-col-resize touch-none outline-none hoverable:hover:bg-accent/40 focus-visible:bg-accent/60 lg:block"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, w };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => drag.current && onChange(clampW(drag.current.w + e.clientX - drag.current.x))}
      onPointerUp={(e) => {
        if (!drag.current) return;
        save(clampW(drag.current.w + e.clientX - drag.current.x));
        drag.current = null;
      }}
      onDoubleClick={() => save(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          save(clampW(w + (e.key === "ArrowLeft" ? -16 : 16)));
        }
      }}
    />
  );
}

function SideGroup({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pb-1.5 pt-4 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{children}</p>;
}

function SideLink({ on, n, onClick, href, children }: { on: boolean; n?: number; onClick?: () => void; href?: string; children: React.ReactNode }) {
  const El = href ? "a" : "button";
  return (
    <El
      {...(href ? { href } : { type: "button" as const, onClick, "aria-pressed": on })}
      className={cn(
        "flex min-h-10 items-center justify-between gap-4 rounded-lg px-3 text-[14.5px] transition-colors duration-200",
        on ? "bg-card font-semibold text-foreground shadow-[inset_2px_0_0_var(--accent)]" : "text-muted-foreground hoverable:hover:bg-card hoverable:hover:text-foreground",
      )}
    >
      <span>{children}</span>
      {n === undefined || n < 0 ? null : <span className={cn("font-mono text-[12.5px]", on ? "text-accent" : "text-muted-foreground")}>{n}</span>}
    </El>
  );
}

function Pill({ on, n, onClick, children }: { on: boolean; n: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 font-mono text-[12.5px]",
        on ? "border-accent text-accent" : "border-border text-muted-foreground",
      )}
    >
      {children} <span className={on ? "text-accent" : "text-muted-foreground/70"}>{n}</span>
    </button>
  );
}

/** The inbox key, pasted once per device. On the iPhone the installed app keeps
    its own storage apart from Safari, so it asks once there too. A password
    field, so a password manager can fill it. */
/** Notifications for this device: a new lead pings the installed app. */
const PUSH_FLAG = "jg-leads-push";
const SW_URL = "/admin/leads/sw.js";
/** The app is the whole origin on leads.juliangigola.com, /admin/leads on the main site. */
const swScope = () => (location.hostname.startsWith("leads.") ? "/" : "/admin/leads");
const OFFLINE = "Offline. The desk loads again when you are back online.";
/** The unread count on the app icon (iPhone home screen, desktop dock), and
 * where the service worker reads it to add one per push. */
function badge(n: number) {
  try {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    (n ? nav.setAppBadge?.(n) : nav.clearAppBadge?.())?.catch(() => {});
    caches?.open("leads-badge").then((c) => c.put("n", new Response(String(n)))).catch(() => {});
  } catch {}
}
function PushSwitch({ call }: { call: Call }) {
  // The desk renders only in the browser (after its list loads), so these read the page directly.
  const able = typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  const [on, setOn] = React.useState<boolean | null>(null);
  const [note, setNote] = React.useState<string | null>(() =>
    able ? null : /iPhone|iPad/.test(navigator.userAgent) ? "Open the installed Leads app to turn these on." : "This browser cannot do notifications.",
  );
  React.useEffect(() => {
    if (!able) return;
    navigator.serviceWorker.getRegistration(swScope()).then((r) => r?.pushManager.getSubscription()).then((s) => setOn(!!s)).catch(() => setOn(false));
  }, [able]);

  const turnOn = async () => {
    setNote(null);
    try {
      if ((await Notification.requestPermission()) !== "granted") return setNote("Notifications are blocked for this app in Settings.");
      const reg = await navigator.serviceWorker.register(SW_URL, { scope: swScope() });
      await navigator.serviceWorker.ready;
      const { key } = (await call({ query: "?vapid" })) as { key: string };
      const raw = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
      await call({ method: "PATCH", body: JSON.stringify({ push: sub.toJSON() }) });
      try { localStorage.setItem(PUSH_FLAG, "1"); } catch {}
      setOn(true);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  };
  const turnOff = async () => {
    try {
      const sub = await (await navigator.serviceWorker.getRegistration(swScope()))?.pushManager.getSubscription();
      if (sub) {
        await call({ method: "PATCH", body: JSON.stringify({ push: { endpoint: sub.endpoint }, off: true }) });
        await sub.unsubscribe();
      }
      setOn(false);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  };
  const sendTest = async () => {
    setNote("Sending.");
    try {
      const { devices } = (await call({ method: "PATCH", body: JSON.stringify({ test: true }) })) as { devices: number };
      setNote(devices ? `Arrives in 10 seconds on ${devices} ${devices === 1 ? "device" : "devices"}. Lock the phone now: no banner shows while the app is open.` : "No device is subscribed. Turn notifications off and on again here.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="grid gap-1 px-3 pt-4 font-mono text-[12.5px] text-muted-foreground">
      {on === null ? null : (
        <button type="button" onClick={on ? turnOff : turnOn} className="min-h-11 w-fit text-left hoverable:hover:text-foreground">
          Notifications: <span className={on ? "text-accent" : undefined}>{on ? "on" : "off"}</span>
        </button>
      )}
      {on ? (
        <button type="button" onClick={sendTest} className="min-h-11 w-fit text-left hoverable:hover:text-foreground">
          Send a test
        </button>
      ) : null}
      {note ? <p>{note}</p> : null}
    </div>
  );
}

type Count = { people: number; added: number; updated: number; stages: Partial<Record<Stage, number>> };

/** Julian: "add the stuff i have in my juliangigola admin inbox to my leads".
 * Counts first (a dry run), imports only on his second press. */
function ImportInbox({ call, done }: { call: Call; done: () => void }) {
  const [count, setCount] = React.useState<Count | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const run = (dry: boolean) => {
    setBusy(true);
    setNote(null);
    call({ method: "POST", body: JSON.stringify({ backfill: true, dry }) })
      .then((o) => {
        const c = o as unknown as Count;
        if (dry) return c.added + c.updated ? setCount(c) : setNote("Everything in the Inbox is already here.");
        setCount(null);
        setNote(`Imported: ${c.added} new, ${c.updated} updated.`);
        done();
      })
      .catch((e: unknown) => setNote(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };
  const by = count ? Object.entries(count.stages).map(([s, n]) => `${s} ${n}`).join(", ") : "";
  return (
    <div className="grid gap-2 px-3 pt-4 font-mono text-[12.5px] text-muted-foreground">
      {count ? (
        <>
          <p>
            {count.added} new{by ? ` (${by})` : ""}, {count.updated} updated, from {count.people} {count.people === 1 ? "person" : "people"} in the Inbox.
          </p>
          <p className="flex gap-4">
            <button type="button" disabled={busy} onClick={() => run(false)} className="min-h-11 text-accent">Import</button>
            <button type="button" disabled={busy} onClick={() => setCount(null)} className="min-h-11">Cancel</button>
          </p>
        </>
      ) : (
        <button type="button" disabled={busy} onClick={() => run(true)} className="min-h-11 w-fit text-left hoverable:hover:text-foreground">
          {busy ? "Counting" : "Import from Inbox"}
        </button>
      )}
      {note ? <p>{note}</p> : null}
    </div>
  );
}

function SignIn({ onKey, wrong }: { onKey: (k: string) => void; wrong: boolean }) {
  const [k, setK] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (k.trim()) onKey(k.trim());
      }}
      className="grid max-w-md gap-4 py-10 normal-case"
    >
      <h1 className="sr-only">Leads</h1>
      <label htmlFor="lead-key" className="text-[15px]">Inbox key or GitHub token</label>
      <input
        id="lead-key"
        type="password"
        autoComplete="current-password"
        value={k}
        onChange={(e) => setK(e.target.value)}
        className="min-h-12 rounded-[10px] border border-border bg-background px-4 text-base normal-case"
      />
      {wrong ? <p className="text-[15px] text-destructive">That was not accepted. Paste it again.</p> : null}
      <details className="text-[15px] text-muted-foreground">
        <summary className="flex size-11 cursor-pointer list-none items-center font-mono text-[15px]" aria-label="How to get one">?</summary>
        <div className="grid gap-2 pt-2 leading-[1.55]">
          <p>Easiest: paste the same GitHub token I use for /admin on desktop.</p>
          <p>
            To make one on this phone: github.com, Settings, Developer settings, Fine-grained tokens, Generate new token.
            Repository access: only gigolajulian/juliangigola-com. Permissions: Contents, Read and write.
          </p>
          <p>It stays on this device only.</p>
        </div>
      </details>
      <button type="submit" className={cn(btn, primary, "justify-self-start")}>Open leads</button>
    </form>
  );
}

function pass(l: LeadSummary, f: Filter) {
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
const LABEL: Partial<Record<Filter, string>> = { today: "Today", traffic: "Traffic", seo: "SEO", needs: "Your move", open: "All open", upcoming: "Upcoming", snoozed: "Snoozed", archived: "Archived", trash: "Trash", more: "More", new: "New lead", stats: "Stats", money: "Money", templates: "Templates", hours: "Hours", proofs: "Proofs", licences: "Licences" };
const label = (f: Filter) => LABEL[f] ?? f;

/** Deletes every lead in the trash for good, after a second press. */
function EmptyTrash({ n, call, done }: { n: number; call: Call; done: () => void }) {
  const [sure, setSure] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const empty = () => {
    setBusy(true);
    call({ method: "DELETE", body: JSON.stringify({ emptyTrash: true }) }).then(done).catch(() => {}).finally(() => { setBusy(false); setSure(false); });
  };
  return (
    <p className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3 text-[15px]">
      {sure ? (
        <>
          <span>Delete {n} for good? This cannot be undone.</span>
          <button type="button" disabled={busy} onClick={empty} className={cn(btn, "text-destructive")}>Delete for good</button>
          <button type="button" disabled={busy} onClick={() => setSure(false)} className={btn}>Cancel</button>
        </>
      ) : (
        <button type="button" onClick={() => setSure(true)} className={btn}>Empty trash</button>
      )}
    </p>
  );
}

type Call = (init?: RequestInit & { query?: string }) => Promise<Record<string, unknown>>;

function Detail({ summary, initial, call, onChange, onBack, reload, tick, templates, others }: { summary: LeadSummary; initial?: Lead | null; call: Call; onChange: (l: Lead) => void; onBack: () => void; reload: () => void; tick: number; templates: Template[]; others: LeadSummary[] }) {
  const [lead, setLead] = React.useState<Lead | null>(initial ?? null);
  const [message, setMessage] = React.useState<Enquiry | null>(null);
  const [msgKey, setMsgKey] = React.useState<string | null>(null);
  const [asked, setAsked] = React.useState(false);
  const [snoozing, setSnoozing] = React.useState(false);
  const key = `lead:${summary.id}`;

  const patch = React.useCallback(
    async (body: Record<string, unknown>) => {
      const o = await call({ method: "PATCH", body: JSON.stringify({ key, ...body }) });
      const next = o.lead as Lead;
      setLead(next);
      onChange(next);
      // A merge deletes the other record; the list has to drop it.
      if (body.mergeFrom) reload();
    },
    [call, key, onChange, reload],
  );

  React.useEffect(() => {
    let live = true;
    call({ query: `?key=${encodeURIComponent(key)}` }).then(async (o) => {
      if (!live) return;
      const l = o.lead as Lead;
      setLead(l);
      // Their latest words, from the raw row the form stored.
      const ref = [...l.events].reverse().find((e) => e.kind === "inquiry" && e.ref)?.ref;
      if (ref)
        call({ query: `?key=${encodeURIComponent(ref)}` })
          .then((m) => live && (setMessage(m.enquiry as Enquiry), setMsgKey(ref)))
          .catch(() => {});
      if (l.unread) patch({ seen: true }).catch(() => {});
    }).catch(() => {});
    return () => void (live = false);
    // Once per lead, and again on a refresh (`tick`): `patch` is stable for the same key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  // On a phone the tapped row is gone, so focus starts at the lead's name.
  const title = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    if (matchMedia("(max-width: 1023px)").matches) title.current?.focus();
  }, []);

  const l = lead ?? summary;
  const first = l.name.split(" ")[0];
  const late = isLate(l, now());
  // The nudge that is due, as his matching template.
  const nudge = templates.find((t) => t.id === `nudge${NUDGES.indexOf(quoteNudge(l, now()) as (typeof NUDGES)[number]) + 1}`);
  const reply = compose(l.email, `Re: your ${l.kind ?? "shoot"} inquiry`, `Hi ${first},\n\n`);
  const book = compose(l.email, "Booking a time", `Hi ${first},\n\nYou can pick a time here: https://juliangigola.com/book\n\n`);
  // The buttons and the keys share these.
  const snoozeFor = (d: number) => patch({ snoozeUntil: new Date(now() + d * DAY).toISOString() }).then(() => setSnoozing(false));
  const archive = () => patch({ archive: !l.archivedAt });
  const setStage = (s: Stage) => l.stage !== s && patch({ stage: s });
  const replyLink = React.useRef<HTMLAnchorElement>(null);
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => {
      // DeskKeys took it: an overlay is open.
      if (e.defaultPrevented) return;
      const k = leadKey(e, typingIn(e.target), snoozing);
      if (k?.do === "reply" && replyLink.current) replyLink.current.click();
      else if (k?.do === "snooze") setSnoozing((v) => !v);
      else if (k?.do === "snoozeFor") snoozeFor(k.days);
      else if (k?.do === "archive" && !l.trashedAt) archive();
      else if (k?.do === "stage") setStage(STAGES[k.at]);
      else if (k?.do === "close" && snoozing) setSnoozing(false);
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 px-6 py-8 lg:px-11 lg:py-9">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1 justify-self-start text-[16px] text-accent lg:hidden">
        <span aria-hidden="true">‹</span> Leads
      </button>
      <header className="min-w-0">
        {kindOf(l.kind) ? <p className="font-mono text-[11px] font-medium uppercase tracking-[0.09em]">{kindOf(l.kind)}</p> : null}
        <h1 ref={title} tabIndex={-1} style={HEAD} className="mt-1 text-[30px] leading-tight outline-none">{l.name}</h1>
        <p className="mt-1 break-words text-[15px] text-muted-foreground">{l.email}</p>
        {l.stage === "Lost" ? (
          <p className="mt-5"><Tag tone="quiet" mark={MARK.Lost}>Lost</Tag></p>
        ) : (
          <ol aria-label={`Stage: ${l.stage}`} className="mt-5 grid grid-cols-9 gap-1">
            {STEPS.map((s, k) => {
              const at = STEPS.indexOf(l.stage);
              return (
                <li key={s} aria-current={k === at ? "step" : undefined} className={cn("truncate border-t-[3px] pt-2 font-mono text-[11px]", k < at ? "border-foreground/55 text-muted-foreground" : k === at ? "border-foreground font-medium text-foreground" : "border-border text-muted-foreground")}>
                  {/* A phone is too narrow for nine names: the line alone, the current one named below. */}
                  <span className="max-sm:sr-only">{s === "Call booked" ? "Call" : s}</span>
                </li>
              );
            })}
          </ol>
        )}
        {l.stage !== "Lost" ? <p aria-hidden="true" className="mt-2 font-mono text-[12px] font-medium sm:hidden">{l.stage}</p> : null}
      </header>

      {late ? (
        <p role="status" className="flex items-center gap-3 rounded-xl bg-accent/12 px-4 py-3.5 text-[15px]">
          <span aria-hidden="true" className="text-accent">◷</span>
          <span><b className="font-semibold text-accent">{ago(l.stageAt)} waiting.</b> {l.stage === "Quoted" ? (quoteNudge(l, now()) === "Mark as lost?" ? "Three nudges, no answer. Mark it lost?" : "The quote has had no answer.") : "The site promises a reply within a day."}</span>
          {nudge && mailable(l.email) ? <a href={ios() ? mailto(l.email, fill(nudge.subject, l), fill(nudge.body, l)) : compose(l.email, fill(nudge.subject, l), fill(nudge.body, l))} target="_blank" rel="noreferrer" className="ml-auto shrink-0 font-mono text-[12.5px] font-medium text-accent">{nudge.name} →</a> : null}
        </p>
      ) : null}
      {renew(l) && mailable(l.email) ? (() => {
        const t = templates.find((x) => x.id === "renew") ?? TEMPLATES.find((x) => x.id === "renew")!;
        const subject = fill(t.subject, l);
        const body = fill(t.body, l);
        return (
          <p role="status" className="flex flex-wrap items-center gap-3 rounded-xl bg-accent/12 px-4 py-3.5 text-[15px]">
            <span className="flex-1"><b className="font-semibold text-accent">Licence ends {endDay(l.licence!.end)}.</b> {l.licence!.use}</span>
            <a href={ios() ? mailto(l.email, subject, body) : compose(l.email, subject, body)} target="_blank" rel="noreferrer" className={cn(btn, primary)}>Renew licence</a>
          </p>
        );
      })() : null}
      {l.trashedAt ? (
        <p role="status" className="font-mono text-[13px] text-muted-foreground">
          In the trash. Deleted for good in {Math.max(1, trashDaysLeft(l.trashedAt, now()))} days unless recovered.
        </p>
      ) : null}
      {l.flags?.includes("stuck") ? (
        <p role="status" className="rounded-xl bg-destructive/10 px-4 py-3.5 text-[15px] text-destructive">
          A deposit was paid but not booked. Refund or rebook it in Stripe.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        {mailable(l.email) ? (<>
        <a ref={replyLink} href={reply} target="_blank" rel="noreferrer" onClick={() => setAsked(true)} className={cn(btn, !renew(l) && primary, "min-h-[52px] px-5 text-base")}>
          Reply in Gmail
        </a>
        {ios() ? (
          <a
            href={mailto(l.email, `Re: your ${l.kind ?? "shoot"} inquiry`, `Hi ${first},\n\n`, message ? { name: message.name, at: message.at, text: message.message } : undefined)}
            onClick={() => setAsked(true)}
            className={btn}
          >
            Reply in Mail
          </a>
        ) : null}
        <a href={book} target="_blank" rel="noreferrer" className={btn}>Send booking link</a>
        </>) : null}
        <button type="button" onClick={() => setSnoozing((v) => !v)} aria-expanded={snoozing} className={btn}>Snooze</button>
        {snoozed(l) ? <button type="button" className={btn} onClick={() => patch({ snoozeUntil: "" }).then(() => setSnoozing(false))}>Unsnooze</button> : null}
        {l.trashedAt ? null : <button type="button" className={btn} onClick={archive}>{l.archivedAt ? "Unarchive" : "Archive"}</button>}
        <button type="button" className={btn} onClick={() => patch({ trash: !l.trashedAt })}>{l.trashedAt ? "Recover" : "Move to trash"}</button>
        <button type="button" className={btn} onClick={() => patch({ seen: false }).then(onBack)}>Mark unread</button>
        <span className="flex-1" />
        {lead?.notion ? <a href={`https://www.notion.so/${lead.notion.replace(/-/g, "")}`} target="_blank" rel="noreferrer" className={btn}>Notion</a> : null}
      </div>

      {asked && l.stage === "Inquiry" ? (
        <p className="flex flex-wrap items-center gap-3 text-[15px]">
          Sent it?
          <button type="button" className={btn} onClick={() => patch({ stage: "Replied" }).then(() => setAsked(false))}>Mark as Replied</button>
        </p>
      ) : null}
      {snoozing ? (
        <div className="flex flex-wrap gap-2">
          {[["1 day", 1], ["3 days", 3], ["1 week", 7]].map(([t, d]) => (
            <button key={t} type="button" className={btn} onClick={() => snoozeFor(Number(d))}>{t}</button>
          ))}
          <label className={cn(btn, "gap-2")}>
            Until
            <input
              type="date"
              min={new Date(now() + DAY).toISOString().slice(0, 10)}
              onChange={(e) => e.target.value && patch({ snoozeUntil: new Date(`${e.target.value}T09:00:00`).toISOString() }).then(() => setSnoozing(false))}
              className="bg-transparent font-mono text-[14px]"
            />
          </label>
        </div>
      ) : null}

      <fieldset className="grid gap-2.5">
        <legend className="mb-2.5 font-mono text-[13px] text-muted-foreground">Stage</legend>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={l.stage === s}
              onClick={() => setStage(s)}
              className={cn(
                "min-h-11 rounded-[4px] border px-3 font-mono text-[12.5px] transition-colors duration-200",
                l.stage === s
                  ? "border-accent bg-accent font-semibold text-accent-foreground"
                  : STAGES.indexOf(s) < STAGES.indexOf(l.stage) && s !== "Lost"
                    ? "border-border text-foreground hoverable:hover:bg-card"
                    : "border-dashed border-border text-muted-foreground hoverable:hover:bg-card",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </fieldset>

      {(["Confirmed", "Shot", "Delivered"] as Stage[]).includes(l.stage) ? <Paperwork l={l} patch={patch} /> : null}

      <LeadProofs email={l.email} />

      <LeadCrm l={l} full={lead} patch={patch} others={others} templates={templates} />

      {message ? (
        <div className="grid gap-2">
          {message.detail ? <p className="text-[15px] text-muted-foreground">{message.detail}</p> : null}
          <p className="max-w-[64ch] whitespace-pre-line rounded-xl bg-background px-4 py-4 text-[15px] leading-relaxed">{message.message}</p>
          {/* Their uploads come through /api/inbox with the same key as everything here; never a public URL. */}
          {msgKey && (message.files?.length || message.picks?.length) ? (
            <References msgKey={msgKey} enquiry={message} auth={credentials(window.localStorage.getItem(KEY_STORE) ?? "")} />
          ) : null}
        </div>
      ) : null}

      <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[15px]">
        <dt className="font-mono text-[13px] leading-6 text-muted-foreground">First seen</dt>
        <dd>{at(l.firstAt)}</dd>
        {l.when ? (<><dt className="font-mono text-[13px] leading-6 text-muted-foreground">Booked for</dt><dd>{at(l.when)}</dd></>) : null}
        {message?.context?.referrer || message?.context?.landing ? (
          <><dt className="font-mono text-[13px] leading-6 text-muted-foreground">Came from</dt><dd className="break-words">{[message.context.referrer, message.context.landing].filter(Boolean).join(", ")}</dd></>
        ) : null}
      </dl>

      {lead ? (
        <section aria-label="Timeline" className="grid gap-2.5">
          <h3 aria-level={2} style={{ ...HEAD, fontFamily: "var(--font-mono)", fontWeight: 400, letterSpacing: 0 }} className="text-[13px] text-muted-foreground">Timeline</h3>
          <ol className="grid gap-2">
            {[...lead.events].reverse().map((e, i) => (
              <li key={i} className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 text-[14.5px]">
                <span className="font-mono text-[13px] leading-6 text-muted-foreground">{day(e.at)}</span>
                <span className="break-words">{line(e)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

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

/* ── the CRM tools: a lead by hand, the numbers, templates, the export ── */

const field = "min-h-11 w-full rounded-[10px] border border-border bg-transparent px-3.5 text-base normal-case placeholder:normal-case placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-accent";
const fieldLabel = "grid gap-1.5 text-[14px] text-muted-foreground";
const SOURCES = ["Instagram DM", "Referral", "Text", "Phone call", "Email", "In person", "Other"];
const LOST_REASONS = ["Price", "Dates", "No reply", "Went elsewhere", "Not a fit", "Other"];

/** A lead he adds himself: someone who wrote on Instagram, texted, or was referred. */
function NewLeadForm({ call, done }: { call: Call; done: (id: string, lead: Lead) => void }) {
  const [f, setF] = React.useState({ name: "", email: "", ig: "", phone: "", company: "", kind: "", stage: "Inquiry" as Stage, source: "Instagram DM", notes: "" });
  const [note, setNote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { const v = e.target.value; setF((p) => ({ ...p, [k]: v })); };
  return (
    <form
      className="grid gap-4 px-1 py-5 lg:px-5"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setNote(null);
        call({ method: "POST", body: JSON.stringify({ add: f }) })
          .then((o) => done(o.id as string, o.lead as Lead))
          .catch((err: unknown) => setNote(err instanceof Error ? err.message : String(err)))
          .finally(() => setBusy(false));
      }}
    >
      <label className={fieldLabel}>Name<input required value={f.name} onChange={set("name")} className={field} autoComplete="off" /></label>
      <p className="font-mono text-[12px] text-muted-foreground">One of these three, so the lead has a way back to them.</p>
      <label className={fieldLabel}>Email<input type="email" value={f.email} onChange={set("email")} className={field} autoComplete="off" /></label>
      <label className={fieldLabel}>Instagram<input value={f.ig} onChange={set("ig")} placeholder="@handle" className={field} autoComplete="off" /></label>
      <label className={fieldLabel}>Phone<input type="tel" value={f.phone} onChange={set("phone")} className={field} autoComplete="off" /></label>
      <label className={fieldLabel}>Brand or company<input value={f.company} onChange={set("company")} className={field} autoComplete="off" /></label>
      <label className={fieldLabel}>What they want<input value={f.kind} onChange={set("kind")} placeholder="Portrait, campaign, wedding" className={field} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className={fieldLabel}>Stage
          <select value={f.stage} onChange={set("stage")} className={field}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
        <label className={fieldLabel}>Came from
          <select value={f.source} onChange={set("source")} className={field}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
      </div>
      <label className={fieldLabel}>Notes<textarea value={f.notes} onChange={set("notes")} rows={4} className={cn(field, "py-3 leading-relaxed")} /></label>
      {note ? <p role="alert" className="text-[15px] text-destructive">{note}</p> : null}
      <button type="submit" disabled={busy} className={cn(btn, primary, "justify-self-start")}>{busy ? "Adding" : "Add lead"}</button>
    </form>
  );
}

type Stats = {
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
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const hours = (h: number | null) => (h === null ? "None yet" : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} d`);

/** The numbers: is the site turning inquiries into bookings, and how fast does he answer. */
function StatsView({ call }: { call: Call }) {
  const [s, setS] = React.useState<Stats | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => {
    call({ query: "?stats" }).then((o) => setS(o.stats as Stats)).catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, [call]);
  if (err) return <p className="px-1 py-8 text-[15px] text-muted-foreground lg:px-5">{err}</p>;
  if (!s) return <p className="px-1 py-8 font-mono text-[13px] text-muted-foreground lg:px-5">Counting</p>;
  const top = Math.max(1, ...s.weeks.map((w) => w.inquiries));
  const tile = (k: string, v: string, hint: string) => (
    <div className="grid gap-1 rounded-xl border border-border p-3.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{k}</span>
      <span style={HEAD} className="text-[26px] leading-none">{v}</span>
      <span className="text-[12.5px] text-muted-foreground">{hint}</span>
    </div>
  );
  return (
    <div className="grid gap-6 px-1 py-5 lg:px-5">
      <div className="grid grid-cols-2 gap-2.5">
        {tile("Booked", s.bookedRate === null ? "None yet" : `${Math.round(s.bookedRate * 100)}%`, "of leads over a week old")}
        {tile("First reply", hours(s.replyHours), "median, inquiry to answer")}
        {tile("Quoted, open", money(s.pipeline), "waiting on an answer")}
        {tile("Booked value", money(s.won), "from the quotes you entered")}
      </div>
      <section className="grid gap-2.5">
        <h3 aria-level={2} className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Last 12 weeks</h3>
        <div className="flex h-32 items-end gap-1.5" role="img" aria-label={s.weeks.map((w) => `Week of ${w.start}: ${w.inquiries} inquiries, ${w.booked} booked`).join(". ")}>
          {s.weeks.map((w) => (
            <div key={w.start} className="relative flex h-full flex-1 items-end" title={`Week of ${w.start}: ${w.inquiries} in, ${w.booked} booked`}>
              <div className="w-full rounded-t-[3px] bg-border" style={{ height: `${(w.inquiries / top) * 100}%` }} />
              <div className="absolute bottom-0 w-full rounded-t-[3px] bg-accent" style={{ height: `${(Math.min(w.booked, w.inquiries || w.booked) / top) * 100}%` }} />
            </div>
          ))}
        </div>
        <p className="flex gap-4 font-mono text-[12px] text-muted-foreground">
          <span><span className="mr-1.5 inline-block size-2.5 rounded-[2px] bg-border align-middle" />Inquiries</span>
          <span><span className="mr-1.5 inline-block size-2.5 rounded-[2px] bg-accent align-middle" />Booked</span>
        </p>
      </section>
      <section className="grid gap-1">
        <h3 aria-level={2} className="pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Where they came from</h3>
        {s.sources.length ? s.sources.map((r) => (
          <p key={r.source} className="flex justify-between gap-3 border-b border-border py-2.5 text-[15px]">
            <span className="truncate">{r.source}</span>
            <span className="shrink-0 font-mono text-[13px] text-muted-foreground">{r.leads} in · <b className="font-medium text-accent">{r.booked} booked</b></span>
          </p>
        )) : <p className="text-[15px] text-muted-foreground">Nothing yet.</p>}
      </section>
      <section className="grid gap-1">
        <h3 aria-level={2} className="pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Why they were lost</h3>
        {s.lost.length ? s.lost.map((r) => (
          <p key={r.reason} className="flex justify-between border-b border-border py-2.5 text-[15px]"><span>{r.reason}</span><span className="font-mono text-[13px] text-muted-foreground">{r.n}</span></p>
        )) : <p className="text-[15px] text-muted-foreground">None lost.</p>}
      </section>
      <section className="grid gap-1">
        <h3 aria-level={2} className="pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">By stage · {s.total} leads</h3>
        {STAGES.map((st) => (
          <p key={st} className="flex justify-between border-b border-border py-2.5 text-[15px]"><span>{st}</span><span className="font-mono text-[13px] text-muted-foreground">{s.stages[st] ?? 0}</span></p>
        ))}
      </section>
    </div>
  );
}

type Template = { id: string; name: string; subject: string; body: string };

/** His saved replies. {first}, {name}, {kind} and {when} are filled per lead. */
function TemplatesEditor({ call, templates, saved }: { call: Call; templates: Template[]; saved: (t: Template[]) => void }) {
  const [list, setList] = React.useState(templates);
  const [note, setNote] = React.useState<string | null>(null);
  const edit = (i: number, k: keyof Template) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setList(list.map((t, j) => (j === i ? { ...t, [k]: e.target.value } : t)));
  const save = () =>
    call({ method: "PATCH", body: JSON.stringify({ templates: list }) })
      .then((o) => { saved(o.templates as Template[]); setList(o.templates as Template[]); setNote("Saved."); })
      .catch((e: unknown) => setNote(e instanceof Error ? e.message : String(e)));
  return (
    <div className="grid gap-5 px-1 py-5 lg:px-5">
      <p className="text-[14px] text-muted-foreground">
        <code className="font-mono text-[13px] text-foreground">{"{first}"}</code>, <code className="font-mono text-[13px] text-foreground">{"{name}"}</code>,{" "}
        <code className="font-mono text-[13px] text-foreground">{"{kind}"}</code> and <code className="font-mono text-[13px] text-foreground">{"{when}"}</code> fill in for each lead.
      </p>
      {list.map((t, i) => (
        <fieldset key={t.id + i} className="grid gap-2.5 rounded-xl border border-border p-3.5">
          <label className={fieldLabel}>Name<input value={t.name} onChange={edit(i, "name")} className={field} /></label>
          <label className={fieldLabel}>Subject<input value={t.subject} onChange={edit(i, "subject")} className={field} /></label>
          <label className={fieldLabel}>Message<textarea value={t.body} onChange={edit(i, "body")} rows={6} className={cn(field, "py-3 leading-relaxed")} /></label>
          <button type="button" onClick={() => setList(list.filter((_, j) => j !== i))} className={cn(btn, "justify-self-start text-destructive")}>Remove</button>
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2.5">
        <button type="button" onClick={() => setList([...list, { id: `t${Date.now()}`, name: "New template", subject: "", body: "Hi {first},\n\n\n\nJulian" }])} className={btn}>Add a template</button>
        <button type="button" onClick={save} className={cn(btn, primary)}>Save templates</button>
      </div>
      {note ? <p role="status" className="font-mono text-[13px] text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/** Every lead as a CSV file, through the same key as the rest of the desk. */
async function exportCsv() {
  const res = await fetch("/api/inbox?csv", { headers: credentials(window.localStorage.getItem(KEY_STORE) ?? ""), cache: "no-store" });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: `leads-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}


/** The CRM half of a lead: how to reach them, saved replies, a reminder, the quote, notes, merge. */
function LeadCrm({ l, full, patch, others, templates }: { l: LeadSummary; full: Lead | null; patch: (b: Record<string, unknown>) => Promise<void>; others: LeadSummary[]; templates: Template[] }) {
  const [editing, setEditing] = React.useState(false);
  const [d, setD] = React.useState({ name: "", phone: "", ig: "", company: "", source: "", kind: "" });
  const [notes, setNotes] = React.useState<string | null>(null);
  const [rAt, setRAt] = React.useState("");
  const [rText, setRText] = React.useState("");
  const [quote, setQuote] = React.useState<string | null>(null);
  const [into, setInto] = React.useState("");
  const [sure, setSure] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const run = (p: Promise<void>, ok?: string) => p.then(() => setNote(ok ?? null)).catch((e: unknown) => setNote(e instanceof Error ? e.message : String(e)));
  const mail = mailable(l.email);
  const ig = full?.ig ?? (l.email.startsWith("ig:") ? l.email.slice(3) : undefined);
  const phone = full?.phone ?? (l.email.startsWith("tel:") ? l.email.slice(4) : undefined);
  const local = (iso: string) => new Date(Date.parse(iso) - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
  const h3 = "font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
      {mail && templates.length ? (
        <section className="grid gap-2.5">
          <h3 aria-level={2} className={h3}>Reply with a template</h3>
          <div className="flex flex-wrap gap-2">
            {templates.filter((t) => t.id !== "renew" || l.licence).map((t) => {
              const subject = fill(t.subject, l);
              const body = fill(t.body, l);
              return (
                <a key={t.id} href={ios() ? mailto(l.email, subject, body) : compose(l.email, subject, body)} target="_blank" rel="noreferrer" className={btn}>
                  {t.name}
                </a>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="grid gap-2.5">
        <h3 aria-level={2} className={h3}>Contact</h3>
        {editing ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(patch({ details: d }).then(() => setEditing(false)), "Saved.");
            }}
          >
            {(["name", "phone", "ig", "company", "kind", "source"] as const).map((k) => (
              <label key={k} className={fieldLabel}>
                {{ name: "Name", phone: "Phone", ig: "Instagram", company: "Brand or company", kind: "What they want", source: "Came from" }[k]}
                <input value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} className={field} autoComplete="off" />
              </label>
            ))}
            <div className="flex gap-2.5">
              <button type="submit" className={cn(btn, primary)}>Save</button>
              <button type="button" onClick={() => setEditing(false)} className={btn}>Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-2 text-[15px]">
              {mail ? (<><dt className="font-mono text-[13px] leading-6 text-muted-foreground">Email</dt><dd className="break-words">{l.email}</dd></>) : null}
              {phone ? (<><dt className="font-mono text-[13px] leading-6 text-muted-foreground">Phone</dt><dd><a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="text-accent">{phone}</a></dd></>) : null}
              {ig ? (<><dt className="font-mono text-[13px] leading-6 text-muted-foreground">Instagram</dt><dd><a href={`https://instagram.com/${ig.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="text-accent">{ig}</a></dd></>) : null}
              {full?.company ? (<><dt className="font-mono text-[13px] leading-6 text-muted-foreground">Company</dt><dd>{full.company}</dd></>) : null}
              {full?.source ? (<><dt className="font-mono text-[13px] leading-6 text-muted-foreground">Came from</dt><dd>{full.source}</dd></>) : null}
            </dl>
            <button
              type="button"
              className={cn(btn, "justify-self-start")}
              onClick={() => {
                setD({ name: l.name, phone: full?.phone ?? "", ig: full?.ig ?? "", company: full?.company ?? "", kind: l.kind ?? "", source: full?.source ?? "" });
                setEditing(true);
              }}
            >
              Edit details
            </button>
          </>
        )}
      </section>

      <section className="grid gap-2.5">
        <h3 aria-level={2} className={h3}>Reminder</h3>
        {full?.remind ? (
          <p className="flex flex-wrap items-center gap-3 text-[15px]">
            <span><b className="font-semibold">{at(full.remind.at)}</b>{full.remind.text ? `: ${full.remind.text}` : ""}</span>
            <button type="button" className={btn} onClick={() => run(patch({ remind: null }), "Reminder cleared.")}>Clear</button>
          </p>
        ) : (
          <form
            className="flex flex-wrap items-end gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (rAt) run(patch({ remind: { at: new Date(rAt).toISOString(), text: rText } }).then(() => { setRAt(""); setRText(""); }), "Reminder set.");
            }}
          >
            <label className={fieldLabel}>When<input type="datetime-local" required value={rAt} min={local(new Date().toISOString())} onChange={(e) => setRAt(e.target.value)} className={cn(field, "w-auto font-mono text-[14px]")} /></label>
            {/* Short enough that the row always shows all of it. */}
            <label className={cn(fieldLabel, "min-w-[12rem] flex-1")}>
              <span className="flex justify-between">What for<span className="font-mono text-muted-foreground">{rText.length}/{REMIND_MAX}</span></span>
              <input value={rText} maxLength={REMIND_MAX} onChange={(e) => setRText(e.target.value)} placeholder="Send the quote" className={field} />
            </label>
            <button type="submit" className={btn}>Remind me</button>
          </form>
        )}
      </section>

      <Money l={l} full={full} patch={patch} run={run} quote={quote} setQuote={setQuote} />

      <section className="grid gap-2.5">
        <h3 aria-level={2} className={h3}>Notes</h3>
        <textarea
          value={notes ?? full?.notes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== null && notes !== (full?.notes ?? "") && run(patch({ notes }), "Notes saved.")}
          rows={5}
          placeholder="Only you see these."
          className={cn(field, "py-3 leading-relaxed")}
        />
      </section>

      {others.length ? (
        <section className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
          <h3 aria-level={2} className={h3}>Same person, another record</h3>
          <div className="flex flex-wrap items-end gap-2.5">
            <select value={into} onChange={(e) => { setInto(e.target.value); setSure(false); }} className={cn(field, "w-auto min-w-0 max-w-full")} aria-label="Record to merge in">
              <option value="">Pick the other record</option>
              {others.map((o) => <option key={o.id} value={o.id}>{o.name} · {mailable(o.email) ? o.email : o.email.slice(o.email.indexOf(":") + 1)}</option>)}
            </select>
            {into ? (
              sure ? (
                <button type="button" className={cn(btn, primary)} onClick={() => run(patch({ mergeFrom: `lead:${into}` }).then(() => { setInto(""); setSure(false); }), "Merged.")}>
                  Merge into this one
                </button>
              ) : (
                <button type="button" className={btn} onClick={() => setSure(true)}>Merge</button>
              )
            ) : null}
          </div>
          {sure ? <p className="text-[14px] text-muted-foreground">The timeline and notes of the other record move here, and it is deleted.</p> : null}
        </section>
      ) : null}

      {note ? <p role="status" className="font-mono text-[13px] text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/* ── money on a lead: the quote, the deposit, the balance, its invoices ──
 * Julian (2026-11-06, Leads plan B1 and A1). One block in place of a bare
 * quote field, a deposit row and a red Stripe button. */

const ledger = "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-[15px] tabular-nums";
const dt = "font-mono text-[13px] leading-6 text-muted-foreground";
const dd = "text-right font-mono text-[14px] leading-6";

/** A shape per paperwork status, so it never relies on color alone. */
const DOT: Record<Paper, string> = { "Not sent": "○", Sent: "◐", Signed: "●", "Not needed": "–" };

/** "Paperwork: Contract ● · Release ●", from Confirmed on. A tap moves a dot to its next status. */
function Paperwork({ l, patch }: { l: LeadSummary; patch: (b: Record<string, unknown>) => Promise<void> }) {
  const due = paperDue(l, now());
  return (
    <p className="flex flex-wrap items-center gap-x-1 font-mono text-[13px] text-muted-foreground">
      Paperwork:
      {(["contract", "release"] as const).map((k, i) => {
        const v = l[k] ?? "Not sent";
        const name = k === "contract" ? "Contract" : "Release";
        return (
          <span key={k} className="inline-flex items-center whitespace-nowrap">
            {i ? <span aria-hidden="true">·</span> : null}
            <button
              type="button"
              title={v}
              aria-label={`${name}: ${v}. Change`}
              onClick={() => patch({ [k]: PAPER[(PAPER.indexOf(v) + 1) % PAPER.length] }).catch(() => {})}
              className={cn("inline-flex min-h-11 items-center gap-1.5 px-1.5", due === k ? "text-accent" : v === "Signed" ? "text-foreground" : "")}
            >
              {name} <span aria-hidden="true">{DOT[v]}</span>
            </button>
          </span>
        );
      })}
    </p>
  );
}

function Money({ l, full, patch, run, quote, setQuote }: { l: LeadSummary; full: Lead | null; patch: (b: Record<string, unknown>) => Promise<void>; run: (p: Promise<void>, ok?: string) => void; quote: string | null; setQuote: (v: string | null) => void }) {
  const [making, setMaking] = React.useState(false);
  const paidAt = full?.deposit ? full.events.find((e) => e.kind === "booking")?.at : undefined;
  const q = full?.quote;
  const owed = q !== undefined ? q - (full?.deposit ? DEPOSIT : 0) : undefined;
  return (
    <section className="grid gap-3">
      <h3 aria-level={2} className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Money</h3>
      <div className="flex flex-wrap items-end gap-2.5">
        <label className={fieldLabel}>
          Quote in dollars
          <input
            inputMode="decimal"
            value={quote ?? (q !== undefined ? String(q) : "")}
            onChange={(e) => setQuote(e.target.value.replace(/[^\d.]/g, ""))}
            onBlur={() => {
              if (quote === null) return;
              const n = quote === "" ? null : Number(quote);
              if (n === null || Number.isFinite(n)) run(patch({ quote: n }), "Quote saved.");
            }}
            placeholder="0"
            className={cn(field, "w-40 font-mono")}
          />
        </label>
        {l.stage === "Lost" ? (
          <label className={fieldLabel}>
            Why it was lost
            <select value={full?.lostReason ?? ""} onChange={(e) => run(patch({ lostReason: e.target.value }), "Saved.")} className={cn(field, "w-auto")}>
              <option value="">Pick one</option>
              {LOST_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      <LicenceField key={full?.licence?.end ?? ""} full={full} patch={patch} run={run} cls={{ btn, field, label: fieldLabel }} />
      <dl className={ledger}>
        <dt className={dt}>{paidAt ? `Deposit, ${day(paidAt)}` : "Deposit"}</dt>
        <dd className={dd}>
          {full?.deposit ? <a href={full.deposit} target="_blank" rel="noreferrer" className="text-accent" aria-label={`${usd(DEPOSIT)} paid, open in Stripe`}>{usd(DEPOSIT)} paid</a> : <span className="text-muted-foreground">None</span>}
        </dd>
        {owed !== undefined ? (<><dt className={dt}>Balance</dt><dd className={cn(dd, "font-medium text-accent")}>{usd(owed)}</dd></>) : null}
      </dl>
      {full?.invoices?.length ? (
        <ul className="grid">
          {[...full.invoices].reverse().map((inv) => <InvoiceRow key={inv.no} inv={inv} l={l} full={full} />)}
        </ul>
      ) : null}
      {making && full ? (
        <InvoiceSheet l={l} full={full} patch={patch} done={() => setMaking(false)} />
      ) : (
        <button type="button" onClick={() => setMaking(true)} disabled={!full} className={cn(btn, primary, "justify-self-start")}>Make invoice</button>
      )}
    </section>
  );
}

/** Pacific today, as the date input wants it. */
const todayPT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
const authed = () => credentials(window.localStorage.getItem(KEY_STORE) ?? "");

/** The PDF of one invoice. Loaded on the tap, fonts and all. */
async function makePdf(inv: Invoice, l: LeadSummary, full: Lead) {
  const res = await fetch("/api/inbox?invoiceFrom", { headers: authed(), cache: "no-store" });
  const { from } = (await res.json()) as { from: InvoiceFrom | null };
  if (!from?.name) throw new Error("Add your details for invoices first.");
  const { invoicePdf } = await import("@/lib/invoice-pdf");
  return invoicePdf({ from, inv, to: { name: l.name, email: mailable(l.email) ? l.email : undefined, phone: full.phone } });
}

/** What he can do with the PDF. Nothing here sends. */
function Deliver({ file, inv, l }: { file: File; inv: Invoice; l: LeadSummary }) {
  const url = React.useMemo(() => URL.createObjectURL(file), [file]);
  React.useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const canShare = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  const first = l.name.split(" ")[0];
  const subject = `Invoice ${inv.no}${l.kind ? `, ${kindOf(l.kind)}` : ""}`;
  const body = `Hi ${first},\n\nAttached is invoice ${inv.no}. The balance is ${usd(balance(inv))}.\n\nThank you,\nJulian`;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2.5">
        {canShare ? (
          <button type="button" className={cn(btn, primary)} onClick={() => navigator.share({ files: [file], title: subject }).catch(() => {})}>Share PDF</button>
        ) : null}
        <a href={url} download={file.name} className={cn(btn, !canShare && primary)}>Download PDF</a>
        {mailable(l.email) ? <a href={compose(l.email, subject, body)} target="_blank" rel="noreferrer" className={btn}>Gmail draft</a> : null}
      </div>
      <p className="font-mono text-[12.5px] text-muted-foreground">Nothing is sent. The Gmail draft has no attachment: add the PDF before you send.</p>
    </div>
  );
}

function InvoiceRow({ inv, l, full }: { inv: Invoice; l: LeadSummary; full: Lead }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  return (
    <li className="grid gap-2 border-b border-border py-2.5">
      <p className="flex flex-wrap items-center justify-between gap-3 text-[15px]">
        <span><b className="font-mono font-medium">{inv.no}</b> <span className="text-muted-foreground">· {day(`${inv.date}T12:00:00`)} · {usd(balance(inv))} due</span></span>
        {file ? null : (
          <button type="button" className={cn(btn, "min-h-10")} onClick={() => { setErr(null); makePdf(inv, l, full).then(setFile, (e: unknown) => setErr(e instanceof Error ? e.message : String(e))); }}>PDF</button>
        )}
      </p>
      {file ? <Deliver file={file} inv={inv} l={l} /> : null}
      {err ? <p role="alert" className="text-[14px] text-destructive">{err}</p> : null}
    </li>
  );
}

type Line = { desc: string; qty: string; rate: string };

/** A new invoice, filled from the lead. Saving numbers it; then the PDF. */
function InvoiceSheet({ l, full, patch, done }: { l: LeadSummary; full: Lead; patch: (b: Record<string, unknown>) => Promise<void>; done: () => void }) {
  const [from, setFrom] = React.useState<InvoiceFrom | null>(null);
  const [editFrom, setEditFrom] = React.useState(false);
  const [date, setDate] = React.useState(todayPT);
  const [no, setNo] = React.useState("");
  const session = [kindOf(l.kind) ?? "Session", l.when ? day(l.when) : ""].filter(Boolean).join(", ");
  const [lines, setLines] = React.useState<Line[]>([{ desc: session, qty: "1", rate: full.quote !== undefined ? full.quote.toFixed(2) : "" }]);
  const [paid, setPaid] = React.useState(full.deposit ? DEPOSIT.toFixed(2) : "0");
  const [made, setMade] = React.useState<{ inv: Invoice; file: File } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch(`/api/inbox?invoiceNo=${date}`, { headers: authed(), cache: "no-store" })
      .then((r) => r.json() as Promise<{ from: InvoiceFrom | null; no?: string }>)
      .then((o) => {
        setNo(o.no ?? "");
        setFrom((f) => f ?? o.from ?? EMPTY_FROM);
        if (!o.from?.name) setEditFrom(true);
      })
      .catch(() => {});
  }, [date]);

  const parsed = lines.map((x) => ({ desc: x.desc.trim(), qty: Number(x.qty), rate: Number(x.rate) }));
  const owed = balance({ lines: parsed.map((x) => ({ ...x, qty: x.qty || 0, rate: x.rate || 0 })), paid: Number(paid) || 0 });
  const set = (i: number, k: keyof Line) => (e: React.ChangeEvent<HTMLInputElement>) => setLines(lines.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await patch({ invoice: { date, lines: parsed, paid: Number(paid) || 0 } });
      // The saved lead carries the number the Worker gave it.
      const got = await fetch(`/api/inbox?key=${encodeURIComponent(`lead:${l.id ?? ""}`)}`, { headers: authed(), cache: "no-store" });
      const fresh = ((await got.json()) as { lead: Lead }).lead;
      const inv = fresh.invoices!.at(-1)!;
      setMade({ inv, file: await makePdf(inv, l, fresh) });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (made)
    return (
      <div className="grid gap-3 rounded-xl border border-border p-3.5">
        <p className="text-[15px]">Invoice <b className="font-mono font-medium">{made.inv.no}</b> made, {usd(balance(made.inv))} due.</p>
        <Deliver file={made.file} inv={made.inv} l={l} />
        <button type="button" onClick={done} className={cn(btn, "justify-self-start")}>Done</button>
      </div>
    );

  return (
    <form className="grid gap-3.5 rounded-xl border border-border p-3.5" onSubmit={(e) => { e.preventDefault(); save(); }}>
      {from && editFrom ? <FromForm from={from} saved={(f) => { setFrom(f); setEditFrom(false); }} /> : null}
      <div className="grid grid-cols-2 gap-2.5">
        <div className={fieldLabel}>Invoice no.<span className="flex min-h-11 items-center font-mono text-[15px] text-foreground">{no || "…"}</span></div>
        <label className={fieldLabel}>Date<input type="date" required value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={cn(field, "font-mono text-[14px]")} /></label>
      </div>
      <p className="text-[15px]">To {l.name}{mailable(l.email) ? <span className="text-muted-foreground"> · {l.email}</span> : null}</p>
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Lines: description, quantity, rate</legend>
        {lines.map((x, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_52px_92px_44px] gap-2">
            <input aria-label={`Line ${i + 1} description`} required maxLength={48} value={x.desc} onChange={set(i, "desc")} className={cn(field, "px-3")} />
            <input aria-label={`Line ${i + 1} quantity`} required inputMode="decimal" value={x.qty} onChange={set(i, "qty")} className={cn(field, "px-2 text-right font-mono text-[14px]")} />
            <input aria-label={`Line ${i + 1} rate`} required inputMode="decimal" value={x.rate} onChange={set(i, "rate")} placeholder="0.00" className={cn(field, "px-2 text-right font-mono text-[14px]")} />
            {lines.length > 1 ? (
              <button type="button" aria-label={`Remove line ${i + 1}`} onClick={() => setLines(lines.filter((_, j) => j !== i))} className="grid size-11 place-items-center text-muted-foreground hoverable:hover:text-foreground">×</button>
            ) : <span aria-hidden="true" />}
          </div>
        ))}
        {lines.length < MAX_LINES ? (
          <button type="button" onClick={() => setLines([...lines, { desc: "", qty: "1", rate: "" }])} className={cn(btn, "min-h-10 justify-self-start")}>Add a line</button>
        ) : null}
      </fieldset>
      <label className="flex items-center justify-between gap-3 text-[14px] text-muted-foreground">
        Deposit paid
        <input inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value.replace(/[^\d.]/g, ""))} className={cn(field, "w-[92px] px-2 text-right font-mono text-[14px]")} />
      </label>
      <p className="flex justify-between font-mono text-[14px] text-muted-foreground">
        {Number(paid) ? "Balance due" : "Total"}<b className="text-[16px] font-medium text-accent">{usd(owed)}</b>
      </p>
      {err ? <p role="alert" className="text-[15px] text-destructive">{err}</p> : null}
      <div className="flex flex-wrap gap-2.5">
        <button type="submit" disabled={busy || !no} className={cn(btn, primary)}>{busy ? "Making" : "Save and make PDF"}</button>
        <button type="button" onClick={done} className={btn}>Cancel</button>
        {from && !editFrom ? <button type="button" onClick={() => setEditFrom(true)} className="min-h-11 px-2 font-mono text-[12.5px] text-muted-foreground hoverable:hover:text-foreground">Your details</button> : null}
      </div>
    </form>
  );
}

const EMPTY_FROM: InvoiceFrom = { name: "", a1: "", a2: "", a3: "", email: "hello@juliangigola.com", phone: "", ein: "", signoff: "Best,", notes: "" };
const FROM_FIELDS: [keyof InvoiceFrom, string][] = [["name", "Name on the invoice"], ["a1", "Address, line 1"], ["a2", "Address, line 2"], ["a3", "City, state, zip"], ["email", "Email"], ["phone", "Phone"], ["ein", "EIN line"], ["signoff", "Sign-off"], ["notes", "Notes on every invoice"]];

/** His details, once: sealed on the Worker, never in the code (the repo is public). */
function FromForm({ from, saved }: { from: InvoiceFrom; saved: (f: InvoiceFrom) => void }) {
  const [f, setF] = React.useState(from);
  const [err, setErr] = React.useState<string | null>(null);
  const save = () =>
    fetch("/api/inbox", { method: "PATCH", headers: { ...authed(), "content-type": "application/json" }, body: JSON.stringify({ invoiceFrom: f }) })
      .then(async (r) => {
        const o = (await r.json()) as { from?: InvoiceFrom; error?: string };
        if (!r.ok || !o.from) throw new Error(o.error ?? "Could not save.");
        saved(o.from);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  return (
    <fieldset className="grid gap-2.5 border-b border-border pb-3.5">
      <legend className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Your details for invoices</legend>
      {FROM_FIELDS.map(([k, t]) => (
        <label key={k} className={fieldLabel}>
          {t}
          {k === "notes"
            ? <textarea value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} rows={3} className={cn(field, "py-3 leading-relaxed")} />
            : <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={field} autoComplete="off" />}
        </label>
      ))}
      {err ? <p role="alert" className="text-[15px] text-destructive">{err}</p> : null}
      <button type="button" onClick={save} className={cn(btn, "justify-self-start")}>Save details</button>
    </fieldset>
  );
}

/* ── Money: his Stripe balance and what moved it ──────────────────
 * Julian (2026-11-06): "add my stripe balance too and show the
 * transactions in there". Read-only, through `/api/money`. */

type Txn = { id: string; at: string; type: string; amount: number; fee: number; net: number; currency: string; status: string; what: string };
const cash = (cents: number) => `${cents < 0 ? "−" : ""}$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Stripe's types in his words. */
const KIND: Record<string, string> = { charge: "Payment", payment: "Payment", refund: "Refund", payment_refund: "Refund", payout: "Payout", stripe_fee: "Stripe fee", adjustment: "Adjustment", dispute: "Dispute" };

function MoneyView() {
  const [top, setTop] = React.useState<{ available: number; pending: number; test: boolean } | null>(null);
  const [txns, setTxns] = React.useState<Txn[]>([]);
  const [more, setMore] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const page = React.useCallback((after?: string) => {
    fetch(`/api/money${after ? `?after=${after}` : ""}`, { headers: authed(), cache: "no-store" })
      .then(async (r) => {
        const o = (await r.json()) as { error?: string; available?: number; pending?: number; test?: boolean; txns: Txn[]; more: boolean };
        if (!r.ok) throw new Error(o.error ?? `Request failed (${r.status})`);
        if (o.available !== undefined) setTop({ available: o.available, pending: o.pending ?? 0, test: !!o.test });
        setTxns((t) => (after ? [...t, ...o.txns] : o.txns));
        setMore(o.more);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  }, []);
  React.useEffect(() => page(), [page]);

  if (err && !top) return <p className="px-1 py-8 text-[15px] text-muted-foreground lg:px-5">{err}</p>;
  if (!top) return <p className="px-1 py-8 font-mono text-[13px] text-muted-foreground lg:px-5">Asking Stripe</p>;
  const tile = (k: string, v: string, hint: string) => (
    <div className="grid gap-1 rounded-xl border border-border p-3.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{k}</span>
      <span style={HEAD} className="text-[26px] leading-none tabular-nums">{v}</span>
      <span className="text-[12.5px] text-muted-foreground">{hint}</span>
    </div>
  );
  return (
    <div className="grid gap-6 px-1 py-5 lg:px-5">
      {top.test ? <p className="font-mono text-[12.5px] text-muted-foreground">Stripe test mode: these are test payments.</p> : null}
      <div className="grid grid-cols-2 gap-2.5">
        {tile("Available", cash(top.available), "ready to pay out")}
        {tile("On the way", cash(top.pending), "not settled yet")}
      </div>
      <section className="grid">
        <h3 aria-level={2} className="pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Transactions</h3>
        {txns.length ? (
          <ul>
            {txns.map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-3 border-b border-border py-2.5">
                <span className="grid min-w-0">
                  <span className="truncate text-[15px]">{t.what || KIND[t.type] || t.type.replace(/_/g, " ")}</span>
                  <span className="font-mono text-[12px] text-muted-foreground">
                    {day(t.at)} · {KIND[t.type] ?? t.type.replace(/_/g, " ")}{t.status === "pending" ? " · on the way" : ""}{t.fee ? ` · fee ${cash(t.fee)}` : ""}
                  </span>
                </span>
                <span className={cn("shrink-0 font-mono text-[14px] tabular-nums", t.net < 0 ? "text-muted-foreground" : "text-foreground")}>{cash(t.net)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="py-2.5 text-[15px] text-muted-foreground">Nothing yet.</p>}
        {more ? <button type="button" disabled={busy} onClick={() => { setBusy(true); page(txns.at(-1)?.id); }} className={cn(btn, "mt-3 justify-self-start")}>{busy ? "Loading" : "Show more"}</button> : null}
        {err ? <p role="alert" className="pt-2 text-[14px] text-destructive">{err}</p> : null}
      </section>
      <p className="font-mono text-[12.5px] text-muted-foreground">Net is after the Stripe fee. Payouts show as money leaving the balance.</p>
    </div>
  );
}

/* ── Today, the One Desk's first page ─────────────────────────────
 * Julian (2026-11-09, mock claude.ai/artifact/Y2PXE3dJZcj7oJw5TyihLF, hero
 * C): the week as a row, Mon to Sun, with shoots, calls and what falls
 * due, then Your move, Coming up, Money and the site's traffic. Every
 * number is one the desk already has: lead summaries, `/api/money`,
 * `/api/traffic`. What is owed on invoices is left out: summaries do not
 * carry invoices and nothing marks one paid.
 * ─────────────────────────────────────────────────────────────── */

const PT = "America/Los_Angeles";
const ymdOf = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: PT }).format(ms);
const plus = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const dayHead = (d: string) => `${new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} ${+d.slice(8)}`;
const clock = (ms: number) => new Intl.DateTimeFormat("en-US", { timeZone: PT, hour: "numeric", minute: "2-digit" }).format(ms);
/** Where a move comes from, as the mock tags it. */
const source = (l: LeadSummary) => (renew(l) ? "Licence" : paperDue(l, now()) ? "Paperwork" : l.stage === "Invoiced" || l.stage === "Selecting" ? "Proofs" : "Leads");
const callOrShoot = (l: LeadSummary) => (l.stage === "Call booked" ? "Call" : shootTag(l.kind) ?? "Shoot");

type DayEv = { small: string; text: string; who?: string; due?: boolean; l: LeadSummary };

/** Each Pacific day from `from` for `n` days, with what is on it. Moves with no date land today. */
function daysOf(leads: LeadSummary[], from: string, n: number) {
  const today = ymdOf(now());
  const map = new Map<string, DayEv[]>();
  const put = (d: string, e: DayEv) => map.set(d, [...(map.get(d) ?? []), e]);
  for (const l of leads) {
    if (aside(l)) continue;
    const who = l.name || l.email;
    if (l.when && !closed(l.stage)) {
      const ms = Date.parse(l.when);
      put(ymdOf(ms), { small: `${clock(ms)} ${callOrShoot(l)}`, text: who, l });
    }
    const step = needsMe(l) ? nextStep(l) : null;
    if (step) put(today, { small: "Due", text: step, who, due: true, l });
    else if (l.due && Date.parse(l.due) > now()) put(ymdOf(Date.parse(l.due)), { small: "Reminder", text: l.dueText || "Your reminder", who, l });
  }
  return Array.from({ length: n }, (_, i) => plus(from, i)).map((d) => ({ d, today: d === today, evs: map.get(d) ?? [] }));
}

function DayCol({ d, today, evs, go }: { d: string; today: boolean; evs: DayEv[]; go: (l: LeadSummary) => void }) {
  const MAX = 4;
  return (
    <div className={cn("grid min-h-[110px] content-start gap-2 border-t-2 pt-2.5", today ? "border-accent" : "border-border")}>
      <span className={cn("font-mono text-[11px] uppercase tracking-[0.08em]", today ? "text-accent" : "text-muted-foreground")}>{dayHead(d)}</span>
      {evs.slice(0, MAX).map((e, i) => (
        <button key={i} type="button" onClick={() => go(e.l)} title={e.who} className={cn("grid min-w-0 text-left text-[13px] leading-[1.3] hoverable:hover:underline", e.due && "text-accent")}>
          <small className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-muted-foreground">{e.small}</small>
          <span className="truncate">{e.text}</span>
          {e.who && e.who !== e.text ? <span className="truncate text-[12px] text-muted-foreground">{e.who}</span> : null}
        </button>
      ))}
      {evs.length > MAX ? <span className="font-mono text-[11px] text-muted-foreground">+{evs.length - MAX} more</span> : null}
    </div>
  );
}

function Panel({ title, more, go, children }: { title: string; more: string; go: () => void; children: React.ReactNode }) {
  return (
    <section className="grid content-start">
      <h2 className="flex items-baseline justify-between border-b border-border pb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        {title}
        <button type="button" onClick={go} className="min-h-8 tracking-normal text-accent hoverable:hover:underline">{more} →</button>
      </h2>
      {children}
    </section>
  );
}

function Item({ k, t, n, s, onClick, className }: { k: React.ReactNode; t?: string; n: string; s?: string | null; onClick?: () => void; className?: string }) {
  const body = (
    <>
      <span className="truncate font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">{k}</span>
      <span className="text-right font-mono text-[12px] text-muted-foreground">{t}</span>
      <span className="truncate text-[16.5px] font-semibold">{n}</span>
      <span className="self-end text-right font-mono text-[12.5px] font-medium text-accent">{s ? `${s} →` : null}</span>
    </>
  );
  const cls = cn("grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-b border-border py-3 text-left", className);
  return onClick ? <button type="button" onClick={onClick} className={cn(cls, "transition-colors duration-200 hoverable:hover:bg-card")}>{body}</button> : <div className={cls}>{body}</div>;
}

type Spark = { visits: number; days: { key: string; n: number }[] };

function DeskToday({ leads, go, pick }: { leads: LeadSummary[]; go: (l: LeadSummary) => void; pick: (f: Filter) => void }) {
  const today = ymdOf(now());
  const monday = plus(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const week = daysOf(leads, monday, 7);
  // Phone: the next three days that have something, today first.
  const soon = daysOf(leads, today, 21).filter((x) => x.today || x.evs.length).slice(0, 3);
  const moves = leads.filter(needsMe).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  const coming = leads.filter((l) => pass(l, "upcoming")).sort((a, b) => a.when!.localeCompare(b.when!)).slice(0, 4);

  const [money, setMoney] = React.useState<{ available?: number; pending?: number; txns: Txn[] } | string | null>(null);
  React.useEffect(() => {
    fetch("/api/money", { headers: authed(), cache: "no-store" })
      .then(async (r) => { const o = await r.json(); if (!r.ok) throw new Error(o.error ?? `Request failed (${r.status})`); setMoney(o); })
      .catch((e: unknown) => setMoney(e instanceof Error ? e.message : String(e)));
  }, []);
  // Traffic answers to the GitHub token only, as on /admin.
  const [traffic, setTraffic] = React.useState<Spark | string | null>(null);
  React.useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORE);
    if (!token) return queueMicrotask(() => setTraffic("Sign in with the GitHub token to see traffic."));
    fetch("/api/traffic", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" })
      .then(async (r) => { const o = await r.json(); if (!r.ok) throw new Error(o.error ?? "Cloudflare did not answer."); setTraffic(o); })
      .catch((e: unknown) => setTraffic(e instanceof Error ? e.message : String(e)));
  }, []);
  const t = typeof traffic === "object" ? traffic : null;
  const peak = t ? Math.max(1, ...t.days.map((d) => d.n)) : 1;
  const spark = t ? t.days.map((d, i, a) => `${(i / Math.max(1, a.length - 1)) * 300},${44 - (d.n / peak) * 40}`).join(" ") : "";
  const wait = (s: string) => <p className="py-3 font-mono text-[13px] text-muted-foreground">{s}</p>;
  const note = (s: string) => <p className="py-3 text-[14px] text-muted-foreground">{s}</p>;

  return (
    <div className="grid content-start gap-8 px-1 py-5 lg:gap-[30px] lg:px-[34px] lg:py-[30px]">
      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          Week of {day(`${monday}T12:00:00Z`)} · <span className="text-accent">{moves.length} on you</span>
        </p>
        <h1 style={HEAD} className="mt-2 text-[30px] leading-tight max-lg:hidden">This week</h1>
        <div className="mt-[18px] grid grid-cols-7 gap-2 max-lg:hidden">
          {week.map((x) => <DayCol key={x.d} {...x} go={go} />)}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 lg:hidden">
          {soon.map((x) => <DayCol key={x.d} {...x} go={go} />)}
        </div>
      </section>
      <div className="grid gap-[26px] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Your move" more="All leads" go={() => pick("needs")}>
          {moves.length ? moves.slice(0, 5).map((l, i) => (
            <Item
              key={l.id}
              className={cn(i >= 3 && "max-lg:hidden")}
              onClick={() => go(l)}
              k={<>{l.kind ? <b className="font-medium text-foreground">{shootTag(l.kind)}</b> : null}{l.kind ? " · " : null}{ago(l.lastAt)}<span className="ml-1.5 rounded-[5px] bg-card px-1.5 py-px align-[1px] text-[10px] tracking-[0.06em]">{source(l)}</span></>}
              t={l.stage}
              n={l.name || l.email}
              s={nextStep(l)}
            />
          )) : note("Nothing waiting on you.")}
        </Panel>
        <div className="grid content-start gap-[26px]">
          <Panel title="Coming up" more="Calendar" go={() => pick("upcoming")}>
            {coming.length ? coming.map((l) => (
              <Item key={l.id} onClick={() => go(l)} k={<><b className="font-medium text-foreground">{callOrShoot(l)}</b> · {at(l.when!)}</>} t={l.paid ? "Deposit paid" : l.stage} n={l.name || l.email} s={nextStep(l)} />
            )) : note("No calls or sessions coming up.")}
          </Panel>
          <div className="max-lg:hidden">
            <Panel title="Money" more="Money" go={() => pick("money")}>
              {typeof money === "string" ? note(money) : !money ? wait("Asking Stripe") : (
                <>
                  <Item k="Stripe" t="On the way" n={`${cash(money.available ?? 0)} available`} s={money.pending ? cash(money.pending) : null} />
                  {money.txns.slice(0, 2).map((x) => <Item key={x.id} k={x.what || (KIND[x.type] ?? x.type.replace(/_/g, " "))} t={day(x.at)} n={cash(x.net)} />)}
                </>
              )}
            </Panel>
          </div>
          <div className="max-lg:hidden">
            <Panel title="Site" more="Traffic" go={() => pick("traffic")}>
              {typeof traffic === "string" ? note(traffic) : !t ? wait("Asking Cloudflare") : (
                <>
                  <svg viewBox="0 0 300 46" preserveAspectRatio="none" className="mt-2.5 h-[46px] w-full" role="img" aria-label={`Visitors, last ${t.days.length} days`}>
                    <polyline fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" points={spark} />
                  </svg>
                  {note(`${t.visits.toLocaleString("en-US")} visits in the last ${t.days.length} days.`)}
                </>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
