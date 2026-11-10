"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { References } from "@/components/admin-inbox";
import { credentials, KEY_STORE } from "@/lib/admin-github";
import { LeadBoard } from "@/components/lead-board";
import { LeadHours } from "@/components/lead-hours";
import { LeadProofs, ProofsDesk } from "@/components/admin-proofs";
import { LeadUpcoming } from "@/components/lead-upcoming";
import { TOKEN_STORE } from "@/lib/admin-github";
import type { Enquiry } from "@/lib/inbox";
import { isLate, leadSummary, NUDGES, PAPER, paperDue, quoteNudge, REMIND_MAX, STAGES, trashDaysLeft, type Lead, type LeadPatch, type LeadSummary, type Paper, type Stage } from "@/lib/leads";
import { cn } from "@/lib/utils";
import { fill, mailable, TEMPLATES } from "@/lib/lead-crm";
import { endDay, LicenceField, LicenceList } from "@/components/lead-licence";
import { balance, dayB, DEPOSIT, MAX_ROWS_B, NOTE_B, usd, usdB, type Crop, type Invoice, type InvoiceB, type InvoiceFrom } from "@/lib/invoice";
import { framed, loadImage, place, shrink, toneFor } from "@/lib/invoice-photo";
import { leadKey, typingIn } from "@/lib/lead-keys";
import { ago, aside, at, authed, badge, btn, type Call, cash, closed, compose, DAY, day, type Filter, HEAD, ios, kindOf, label, line, mailto, MARK, matches, now, OFFLINE, pass, primary, renew, snoozed, STEPS, Tag, type Template, field, fieldLabel, LOST_REASONS } from "@/components/leads/shared";
import { Card, clampW, LIST_W, LIST_W_STORE, ListResizer, Pill, Row, SideLink } from "@/components/leads/list";
import { DeskKeys } from "@/components/leads/desk-keys";
import { DeskToday } from "@/components/leads/today";
import { SW_URL, swScope, PushSwitch, ImportInbox, SignIn, EmptyTrash, NewLeadForm, StatsView, TemplatesEditor, exportCsv } from "@/components/leads/setup";
export { SignIn } from "@/components/leads/setup";
export { ago, type Filter, matches, money, nextStep, OFFLINE, pass } from "@/components/leads/shared";

