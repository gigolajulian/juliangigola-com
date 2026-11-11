"use client";

import * as React from "react";
import { References } from "@/components/admin-inbox";
import { KEY_STORE, TOKEN_STORE } from "@/lib/admin-github";
import { LeadBoard } from "@/components/lead-board";
import { LeadHours } from "@/components/lead-hours";
import { LeadProofs, ProofsDesk } from "@/components/admin-proofs";
import { LeadUpcoming } from "@/components/lead-upcoming";
import type { Enquiry } from "@/lib/inbox";
import { isLate, leadSummary, NUDGES, quoteNudge, REMIND_MAX, STAGES, trashDaysLeft, type Lead, type LeadPatch, type LeadSummary, type Stage } from "@/lib/leads";
import { cn } from "@/lib/utils";
import { fill, mailable, TEMPLATES, type Template } from "@/lib/lead-crm";
import { endDay, LicenceList } from "@/components/lead-licence";
import { leadKey, typingIn } from "@/lib/lead-keys";
import { ago, aside, at, authed, type Call, closed, DAY, day, errorText, type Filter, inboxCall, loadError, matches, now, type Patch, pass, renew, snoozed } from "@/lib/lead-desk";
import { badge, btn, compose, field, fieldLabel, HEAD, ios, kindOf, label, line, mailto, MARK, primary, STEPS, Tag } from "@/components/leads/shared";
import { Card, clampW, LIST_W, LIST_W_STORE, ListResizer, Pill, Row, SideLink } from "@/components/leads/list";
import { DeskKeys } from "@/components/leads/desk-keys";
import { DeskToday } from "@/components/leads/today";
import { Money, MoneyView, Paperwork } from "@/components/leads/money";
import { StatsView } from "@/components/leads/stats";
import { TemplatesEditor } from "@/components/leads/templates";

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

  const call = inboxCall;

  const load = React.useCallback(() => {
    call<{ leads: LeadSummary[] }>({ query: "?leads" })
      .then((o) => setLeads(o.leads))
      .catch((e: unknown) => setError(loadError(e)));
  }, [call]);
  React.useEffect(load, [load]);
  /** Julian: the installed app has no reload. The list and the open lead again,
   * in place: rows keep their keys, so the scroll and the selection stay. */
  const [refreshing, setRefreshing] = React.useState(false);
  const [tick, setTick] = React.useState(0);
  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    call<{ leads: LeadSummary[] }>({ query: "?leads" })
      .then((o) => {
        const rows = o.leads;
        // KV lists lag a fresh write (#662): keep a lead added a moment ago.
        setLeads((had) => [...(had ?? []).filter((r) => fresh && r.email === fresh.email && !rows.some((n) => n.id === r.id)), ...rows]);
        // The open lead fetches again in place: a remount would drop his unsaved drafts.
        setTick((n) => n + 1);
      })
      .catch((e: unknown) => alert(errorText(e)))
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
    call<{ templates: Template[] }>({ query: "?templates" }).then((o) => setTemplates(o.templates)).catch(() => {});
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
  /** The number beside each side-nav section. */
  const badges: Partial<Record<Section, number>> = { today: needs, leads: count("open"), calendar: count("upcoming") };
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
    call<{ lead: Lead }>({ method: "PATCH", body: JSON.stringify({ key: `lead:${l.id}`, stage }) })
      .then((o) => { changed(o.lead); if (l.id === open) setMoved((n) => n + 1); })
      .catch((e: unknown) => { alert(errorText(e)); load(); });
  };
  const doExport = () => exportCsv().catch((e: unknown) => alert(errorText(e)));
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
          <SideLink key={x.id} on={section === x.id} n={badges[x.id]} icon={x.icon} onClick={() => pick(x.tabs[0][0])} className={x.id === "setup" ? "mt-auto" : undefined}>{x.label}</SideLink>
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
/** Notifications for this device: a new lead pings the installed app. */
const PUSH_FLAG = "jg-leads-push";
const SW_URL = "/admin/leads/sw.js";
/** The app is the whole origin on leads.juliangigola.com, /admin/leads on the main site. */
const swScope = () => (location.hostname.startsWith("leads.") ? "/" : "/admin/leads");
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
      const { key } = await call<{ key: string }>({ query: "?vapid" });
      const raw = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
      await call({ method: "PATCH", body: JSON.stringify({ push: sub.toJSON() }) });
      try { localStorage.setItem(PUSH_FLAG, "1"); } catch {}
      setOn(true);
    } catch (e) {
      setNote(errorText(e));
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
      setNote(errorText(e));
    }
  };
  const sendTest = async () => {
    setNote("Sending.");
    try {
      const { devices } = await call<{ devices: number }>({ method: "PATCH", body: JSON.stringify({ test: true }) });
      setNote(devices ? `Arrives in 10 seconds on ${devices} ${devices === 1 ? "device" : "devices"}. Lock the phone now: no banner shows while the app is open.` : "No device is subscribed. Turn notifications off and on again here.");
    } catch (e) {
      setNote(errorText(e));
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
    call<Count>({ method: "POST", body: JSON.stringify({ backfill: true, dry }) })
      .then((c) => {
        if (dry) return c.added + c.updated ? setCount(c) : setNote("Everything in the Inbox is already here.");
        setCount(null);
        setNote(`Imported: ${c.added} new, ${c.updated} updated.`);
        done();
      })
      .catch((e: unknown) => setNote(errorText(e)))
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

export function SignIn({ onKey, wrong }: { onKey: (k: string) => void; wrong: boolean }) {
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

/** Deletes every lead in the trash for good, after a second press. */
function EmptyTrash({ n, call, done }: { n: number; call: Call; done: () => void }) {
  const [sure, setSure] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const empty = () => {
    setBusy(true);
    call({ method: "DELETE", body: JSON.stringify({ emptyTrash: true }) }).then(done).catch((e) => console.error("empty trash", e)).finally(() => { setBusy(false); setSure(false); });
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
export function Detail({ summary, initial, call, onChange, onBack, reload, tick, templates, others }: { summary: LeadSummary; initial?: Lead | null; call: Call; onChange: (l: Lead) => void; onBack: () => void; reload: () => void; tick: number; templates: Template[]; others: LeadSummary[] }) {
  const [lead, setLead] = React.useState<Lead | null>(initial ?? null);
  const [message, setMessage] = React.useState<Enquiry | null>(null);
  const [msgKey, setMsgKey] = React.useState<string | null>(null);
  const [asked, setAsked] = React.useState(false);
  const [snoozing, setSnoozing] = React.useState(false);
  const key = `lead:${summary.id}`;

  const patch = React.useCallback(
    async (body: LeadPatch) => {
      const { lead: next } = await call<{ lead: Lead }>({ method: "PATCH", body: JSON.stringify({ key, ...body }) });
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
    call<{ lead: Lead }>({ query: `?key=${encodeURIComponent(key)}` }).then(async ({ lead: l }) => {
      if (!live) return;
      setLead(l);
      // Their latest words, from the raw row the form stored.
      const ref = [...l.events].reverse().find((e) => e.kind === "inquiry" && e.ref)?.ref;
      if (ref)
        call<{ enquiry: Enquiry }>({ query: `?key=${encodeURIComponent(ref)}` })
          .then((m) => live && (setMessage(m.enquiry), setMsgKey(ref)))
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
            <References msgKey={msgKey} enquiry={message} auth={authed()} />
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
/* ── the CRM tools: a lead by hand, the numbers, templates, the export ── */

const SOURCES = ["Instagram DM", "Referral", "Text", "Phone call", "Email", "In person", "Other"];

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
        call<{ id: string; lead: Lead }>({ method: "POST", body: JSON.stringify({ add: f }) })
          .then((o) => done(o.id, o.lead))
          .catch((err: unknown) => setNote(errorText(err)))
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

/** Every lead as a CSV file, through the same key as the rest of the desk. */
async function exportCsv() {
  const res = await fetch("/api/inbox?csv", { headers: authed(), cache: "no-store" });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: `leads-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** The CRM half of a lead: how to reach them, saved replies, a reminder, the quote, notes, merge. */
function LeadCrm({ l, full, patch, others, templates }: { l: LeadSummary; full: Lead | null; patch: Patch; others: LeadSummary[]; templates: Template[] }) {
  const [editing, setEditing] = React.useState(false);
  const [d, setD] = React.useState({ name: "", phone: "", ig: "", company: "", source: "", kind: "" });
  const [notes, setNotes] = React.useState<string | null>(null);
  const [rAt, setRAt] = React.useState("");
  const [rText, setRText] = React.useState("");
  const [quote, setQuote] = React.useState<string | null>(null);
  const [into, setInto] = React.useState("");
  const [sure, setSure] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const run = (p: Promise<unknown>, ok?: string) => p.then(() => setNote(ok ?? null)).catch((e: unknown) => setNote(errorText(e)));
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
