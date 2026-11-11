"use client";

import * as React from "react";
import { KEY_STORE, TOKEN_STORE } from "@/lib/admin-github";
import { LeadBoard } from "@/components/lead-board";
import { LeadHours } from "@/components/lead-hours";
import { ProofsDesk } from "@/components/admin/admin-proofs";
import { LeadUpcoming } from "@/components/lead-upcoming";
import { leadSummary, STAGES, type Lead, type LeadSummary, type Stage } from "@/lib/leads";
import { cn } from "@/lib/utils";
import { type Template } from "@/lib/lead-crm";
import { LicenceList } from "@/components/lead-licence";
import { aside, authed, closed, errorText, type Filter, inboxCall, loadError, matches, pass, snoozed } from "@/lib/lead-desk";
import { badge, btn, HEAD, label, primary } from "@/components/leads/shared";
import { Card, clampW, LIST_W, LIST_W_STORE, ListResizer, Pill, Row, SideLink } from "@/components/leads/list";
import { DeskKeys } from "@/components/leads/desk-keys";
import { DeskToday } from "@/components/leads/today";
import { MoneyView } from "@/components/leads/money";
import { StatsView } from "@/components/leads/stats";
import { TemplatesEditor } from "@/components/leads/templates";
import { EmptyTrash, ImportInbox, NewLeadForm, PushSwitch, SignIn, SW_URL, swScope } from "@/components/leads/setup";
import { Detail } from "@/components/leads/detail";

export { Detail, SignIn };

// The /admin tabs the One Desk folds in, loaded only when opened.
const AdminTraffic = React.lazy(() => import("@/components/admin/admin-traffic").then((m) => ({ default: m.AdminTraffic })));
const AdminSeo = React.lazy(() => import("@/components/admin/admin-seo").then((m) => ({ default: m.AdminSeo })));
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

/* ── the CRM tools: a lead by hand, the numbers, templates, the export ── */

/** Every lead as a CSV file, through the same key as the rest of the desk. */
async function exportCsv() {
  const res = await fetch("/api/inbox?csv", { headers: authed(), cache: "no-store" });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: `leads-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