// The /admin tabs the One Desk folds in, loaded only when opened.
const AdminTraffic = React.lazy(() => import("@/components/admin-traffic").then((m) => ({ default: m.AdminTraffic })));
const AdminSeo = React.lazy(() => import("@/components/admin-seo").then((m) => ({ default: m.AdminSeo })));
/** Site: the /admin editor's own tabs, opened there (`?view=`), since they need the server's project data. */
const SITE: [string, string][] = [["Pages", "/admin?view=home"], ["Work", "/admin?view=projects"], ["Motion", "/admin?view=video"]];
/** Julian picked A (mock claude.ai/artifact/Y2S4cpbyK881T7ZZB2m46S): seven lines with icons, each page's own lists as tabs on it. */
type Section = "today" | "leads" | "calendar" | "money" | "site" | "numbers" | "setup";
const SECTIONS: { id: Section; label: string; icon: React.ReactNode; tabs: [Filter, string][] }[] = [
  { id: "today", label: "Today", icon: <path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z" />, tabs: [["today", "Today"]] },
  { id: "leads", label: "Leads", icon: <><path d="M4 13l3-8h10l3 8v6H4z" /><path d="M4 13h5l1 2h4l1-2h5" /></>, tabs: [["needs", "Your move"], ["open", "All"], ["proofs", "Proofs"], ["licences", "Licences"], ["new", "New lead"]] },
  { id: "calendar", label: "Calendar", icon: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>, tabs: [["upcoming", "Calendar"]] },
  { id: "money", label: "Money", icon: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>, tabs: [["money", "Money"]] },
  { id: "site", label: "Site", icon: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 9v11" /></>, tabs: [["site", "Site"]] },
  { id: "numbers", label: "Numbers", icon: <path d="M4 19h16M7 16V10M12 16V6M17 16v-4" />, tabs: [["traffic", "Traffic"], ["seo", "SEO"], ["stats", "Stats"]] },
  { id: "setup", label: "Setup", icon: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></>, tabs: [["hours", "Hours"], ["templates", "Templates"], ["device", "This device"]] },
];
/** The line a list lives under; every lead list is Leads. */
const sectionOf = (f: Filter): Section => SECTIONS.find((x) => x.tabs.some(([t]) => t === f))?.id ?? "leads";
/** Pages with no lead pane beside them. */
const WIDE: Filter[] = ["today", "proofs", "site", "traffic", "seo"];

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

/** Views that are not a list of leads. */
/** Pull-to-refresh: how far the finger travels (px) to commit, and the most the pull shows. iOS rubber-band already halves it at the top. */
const PULL_AT = 56;
const PULL_MAX = 80;
const TOOLS: Filter[] = ["today", "traffic", "seo", "site", "device", "more", "new", "stats", "money", "templates", "hours", "proofs", "licences"];

const BOARD_STORE = "jg-leads-board";

export function AdminLeads() {
  const [leads, setLeads] = React.useState<LeadSummary[] | null>(null);
  const [fresh, setFresh] = React.useState<Lead | null>(null);
  const [filter, setFilter] = React.useState<Filter>("today");
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
    const out = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
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
  const tab = filter === "upcoming" ? "more" : tabOf(filter);
  const section = sectionOf(filter);
  const tabs = SECTIONS.find((x) => x.id === section)!.tabs;
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
      data-desk=""
      style={{ fontFamily: 'var(--font-v2-text, "Helvetica Neue", Helvetica, Arial, sans-serif)', letterSpacing: 0, ...(listW ? { "--list-w": `${listW}px` } : {}) } as React.CSSProperties}
      ref={fit}
      className={cn(
        "normal-case text-foreground max-lg:pb-[calc(84px+env(safe-area-inset-bottom))] lg:relative lg:grid lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden lg:rounded-[14px] lg:border lg:border-border lg:bg-background [&_button]:normal-case [&_h1]:normal-case [&_h2]:normal-case [&_h3]:normal-case",
        // Proofs runs its own list + card, so it takes the lead pane's width too.
        WIDE.includes(filter) ? "lg:grid-cols-[220px_minmax(0,1fr)]" : boarding ? "lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,420px)]" : "lg:grid-cols-[220px_minmax(0,var(--list-w,420px))_minmax(0,1fr)]",
      )}
    >
      {/* Desktop: the sidebar. Every list, then this device's switches. */}
      <nav aria-label="Lead lists" className="hidden min-h-0 flex-col overflow-y-auto border-r border-border p-3.5 lg:flex">
        <div className="flex items-center gap-2.5 px-2 pb-4 pt-0.5">
          <span aria-hidden="true" className="grid size-[30px] place-items-center rounded-lg bg-accent text-[12px] font-extrabold text-accent-foreground" style={{ fontFamily: "var(--font-display)" }}>JG</span>
          <span className="grid leading-tight"><b className="text-[14px] font-semibold">Julian</b><span className="font-mono text-[11.5px] text-muted-foreground">Desk</span></span>
        </div>
        <button type="button" onClick={() => pick("new")} className={cn(btn, primary, "mb-3 min-h-10 text-[14.5px]")}>New lead</button>
        {SECTIONS.map((x) => (
          <SideLink key={x.id} on={section === x.id} n={x.id === "today" ? needs : x.id === "leads" ? count("open") : x.id === "calendar" ? count("upcoming") : undefined} icon={x.icon} onClick={() => pick(x.tabs[0][0])} className={x.id === "setup" ? "mt-auto" : undefined}>{x.label}</SideLink>
        ))}
      </nav>

      <section aria-label="Leads" className={cn("min-w-0 lg:min-h-0 lg:border-r lg:border-border", boarding ? "lg:flex lg:flex-col" : "lg:overflow-y-auto", open && "max-lg:hidden")}>
        {/* Phone: the pull. Turns as it fills, spins once it commits. */}
        <div aria-hidden="true" className="grid place-items-center overflow-hidden text-muted-foreground lg:hidden" style={{ height: pull || (refreshing ? 40 : 0), transition: pull ? "none" : "height 200ms ease-out" }}>
          <svg viewBox="0 0 24 24" className={cn("size-[18px] fill-none stroke-current stroke-[1.8]", refreshing && "animate-spin", pull >= PULL_AT && "text-accent")} style={refreshing ? undefined : { transform: `rotate(${(pull / PULL_AT) * 270}deg)` }}><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" /></svg>
        </div>
        {filter === "today" ? null : <header className="grid gap-3.5 border-b border-border px-3 pb-4 pt-3 lg:px-7 lg:pt-6">
          {tabs.length > 1 ? (
            <div role="tablist" aria-label={section} className={cn("-mx-1 flex gap-1 overflow-x-auto px-1", section === "leads" && "max-lg:hidden")}>
              {tabs.map(([f, t]) => {
                const on = f === filter || (f === "open" && (STAGES.includes(filter as Stage) || MORE.includes(filter)));
                return <button key={f} type="button" role="tab" aria-selected={on} onClick={() => pick(f)} className={cn("min-h-9 shrink-0 rounded-lg px-3 text-[14px] transition-colors duration-200", on ? "bg-card font-semibold text-foreground" : "text-muted-foreground hoverable:hover:text-foreground")}>{t}</button>;
              })}
            </div>
          ) : null}
          {tabOf(filter) !== "more" && (
            <p className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
              {needs ? `${needs} waiting on you` : "Nothing waiting on you"}
            </p>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <h1 style={HEAD} className="min-w-0 whitespace-nowrap text-[40px] leading-none tracking-[-0.03em] lg:text-[28px]">{filter === "upcoming" ? "Calendar" : label(filter)}</h1>
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
          {tab === "open" || MORE.includes(filter) ? (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 lg:flex-wrap">
              {(["open", ...OPEN_STAGES, ...MORE] as const).map((f) => (
                <Pill key={f} on={filter === f} n={count(f)} onClick={() => pick(f)}>{f === "open" ? "All" : label(f)}</Pill>
              ))}
            </div>
          ) : null}
          {MORE.includes(filter) || (tool && filter !== "more") || filter === "upcoming" ? (
            <button type="button" onClick={() => pick("more")} className="inline-flex min-h-11 w-fit items-center gap-1 text-[16px] text-accent lg:hidden">
              <span aria-hidden="true">‹</span> More
            </button>
          ) : null}
        </header>}

        {filter === "today" ? (
          <DeskToday leads={leads} go={(l) => { setFilter(pass(l, "needs") ? "needs" : "open"); setOpen(l.id ?? null); }} pick={pick} />
        ) : filter === "traffic" ? (
          <div className="px-1 py-5 lg:px-7"><React.Suspense fallback={null}><AdminTraffic /></React.Suspense></div>
        ) : filter === "site" ? (
          <ul className="grid px-1 py-4 lg:px-7">
            {SITE.map(([t, href]) => (
              <li key={t}><a href={href} className="flex min-h-[52px] items-center justify-between border-b border-border text-[17px] hoverable:hover:text-accent">{t}<span aria-hidden="true" className="font-mono text-[13px] text-muted-foreground">↗</span></a></li>
            ))}
            <li><p className="pt-3 text-[14px] text-muted-foreground">Each opens its tab in the site editor.</p></li>
          </ul>
        ) : filter === "device" ? (
          <div className="grid gap-1 px-1 py-4 lg:px-5">
            {device}
            <button type="button" onClick={doExport} className="min-h-11 w-fit px-3 text-left font-mono text-[12.5px] text-muted-foreground hoverable:hover:text-foreground">Export CSV</button>
          </div>
        ) : filter === "seo" ? (
          <div className="px-1 py-5 lg:px-7"><React.Suspense fallback={null}><AdminSeo /></React.Suspense></div>
        ) : filter === "more" ? (
          <div className="grid gap-6 py-4 lg:hidden">
            {([
              ["Clients", [["Calendar", "upcoming", count("upcoming")], ["Proofs", "proofs"], ["Money", "money"], ["Licences", "licences"]]],
              ["Site", SITE.map(([t, href]) => [t, href])],
              ["Numbers", [["Traffic", "traffic"], ["SEO", "seo"], ["Stats", "stats"]]],
              ["Setup", [["Hours", "hours"], ["Templates", "templates"], ["This device", "device"], ["New lead", "new"]]],
              ["Put aside", MORE.map((f) => [label(f), f, count(f)])],
            ] as [string, [string, string, number?][]][]).map(([group, rows]) => (
              <ul key={group} className="grid">
                <li><p className="px-1 pb-1 font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">{group}</p></li>
                {rows.map(([t, to, n]) => {
                  const cls = "flex min-h-[52px] w-full items-center justify-between border-b border-border px-1 text-left text-[17px]";
                  const end = <span className="flex items-center gap-3 font-mono text-[13px] text-muted-foreground">{n}<span aria-hidden="true">›</span></span>;
                  return (
                    <li key={t}>
                      {to.startsWith("/") ? <a href={to} className={cls}>{t}{end}</a> : <button type="button" onClick={() => pick(to as Filter)} className={cls}>{t}{end}</button>}
                    </li>
                  );
                })}
              </ul>
            ))}
            <ul className="grid">
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

      {boarding || WIDE.includes(filter) ? null : <ListResizer w={listW ?? LIST_W} onChange={setListW} />}

      <section aria-label="Lead" className={cn("min-w-0 lg:min-h-0 lg:overflow-y-auto lg:bg-card/40", !open && "max-lg:hidden", WIDE.includes(filter) && "hidden")}>
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
        {DESK_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pick(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn("relative flex min-h-[52px] flex-col items-center justify-center gap-1 font-mono text-[11.5px] tracking-[0.02em]", tab === t.id ? "text-accent" : "text-muted-foreground")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[23px] fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]">{t.icon}</svg>
            {t.label}
            {t.id === "needs" && needs ? (
              <span className="absolute left-[calc(50%+5px)] top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-accent px-1 text-[11.5px] font-semibold text-accent-foreground">{needs}</span>
            ) : null}
          </button>
        ))}
      </nav>
    </div>
  );
}

type Tab = "today" | "needs" | "open" | "upcoming" | "more";
const OPEN_STAGES = STAGES.filter((s) => !closed(s));
/** The lists under More on the phone (the sidebar's lower groups on desktop). */
const MORE: Filter[] = ["snoozed", "archived", "trash", "Delivered", "Lost"];
const tabOf = (f: Filter): Tab => (f === "today" ? "today" : f === "needs" || f === "upcoming" ? f : TOOLS.includes(f) || MORE.includes(f) ? "more" : "open");
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "needs", label: "Your move", icon: <><path d="M4 13l3-8h10l3 8v6H4z" /><path d="M4 13h5l1 2h4l1-2h5" /></> },
  { id: "open", label: "Open", icon: <path d="M5 6h14M5 12h14M5 18h9" /> },
  { id: "upcoming", label: "Upcoming", icon: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></> },
  { id: "more", label: "More", icon: <><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></> },
];
/** The One Desk's phone tabs: Today first; Upcoming folds into it, the Calendar under More. */
const DESK_TABS = [{ id: "today" as Tab, label: "Today", icon: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /><circle cx="12" cy="15" r="1.6" /></> }, ...TABS.filter((t) => t.id !== "upcoming")];

/** The inbox key, pasted once per device. On the iPhone the installed app keeps
    its own storage apart from Safari, so it asks once there too. A password
    field, so a password manager can fill it. */


export function Detail({ summary, initial, call, onChange, onBack, reload, tick, templates, others }: { summary: LeadSummary; initial?: Lead | null; call: Call; onChange: (l: Lead) => void; onBack: () => void; reload: () => void; tick: number; templates: Template[]; others: LeadSummary[] }) {
  const [lead, setLead] = React.useState<Lead | null>(initial ?? null);
  const [message, setMessage] = React.useState<Enquiry | null>(null);
  const [msgKey, setMsgKey] = React.useState<string | null>(null);
  const [asked, setAsked] = React.useState(false);
  const [snoozing, setSnoozing] = React.useState(false);
  const key = `lead:${summary.id}`;

  const patch = React.useCallback(
    async (body: LeadPatch) => {
      const o = await call({ method: "PATCH", body: JSON.stringify({ key, ...body }) });
      const next = o.lead as Lead;
      setLead(next);
      onChange(next);
      // A merge deletes the other record; the list has to drop it.
      if (body.mergeFrom) reload();
      return next;
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
      <button type="button" data-detail-back onClick={onBack} className="inline-flex min-h-11 items-center gap-1 justify-self-start text-[16px] text-accent lg:hidden">
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


/** The CRM half of a lead: how to reach them, saved replies, a reminder, the quote, notes, merge. */
function LeadCrm({ l, full, patch, others, templates }: { l: LeadSummary; full: Lead | null; patch: (b: LeadPatch) => Promise<unknown>; others: LeadSummary[]; templates: Template[] }) {
  const [editing, setEditing] = React.useState(false);
  const [d, setD] = React.useState({ name: "", phone: "", ig: "", company: "", source: "", kind: "" });
  const [notes, setNotes] = React.useState<string | null>(null);
  const [rAt, setRAt] = React.useState("");
  const [rText, setRText] = React.useState("");
  const [quote, setQuote] = React.useState<string | null>(null);
  const [into, setInto] = React.useState("");
  const [sure, setSure] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const run = (p: Promise<unknown>, ok?: string) => p.then(() => setNote(ok ?? null)).catch((e: unknown) => setNote(e instanceof Error ? e.message : String(e)));
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
function Paperwork({ l, patch }: { l: LeadSummary; patch: (b: LeadPatch) => Promise<unknown> }) {
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
              onClick={() => patch({ [k]: PAPER[(PAPER.indexOf(v) + 1) % PAPER.length] }).catch((e) => console.error("paperwork", e))}
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

function Money({ l, full, patch, run, quote, setQuote }: { l: LeadSummary; full: Lead | null; patch: (b: LeadPatch) => Promise<unknown>; run: (p: Promise<unknown>, ok?: string) => void; quote: string | null; setQuote: (v: string | null) => void }) {
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
        <InvoiceSheetB l={l} full={full} patch={patch} done={() => setMaking(false)} />
      ) : (
        <button type="button" onClick={() => setMaking(true)} disabled={!full} className={cn(btn, primary, "justify-self-start")}>Make invoice</button>
      )}
    </section>
  );
}

/** Pacific today, as the date input wants it. */
const todayPT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());

/** The PDF of one invoice. Loaded on the tap, fonts and all. A design B one fetches its sealed photo unless `src` is in hand. */
async function makePdf(inv: Invoice, l: LeadSummary, full: Lead, src?: string) {
  const res = await fetch("/api/inbox?invoiceFrom", { headers: authed(), cache: "no-store" });
  const { from } = (await res.json()) as { from: InvoiceFrom | null };
  if (!from?.name) throw new Error("Add your details for invoices first.");
  let photo;
  if (inv.b) {
    if (!src) {
      const r = await fetch(`/api/inbox?invoicePhoto=${inv.b.photo}`, { headers: authed(), cache: "no-store" });
      src = ((await r.json()) as { photo?: string }).photo;
      if (!src) throw new Error("This invoice's photo is gone.");
    }
    photo = await framed(src, inv.b.crop);
  }
  const { invoicePdf } = await import("@/lib/invoice-pdf");
  return invoicePdf({ from, inv, to: { name: l.name, email: mailable(l.email) ? l.email : undefined, phone: full.phone } }, photo);
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

/* ── design B: the dark invoice with a photo ────────────────────────
 * Julian (2026-11-09): "Add this invoice as my default template ... Ask
 * for everything that is on the page and have it fill it out. They need to
 * also be able to reframe the image so it fits nice." The only invoice since
 * 2026-11-10, when the light one was retired (Julian: "only" this one). Every field fills the page
 * beside it; the photo is dragged and zoomed inside its column, and the
 * wordmark on it turns light over a dark patch (Julian: "adjust the top
 * left logo based on the photo"). The PDF is drawn by `layoutB` in
 * lib/invoice-pdf.ts from the same numbers. */

const plusDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
type LineB = { desc: string; sub: string; amt: string };

/** The page as the PDF draws it, scaled to its box. Its CSS is the approved prototype's. */
const PAGE_B_CSS = `
@font-face{font-family:"Archivo B";src:url(/leads-app/invoice/archivo-800-125.ttf) format("truetype");font-weight:800}
.ivb{aspect-ratio:210/297;width:100%;container-type:inline-size;position:relative;overflow:hidden;background:#0D0D0F;color:#EDEDEF;display:grid;grid-template-columns:41% 1fr;font-family:var(--font-display),sans-serif;line-height:1.4}
.ivb .l{font:500 1.55cqw/1.4 var(--font-mono),monospace;letter-spacing:.06em;text-transform:uppercase;color:#7C7F88}
.ivb .ph{position:relative;overflow:hidden;background:#222;cursor:grab;touch-action:none;user-select:none}
.ivb .ph:active{cursor:grabbing}
.ivb .ph img{position:absolute;max-width:none;pointer-events:none}
.ivb .ph::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(13,13,15,0) 55%,rgba(13,13,15,.85));pointer-events:none}
.ivb .ph:focus-visible{outline:2px solid #A99CF0;outline-offset:-2px}
.ivb .vno{position:absolute;top:5.5cqw;left:4.5cqw;z-index:1;font:900 3.6cqw/.9 var(--font-display);letter-spacing:-.045em}
.ivb .cap{position:absolute;left:4.5cqw;right:4cqw;bottom:5cqw;z-index:1;font:500 1.45cqw/1.6 var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:rgba(237,237,239,.75)}
.ivb .cap b{display:block;color:#EDEDEF;font-weight:500}
.ivb .col{padding:6cqw 6cqw 5cqw;display:flex;flex-direction:column;min-width:0}
.ivb .hd{display:flex;flex-direction:column;align-items:flex-end;gap:.5cqw}
.ivb .wm{font:900 3.6cqw/.9 var(--font-display);letter-spacing:-.045em}
.ivb .to{margin-top:calc(6cqw*var(--k,1));font-size:2.3cqw;line-height:1.45;font-weight:400}
.ivb .to .l{margin-bottom:1.2cqw}
.ivb .dim{color:#7C7F88}
.ivb .items{margin-top:calc(4cqw*var(--k,1));border-top:1px solid #2A2B30}
.ivb .it{display:flex;justify-content:space-between;gap:3cqw;padding:calc(2.2cqw*var(--k,1)) 0;border-bottom:1px solid #2A2B30;font-size:2.1cqw;font-weight:400}
.ivb .it>span:last-child{font:500 1.95cqw var(--font-mono);white-space:nowrap}
.ivb .it small{display:block;color:#7C7F88;font-size:1.75cqw;margin-top:.5cqw}
.ivb .amount{margin-top:calc(6cqw*var(--k,1))}
.ivb .amount .l{margin-bottom:2.4cqw;color:#A99CF0}
.ivb .k{font:800 10.5cqw/.82 "Archivo B",sans-serif;letter-spacing:-.035em;white-space:nowrap}
.ivb .sub{display:flex;gap:5cqw;margin-top:3.4cqw;font:500 1.6cqw var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:#7C7F88}
.ivb .sub b{color:#EDEDEF;font-weight:500}
.ivb .sub b.v{color:#A99CF0}
.ivb .pay{margin-top:calc(4.5cqw*var(--k,1));font:500 1.65cqw/1.75 var(--font-mono);color:#B9BBC2}
.ivb .pay .l{margin-bottom:1cqw}
.ivb .pay em{font-style:normal;color:#7C7F88}
.ivb .sign{margin-top:auto;margin-bottom:4.5cqw;display:flex;flex-direction:column;align-items:flex-end;gap:2.6cqw;text-align:right}
.ivb .sign p{font:500 2.05cqw/1.38 var(--font-display);letter-spacing:-.012em}
.ivb .sign i{display:block;font-style:normal;margin-top:1.6cqw;color:#7C7F88}
.ivb .sign .em{margin-top:-1.4cqw;font:500 1.4cqw var(--font-mono);letter-spacing:.04em;color:#7C7F88}
.ivb .wm2{white-space:nowrap;font:900 2.8cqw/1 var(--font-display);letter-spacing:-.045em}
.ivb .ft{display:flex;justify-content:space-between;padding-top:2.5cqw;border-top:1px solid #2A2B30;font:500 1.4cqw var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:#7C7F88}
`;

type PageBProps = {
  no: string; date: string; due: string; to: InvoiceB["to"]; project: string; caption: string; note: string[];
  rows: { t: string; sub: string; n: number }[]; total: number; from: InvoiceFrom | null;
  src: string | null; crop: Crop; setCrop: React.Dispatch<React.SetStateAction<Crop>>; tone: "dark" | "light";
};

function PageB(p: PageBProps) {
  const ph = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState({ w: 0, h: 0 });
  const [nat, setNat] = React.useState({ w: 0, h: 0 });
  const drag = React.useRef<{ x: number; y: number; c: Crop } | null>(null);
  const { setCrop } = p;
  React.useEffect(() => {
    const el = ph.current!;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    // Wheel zooms the photo; React's wheel listener is passive and cannot keep the page still.
    const wheel = (e: WheelEvent) => { e.preventDefault(); setCrop((c) => ({ ...c, z: Math.min(3, Math.max(1, c.z - e.deltaY * 0.0015)) })); };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener("wheel", wheel); };
  }, [setCrop]);
  // As the PDF does: draw the gaps in until the bank block clears the note by 4cqw.
  const page = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = page.current;
    if (!el) return;
    const pay = el.querySelector(".pay")!, sign = el.querySelector(".sign")!, clear = el.clientWidth * 0.04;
    for (let k = 1; k >= 0.3; k -= 0.05) {
      el.style.setProperty("--k", String(k));
      if (sign.getBoundingClientRect().top - pay.getBoundingClientRect().bottom >= clear) break;
    }
  });
  const at = nat.w && box.w ? place(nat.w, nat.h, box.w, box.h, p.crop) : null;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const move = (dx: number, dy: number, from: Crop) => at && p.setCrop({ ...from, x: at.w > box.w ? clamp(from.x - dx / (at.w - box.w)) : 0.5, y: at.h > box.h ? clamp(from.y - dy / (at.h - box.h)) : 0.5 });
  const f = p.from;
  return (
    <div ref={page} className="ivb" aria-label="The invoice page">
      <div
        ref={ph}
        className="ph"
        tabIndex={0}
        role="group"
        aria-label="Photo. Drag or use the arrow keys to move it."
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, c: p.crop }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { const d = drag.current; if (d) move(e.clientX - d.x, e.clientY - d.y, d.c); }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 40 : 10, k = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
          if (k) { e.preventDefault(); move(k[0], k[1], p.crop); }
        }}
      >
        {p.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.src} alt="" onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} style={at ? { width: at.w, height: at.h, left: at.left, top: at.top } : { visibility: "hidden" }} />
        ) : null}
        <span className="vno" style={{ color: p.tone === "dark" ? "#2E2F34" : "#D9DADF" }}>Julian Gigola</span>
        <div className="cap"><b>{p.project}</b>{p.caption}</div>
      </div>
      <div className="col">
        <div className="hd"><span className="wm">INVOICE</span><span className="l">#{p.no || "…"}</span></div>
        <div className="to">
          <div className="l">Billed to</div>
          {p.to.name}{p.to.company ? <><br />{p.to.company}</> : null}{p.to.email ? <><br /><span className="dim">{p.to.email}</span></> : null}
        </div>
        <div className="items">
          {p.rows.map((r, i) => <div key={i} className="it"><span>{r.t}{r.sub ? <small>{r.sub}</small> : null}</span><span>{usdB(r.n)}</span></div>)}
        </div>
        <div className="amount">
          <div className="l">Total due</div>
          <div className="k">{usdB(p.total)}</div>
          <div className="sub"><span>Issued <b>{p.date ? dayB(p.date) : ""}</b></span><span>Due <b className="v">{p.due ? dayB(p.due, true) : ""}</b></span></div>
        </div>
        <div className="pay">
          <div className="l">Bank transfer</div>
          {f?.bank}<br />{f?.routing ? `Routing ${f.routing}` : null}<br />{f?.account ? `Account ${f.account}` : null}<br /><em>{f?.late}</em>
        </div>
        <div className="sign">
          <p>{p.note.filter(Boolean).map((n, i) => <React.Fragment key={i}>{i ? <br /> : null}{n}</React.Fragment>)}<i>Cheers,</i></p>
          <span className="wm2">Julian Gigola</span>
          <span className="em">hello@juliangigola.com</span>
        </div>
        <div className="ft"><span>juliangigola.com</span><span>{f?.tax ? `Tax ${f.tax}` : ""}</span></div>
      </div>
    </div>
  );
}

/** The desk itself on a wide screen (it is `lg:relative`), for the invoice page to cover its left side; null on a phone. */
function useDeskLeft() {
  const [el, setEl] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    const mq = matchMedia("(min-width: 1024px)");
    const set = () => setEl(mq.matches ? document.querySelector<HTMLElement>("[data-desk]") : null);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  // What the page covers leaves the tab order and the screen reader while it is up.
  React.useEffect(() => {
    if (!el) return;
    const hid = [...el.querySelectorAll<HTMLElement>(':scope > nav, :scope > section[aria-label="Leads"], :scope > [role="separator"]')];
    hid.forEach((n) => (n.inert = true));
    return () => hid.forEach((n) => (n.inert = false));
  }, [el]);
  return el;
}

function InvoiceSheetB({ l, full, patch, done }: { l: LeadSummary; full: Lead; patch: (b: LeadPatch) => Promise<unknown>; done: () => void }) {
  const [from, setFrom] = React.useState<InvoiceFrom | null>(null);
  const [editFrom, setEditFrom] = React.useState(false);
  const [date, setDate] = React.useState(todayPT);
  const [due, setDue] = React.useState(() => plusDays(todayPT(), 7));
  const [no, setNo] = React.useState("");
  const shot = l.when ? l.when.slice(0, 10) : todayPT();
  const [project, setProject] = React.useState(full.company ?? "");
  const [caption, setCaption] = React.useState(`Editorial · ${dayB(shot, true)}`);
  const [to, setTo] = React.useState<InvoiceB["to"]>({ name: l.name, company: full.company ?? "", email: mailable(l.email) ? l.email : "" });
  const [lines, setLines] = React.useState<LineB[]>([{ desc: kindOf(l.kind) ?? "Photography", sub: "", amt: full.quote !== undefined ? String(full.quote) : "" }]);
  const [paid, setPaid] = React.useState(full.deposit ? String(DEPOSIT) : "0");
  const [depositNote, setDepositNote] = React.useState("Paid at booking");
  const [note, setNote] = React.useState<string[]>([...NOTE_B]);
  const [src, setSrc] = React.useState<string | null>(null);
  const [photoKey, setPhotoKey] = React.useState<string | null>(null);
  const [crop, setCropRaw] = React.useState<Crop>({ x: 0.5, y: 0.5, z: 1 });
  const [tone, setTone] = React.useState<"dark" | "light">("dark");
  const [made, setMade] = React.useState<{ inv: Invoice; file: File } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const img = React.useRef<HTMLImageElement | null>(null);

  React.useEffect(() => {
    fetch(`/api/inbox?invoiceNo=${date}`, { headers: authed(), cache: "no-store" })
      .then((r) => r.json() as Promise<{ from: InvoiceFrom | null; no?: string }>)
      .then((o) => {
        setNo(o.no ?? "");
        setFrom((f) => f ?? { ...EMPTY_FROM, ...o.from });
        if (!o.from?.name || !o.from.bank) setEditFrom(true);
      })
      .catch(() => {});
  }, [date]);

  // The last B invoice on this lead lends its photo and framing, so a second one starts where the first ended.
  React.useEffect(() => {
    const last = [...(full.invoices ?? [])].reverse().find((i) => i.b)?.b;
    if (!last) return;
    fetch(`/api/inbox?invoicePhoto=${last.photo}`, { headers: authed(), cache: "no-store" })
      .then((r) => r.json() as Promise<{ photo?: string }>)
      .then((o) => { if (o.photo) { setSrc(o.photo); setPhotoKey(last.photo); setCropRaw(last.crop); setTone(last.tone); } })
      .catch(() => {});
  }, [full.invoices]);

  // The tone follows the framing, read from the pixels under the wordmark.
  React.useEffect(() => {
    if (!src) return;
    let live = true;
    (img.current?.src === src ? Promise.resolve(img.current) : loadImage(src)).then((i) => { img.current = i; if (live) setTone(toneFor(i, crop)); }, () => {});
    return () => { live = false; };
  }, [src, crop]);

  const pick = async (file?: File) => {
    if (!file) return;
    setErr(null);
    try { setSrc(await shrink(file)); setPhotoKey(null); setCropRaw({ x: 0.5, y: 0.5, z: 1 }); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  const dep = Number(paid) || 0;
  const rows = [...lines.map((x) => ({ t: x.desc, sub: x.sub, n: Number(x.amt) || 0 })), ...(dep ? [{ t: "Deposit received", sub: depositNote, n: -dep }] : [])];
  const total = rows.reduce((s, r) => s + r.n, 0);
  const setLine = (i: number, k: keyof LineB) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setLines(lines.map((x, j) => (j === i ? { ...x, [k]: k === "amt" ? e.target.value.replace(/[^\d.]/g, "") : e.target.value } : x)));

  const saved = React.useRef<Lead | null>(null);
  const left = useDeskLeft();
  const save = async () => {
    if (!src) return setErr("Add a photo.");
    setBusy(true);
    setErr(null);
    try {
      let key = photoKey;
      if (!key) {
        const r = await fetch("/api/inbox", { method: "PATCH", headers: { ...authed(), "content-type": "application/json" }, body: JSON.stringify({ invoicePhoto: src }) });
        const o = (await r.json().catch(() => ({}))) as { key?: string; error?: string };
        if (!r.ok || !o.key) throw new Error(o.error ?? "Could not save the photo.");
        setPhotoKey((key = o.key));
      }
      // Saved once: a retry after a failed PDF makes the PDF again, never a second invoice.
      saved.current ??= (await patch({
        invoice: {
          date,
          lines: lines.map((x) => ({ desc: x.desc.trim(), sub: x.sub.trim(), qty: 1, rate: Number(x.amt) })),
          paid: dep,
          b: { due, to, project, caption, note, depositNote, photo: key, crop, tone },
        },
      })) as Lead;
      // The PATCH answers with the lead as stored, so no second read (that one asked for a key the full lead has no id for).
      const fresh = saved.current;
      const inv = fresh.invoices!.at(-1)!;
      setMade({ inv, file: await makePdf(inv, l, fresh, src) });
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

  const legend = "mb-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground";
  const mono = "font-mono text-[14px]";
  return (
    <form className="grid gap-5 rounded-xl border border-border p-3.5 @container" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <style>{PAGE_B_CSS}</style>
      <div className={cn("grid gap-5", !left && "@[760px]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] @[760px]:items-start")}>
        {(() => {
          const page = <PageB no={no} date={date} due={due} to={to} project={project} caption={caption} note={note} rows={rows} total={total} from={from} src={src} crop={crop} setCrop={setCropRaw} tone={tone} />;
          // Julian: on desktop the full-size page sits on the left, over the tabs and the list.
          return left
            ? createPortal(<div className="absolute inset-y-0 left-0 z-20 w-[calc(220px+var(--list-w,420px))] overflow-y-auto border-r border-border bg-background p-6">{page}</div>, left)
            : <div className="grid gap-5 @[760px]:order-2 @[760px]:sticky @[760px]:top-4">{page}</div>;
        })()}
        <div className="grid gap-5">
          {from && editFrom ? <FromForm from={from} saved={(f) => { setFrom(f); setEditFrom(false); }} /> : null}
          <fieldset className="grid gap-2.5">
            <legend className={legend}>Photo</legend>
            <div className="flex flex-wrap gap-2.5">
              <label className={cn(btn, "min-h-10 cursor-pointer")}>
                {src ? "Replace photo" : "Add a photo"}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
              </label>
              {src ? <button type="button" onClick={() => setCropRaw({ x: 0.5, y: 0.5, z: 1 })} className={cn(btn, "min-h-10")}>Reset framing</button> : null}
            </div>
            {src ? (
              <label className="flex items-center gap-3 font-mono text-[12.5px] text-muted-foreground">
                Zoom
                <input type="range" min={1} max={3} step={0.01} value={crop.z} onChange={(e) => setCropRaw({ ...crop, z: Number(e.target.value) })} className="flex-1 accent-foreground" />
                <span className="w-10 text-right">{Math.round(crop.z * 100)}%</span>
              </label>
            ) : null}
            <p className="font-mono text-[12.5px] text-muted-foreground">Drag the photo on the page to move it. The framing is saved with the invoice.</p>
          </fieldset>
          <fieldset className="grid gap-2.5">
            <legend className={legend}>Caption on the photo</legend>
            <label className={fieldLabel}>Project<input required maxLength={40} value={project} onChange={(e) => setProject(e.target.value)} className={field} /></label>
            <label className={fieldLabel}>Line under it<input maxLength={40} value={caption} onChange={(e) => setCaption(e.target.value)} className={field} /></label>
          </fieldset>
          <fieldset className="grid grid-cols-3 gap-2.5">
            <legend className={legend}>Invoice</legend>
            <div className={fieldLabel}>No.<span className="flex min-h-11 items-center font-mono text-[15px] text-foreground">{no || "…"}</span></div>
            <label className={fieldLabel}>Issued<input type="date" required value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={cn(field, "px-2", mono)} /></label>
            <label className={fieldLabel}>Due<input type="date" required value={due} onChange={(e) => e.target.value && setDue(e.target.value)} className={cn(field, "px-2", mono)} /></label>
          </fieldset>
          <fieldset className="grid gap-2.5">
            <legend className={legend}>Billed to</legend>
            <label className={fieldLabel}>Name<input required maxLength={60} value={to.name} onChange={(e) => setTo({ ...to, name: e.target.value })} className={field} /></label>
            <label className={fieldLabel}>Company<input maxLength={60} value={to.company} onChange={(e) => setTo({ ...to, company: e.target.value })} className={field} /></label>
            <label className={fieldLabel}>Email<input type="email" maxLength={80} value={to.email} onChange={(e) => setTo({ ...to, email: e.target.value })} className={field} /></label>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className={legend}>Lines: title, what was done, amount</legend>
            {lines.map((x, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_96px_44px] gap-2 border-b border-border pb-2.5">
                <input aria-label={`Line ${i + 1} title`} required maxLength={48} value={x.desc} onChange={setLine(i, "desc")} className={cn(field, "px-3")} />
                <input aria-label={`Line ${i + 1} amount`} required inputMode="decimal" value={x.amt} onChange={setLine(i, "amt")} placeholder="0" className={cn(field, "px-2 text-right", mono)} />
                {lines.length > 1 ? (
                  <button type="button" aria-label={`Remove line ${i + 1}`} onClick={() => setLines(lines.filter((_, j) => j !== i))} className="grid size-11 place-items-center text-muted-foreground hoverable:hover:text-foreground">×</button>
                ) : <span aria-hidden="true" />}
                <input aria-label={`Line ${i + 1}, what was done`} maxLength={60} value={x.sub} onChange={setLine(i, "sub")} placeholder="What was done" className={cn(field, "px-3")} />
              </div>
            ))}
            {lines.length + (dep ? 1 : 0) < MAX_ROWS_B ? (
              <button type="button" onClick={() => setLines([...lines, { desc: "", sub: "", amt: "" }])} className={cn(btn, "min-h-10 justify-self-start")}>Add a line</button>
            ) : null}
          </fieldset>
          <fieldset className="grid grid-cols-[96px_minmax(0,1fr)] gap-2.5">
            <legend className={legend}>Deposit received</legend>
            <label className={fieldLabel}>Amount<input inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value.replace(/[^\d.]/g, ""))} className={cn(field, "px-2 text-right", mono)} /></label>
            <label className={fieldLabel}>Line under it<input maxLength={60} value={depositNote} onChange={(e) => setDepositNote(e.target.value)} className={field} /></label>
            <p className="col-span-2 font-mono text-[12.5px] text-muted-foreground">0 leaves it off. Above 0 it shows as a line and comes off the total.</p>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className={legend}>Note</legend>
            {note.map((n, i) => <input key={i} aria-label={`Note, line ${i + 1}`} maxLength={44} value={n} onChange={(e) => setNote(note.map((m, j) => (j === i ? e.target.value : m)))} className={field} />)}
          </fieldset>
          <p className="flex justify-between font-mono text-[14px] text-muted-foreground">Total due<b className="text-[16px] font-medium text-accent">{usd(total)}</b></p>
          {err ? <p role="alert" className="text-[15px] text-destructive">{err}</p> : null}
          <div className="flex flex-wrap gap-2.5">
            <button type="submit" disabled={busy || !no} className={cn(btn, primary)}>{busy ? "Making" : "Save and make PDF"}</button>
            <button type="button" onClick={done} className={btn}>Cancel</button>
            {from && !editFrom ? <button type="button" onClick={() => setEditFrom(true)} className="min-h-11 px-2 font-mono text-[12.5px] text-muted-foreground hoverable:hover:text-foreground">Your details</button> : null}
          </div>
        </div>
      </div>
    </form>
  );
}

const EMPTY_FROM: InvoiceFrom = { name: "", a1: "", a2: "", a3: "", email: "hello@juliangigola.com", phone: "", ein: "", signoff: "Best,", notes: "", bank: "", routing: "", account: "", late: "Late payments add 5% per week.", tax: "" };
const FROM_FIELDS: [keyof InvoiceFrom, string][] = [["name", "Name on the invoice"], ["a1", "Address, line 1"], ["a2", "Address, line 2"], ["a3", "City, state, zip"], ["email", "Email"], ["phone", "Phone"], ["ein", "EIN line"], ["signoff", "Sign-off"], ["notes", "Notes on every invoice"], ["bank", "Bank name"], ["routing", "Routing number"], ["account", "Account number"], ["late", "Late fee line"], ["tax", "Tax number"]];

/** His details, once: sealed on the Worker, never in the code (the repo is public). */
function FromForm({ from, saved }: { from: InvoiceFrom; saved: (f: InvoiceFrom) => void }) {
  const [f, setF] = React.useState(from);
  const [err, setErr] = React.useState<string | null>(null);
  const save = () =>
    fetch("/api/inbox", { method: "PATCH", headers: { ...authed(), "content-type": "application/json" }, body: JSON.stringify({ invoiceFrom: f }) })
      .then(async (r) => {
        const o = (await r.json().catch(() => ({}))) as { from?: InvoiceFrom; error?: string };
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
        const o = (await r.json().catch(() => ({}))) as { error?: string; available?: number; pending?: number; test?: boolean; txns: Txn[]; more: boolean };
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
