"use client";

import * as React from "react";
import { credentials, KEY_STORE, References } from "@/components/admin-inbox";
import { LeadHours } from "@/components/lead-hours";
import { TOKEN_STORE } from "@/lib/admin-github";
import type { Enquiry } from "@/lib/inbox";
import { isLate, STAGES, trashDaysLeft, type Lead, type LeadEvent, type LeadSummary, type Stage } from "@/lib/leads";
import { cn } from "@/lib/utils";
import { fill, mailable } from "@/lib/lead-crm";

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

type Filter = "needs" | "open" | "upcoming" | Stage | "snoozed" | "archived" | "trash" | "more" | "new" | "stats" | "templates" | "hours";
/** Views that are not a list of leads. */
const TOOLS: Filter[] = ["more", "new", "stats", "templates", "hours"];

const DAY = 864e5;
const now = () => Date.now();
const snoozed = (l: LeadSummary) => !!l.snoozeUntil && Date.parse(l.snoozeUntil) > now();
const closed = (s: Stage) => s === "Delivered" || s === "Lost";
/** Archived or in the trash: out of every list but its own. */
const aside = (l: LeadSummary) => !!(l.archivedAt || l.trashedAt);
/** His reminder has come round: it beats a snooze. */
const due = (l: LeadSummary) => !!l.due && Date.parse(l.due) <= now();
const needsMe = (l: LeadSummary) => !aside(l) && !closed(l.stage) && (due(l) || (!snoozed(l) && (l.unread || isLate(l, now()) || !!l.flags?.length)));

/** What to do next, in a word or two, and whether it is late. */
function nextStep(l: LeadSummary): string | null {
  if (due(l)) return l.dueText || "Your reminder";
  if (l.flags?.includes("stuck")) return "Refund or rebook";
  if (l.flags?.includes("no-deposit")) return "Ask for the deposit";
  if (l.stage === "Inquiry") return "Reply";
  if (l.stage === "Quoted" && isLate(l, now())) return "Follow up";
  if (l.stage === "Shot") return "Deliver";
  return null;
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
function Chip({ l }: { l: LeadSummary }) {
  if (l.flags?.includes("stuck")) return <Tag tone="bad" mark="!">Deposit stuck</Tag>;
  if (l.flags?.includes("no-deposit")) return <Tag tone="bad" mark="!">No deposit</Tag>;
  if (due(l) && !l.trashedAt) return <Tag tone="needs" mark="◔">Reminder due</Tag>;
  if (l.trashedAt) return <Tag tone="quiet" mark="×">Deletes in {Math.max(1, trashDaysLeft(l.trashedAt, now()))} d</Tag>;
  if (snoozed(l)) return <Tag tone="quiet" mark="z">Until {day(l.snoozeUntil!)}</Tag>;
  if (isLate(l, now())) return <Tag tone="needs" mark="◷">{l.stage === "Quoted" ? `Quoted ${ago(l.stageAt)} ago` : `Late, ${ago(l.stageAt)}`}</Tag>;
  return <Tag tone={closed(l.stage) ? "quiet" : "plain"} mark={MARK[l.stage]}>{l.stage}</Tag>;
}

/** A shape per stage, so the chip never relies on color alone. */
const MARK: Record<Stage, string> = {
  Inquiry: "○", Replied: "◐", "Call booked": "◐", Quoted: "◐", Confirmed: "●", Shot: "●", Delivered: "✓", Lost: "×",
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
  const [filter, setFilter] = React.useState<Filter>("needs");
  const [open, setOpen] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [templates, setTemplates] = React.useState<Template[]>([]);

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
  const changed = (l: Lead) => setLeads((rows) => rows?.map((r) => (r.email === l.email ? { ...r, ...l, snoozeUntil: l.snoozeUntil, archivedAt: l.archivedAt, trashedAt: l.trashedAt, due: l.remind?.at, dueText: l.remind?.text.slice(0, 40), quote: l.quote, id: r.id } : r)) ?? null);

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
    .filter((l) => !words || [l.name, l.email, l.kind, l.snippet].some((v) => v?.toLowerCase().includes(words)))
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
  const doExport = () => exportCsv().catch((e: unknown) => alert(e instanceof Error ? e.message : String(e)));
  const added = (id: string) => { load(); setFilter("open"); setOpen(id); };
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
      style={{ fontFamily: 'var(--font-v2-text, "Helvetica Neue", Helvetica, Arial, sans-serif)', letterSpacing: 0 }}
      ref={fit}
      className="normal-case text-foreground max-lg:pb-[calc(84px+env(safe-area-inset-bottom))] lg:grid lg:grid-cols-[220px_minmax(0,420px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden lg:rounded-[14px] lg:border lg:border-border lg:bg-background [&_button]:normal-case [&_h2]:normal-case [&_h3]:normal-case"
    >
      {/* Desktop: the sidebar. Every list, then this device's switches. */}
      <nav aria-label="Lead lists" className="hidden min-h-0 flex-col overflow-y-auto border-r border-border p-2.5 lg:flex">
        <button type="button" onClick={() => pick("new")} className={cn(btn, primary, "mb-2 min-h-10 text-[14.5px]")}>New lead</button>
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
        <SideLink on={filter === "templates"} onClick={() => pick("templates")}>Templates</SideLink>
        <SideLink on={false} onClick={doExport}>Export CSV</SideLink>
        <SideGroup>Booking</SideGroup>
        <SideLink on={filter === "hours"} onClick={() => pick("hours")}>Hours</SideLink>
        <div className="mt-auto grid border-t border-border pt-2">{device}</div>
      </nav>

      <section aria-label="Leads" className={cn("min-w-0 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-border", open && "max-lg:hidden")}>
        <header className="grid gap-3 border-b border-border px-1 pb-3 pt-2 lg:px-5 lg:pt-4">
          <p className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
            {needs ? `${needs} waiting on you` : "Nothing waiting on you"}
          </p>
          <div className="flex items-baseline justify-between gap-3">
            <h2 style={HEAD} className="text-[32px] leading-none lg:text-xl">{label(filter)}</h2>
            {tool ? null : (
              <span className="flex items-center gap-3">
                <span className="font-mono text-[12.5px] text-muted-foreground">{shown.length} {shown.length === 1 ? "lead" : "leads"}</span>
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
          {tab === "open" ? (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 lg:hidden">
              {(["open", ...OPEN_STAGES] as const).map((f) => (
                <Pill key={f} on={filter === f} n={count(f)} onClick={() => pick(f)}>{f === "open" ? "All" : f}</Pill>
              ))}
            </div>
          ) : null}
          {MORE.includes(filter) || (tool && filter !== "more") ? (
            <button type="button" onClick={() => pick("more")} className="inline-flex min-h-11 w-fit items-center gap-1 text-[16px] text-accent lg:hidden">
              <span aria-hidden="true">‹</span> More
            </button>
          ) : null}
        </header>

        {filter === "more" ? (
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
              {([["new", "New lead"], ["stats", "Stats"], ["templates", "Templates"]] as const).map(([f, t]) => (
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
        ) : filter === "templates" ? (
          <TemplatesEditor call={call} templates={templates} saved={setTemplates} />
        ) : filter === "hours" ? (
          <LeadHours />
        ) : (
          <>
            {filter === "trash" && shown.length ? <EmptyTrash n={shown.length} call={call} done={() => { setOpen(null); load(); }} /> : null}
            {shown.length ? (
              <ul>
                {shown.map((l) => (
                  <li key={l.id}>
                    <Row l={l} on={open === l.id} upcoming={filter === "upcoming"} onClick={() => setOpen(l.id ?? null)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1 py-10 text-[15px] text-muted-foreground lg:px-5">
                {words ? "Nothing matches." : filter === "needs" ? "Nothing waiting on you." : filter === "upcoming" ? "No calls or sessions coming up." : "No leads here."}
              </p>
            )}
          </>
        )}
      </section>

      <section aria-label="Lead" className={cn("min-w-0 lg:min-h-0 lg:overflow-y-auto lg:bg-card/40", !open && "max-lg:hidden")}>
        {current ? (
          <Detail key={current.id} summary={current} call={call} onChange={changed} onBack={() => setOpen(null)} reload={load} templates={templates} others={leads.filter((o) => o.id !== current.id && !o.trashedAt)} />
        ) : (
          <p className="px-8 py-10 text-[15px] text-muted-foreground max-lg:hidden">Pick a lead to see it here.</p>
        )}
      </section>

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

/** One lead in a list: who, what and when, the start of their message, where it stands and what is next. */
function Row({ l, on, upcoming, onClick }: { l: LeadSummary; on: boolean; upcoming: boolean; onClick: () => void }) {
  const next = nextStep(l);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={on ? "true" : undefined}
      className={cn(
        "flex w-full gap-3 border-b border-border px-1 py-3.5 text-left transition-colors duration-200 hoverable:hover:bg-card lg:px-5",
        on && "bg-card shadow-[inset_3px_0_0_var(--accent)]",
      )}
    >
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-[16px] font-semibold">
            {l.unread ? <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="New" /> : null}
            <span className="truncate">{l.name}</span>
          </span>
          <span className="shrink-0 font-mono text-[12px] text-muted-foreground">{upcoming && l.when ? day(l.when) : ago(l.lastAt)}</span>
        </span>
        <span className="truncate text-[14px] text-muted-foreground">{[kindOf(l.kind), l.when ? at(l.when) : null].filter(Boolean).join(" · ") || l.email}</span>
        {l.snippet ? <span className="truncate text-[13.5px] text-muted-foreground/80">{l.snippet}</span> : null}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Chip l={l} />
          {next ? <span className="font-mono text-[12.5px] font-medium text-accent">→ {next}</span> : null}
          {l.refs ? <span className="font-mono text-[12px] text-muted-foreground">{l.refs} {l.refs === 1 ? "picture" : "pictures"}</span> : null}
        </span>
      </span>
    </button>
  );
}

function SideGroup({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pb-1.5 pt-4 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{children}</p>;
}

function SideLink({ on, n, onClick, children }: { on: boolean; n?: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex min-h-10 items-center justify-between gap-4 rounded-lg px-3 text-[14.5px] transition-colors duration-200",
        on ? "bg-card font-semibold text-foreground shadow-[inset_2px_0_0_var(--accent)]" : "text-muted-foreground hoverable:hover:bg-card hoverable:hover:text-foreground",
      )}
    >
      <span>{children}</span>
      {n === undefined || n < 0 ? null : <span className={cn("font-mono text-[12.5px]", on ? "text-accent" : "text-muted-foreground")}>{n}</span>}
    </button>
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
      setNote(devices ? `Sent to ${devices} ${devices === 1 ? "device" : "devices"}. No banner? Check Settings > Notifications > Leads.` : "No device is subscribed. Turn notifications off and on again here.");
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
  if (aside(l)) return false;
  if (f === "needs") return needsMe(l);
  if (f === "upcoming") return !!l.when && Date.parse(l.when) > now() - 2 * 3600e3 && !closed(l.stage);
  if (f === "more" || f === "hours") return false;
  if (f === "snoozed") return snoozed(l);
  if (f === "open") return !closed(l.stage);
  return l.stage === f && !snoozed(l);
}
const LABEL: Partial<Record<Filter, string>> = { needs: "Your move", open: "All open", upcoming: "Upcoming", snoozed: "Snoozed", archived: "Archived", trash: "Trash", more: "More", new: "New lead", stats: "Stats", templates: "Templates", hours: "Hours" };
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

function Detail({ summary, call, onChange, onBack, reload, templates, others }: { summary: LeadSummary; call: Call; onChange: (l: Lead) => void; onBack: () => void; reload: () => void; templates: Template[]; others: LeadSummary[] }) {
  const [lead, setLead] = React.useState<Lead | null>(null);
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
    // Once per lead: `patch` is stable for the same key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const l = lead ?? summary;
  const first = l.name.split(" ")[0];
  const late = isLate(l, now());
  const reply = compose(l.email, `Re: your ${l.kind ?? "shoot"} inquiry`, `Hi ${first},\n\n`);
  const book = compose(l.email, "Booking a time", `Hi ${first},\n\nYou can pick a time here: https://juliangigola.com/book\n\n`);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 px-5 py-6 lg:px-8 lg:py-7">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1 justify-self-start text-[16px] text-accent lg:hidden">
        <span aria-hidden="true">‹</span> Leads
      </button>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 style={HEAD} className="text-[28px] leading-tight">{l.name}</h2>
          <p className="mt-1 break-words text-[15px] text-muted-foreground">{[kindOf(l.kind), l.email].filter(Boolean).join(" · ")}</p>
        </div>
        <Tag tone={closed(l.stage) ? "quiet" : "plain"} mark={MARK[l.stage]}>{l.stage}</Tag>
      </header>

      {late ? (
        <p role="status" className="flex items-center gap-3 rounded-xl bg-accent/12 px-4 py-3.5 text-[15px]">
          <span aria-hidden="true" className="text-accent">◷</span>
          <span><b className="font-semibold text-accent">{ago(l.stageAt)} waiting.</b> {l.stage === "Quoted" ? "The quote has had no answer." : "The site promises a reply within a day."}</span>
        </p>
      ) : null}
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
        <a href={reply} target="_blank" rel="noreferrer" onClick={() => setAsked(true)} className={cn(btn, primary, "min-h-[52px] px-5 text-base")}>
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
        {l.trashedAt ? null : <button type="button" className={btn} onClick={() => patch({ archive: !l.archivedAt })}>{l.archivedAt ? "Unarchive" : "Archive"}</button>}
        <button type="button" className={btn} onClick={() => patch({ trash: !l.trashedAt })}>{l.trashedAt ? "Recover" : "Move to trash"}</button>
        <button type="button" className={btn} onClick={() => patch({ seen: false }).then(onBack)}>Mark unread</button>
        <span className="flex-1" />
        {lead?.notion ? <a href={`https://www.notion.so/${lead.notion.replace(/-/g, "")}`} target="_blank" rel="noreferrer" className={btn}>Notion</a> : null}
        {lead?.deposit ? <a href={lead.deposit} target="_blank" rel="noreferrer" className={cn(btn, "text-destructive")}>Deposit in Stripe</a> : null}
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
            <button key={t} type="button" className={btn} onClick={() => patch({ snoozeUntil: new Date(now() + Number(d) * DAY).toISOString() }).then(() => setSnoozing(false))}>{t}</button>
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
              onClick={() => l.stage !== s && patch({ stage: s })}
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
        <dt className="font-mono text-[13px] leading-6 text-muted-foreground">Deposit</dt>
        <dd className={lead?.deposit ? "" : "text-muted-foreground"}>{lead?.deposit ? "$100 paid" : "None"}</dd>
      </dl>

      {lead ? (
        <section aria-label="Timeline" className="grid gap-2.5">
          <h3 style={{ ...HEAD, fontFamily: "var(--font-mono)", fontWeight: 400, letterSpacing: 0 }} className="text-[13px] text-muted-foreground">Timeline</h3>
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
  }
}

/* ── the CRM tools: a lead by hand, the numbers, templates, the export ── */

const field = "min-h-11 w-full rounded-[10px] border border-border bg-transparent px-3.5 text-base normal-case placeholder:normal-case placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-accent";
const fieldLabel = "grid gap-1.5 text-[14px] text-muted-foreground";
const SOURCES = ["Instagram DM", "Referral", "Text", "Phone call", "Email", "In person", "Other"];
const LOST_REASONS = ["Price", "Dates", "No reply", "Went elsewhere", "Not a fit", "Other"];

/** A lead he adds himself: someone who wrote on Instagram, texted, or was referred. */
function NewLeadForm({ call, done }: { call: Call; done: (id: string) => void }) {
  const [f, setF] = React.useState({ name: "", email: "", ig: "", phone: "", company: "", kind: "", stage: "Inquiry" as Stage, source: "Instagram DM", notes: "" });
  const [note, setNote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="grid gap-4 px-1 py-5 lg:px-5"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setNote(null);
        call({ method: "POST", body: JSON.stringify({ add: f }) })
          .then((o) => done(o.id as string))
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
        <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Last 12 weeks</h3>
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
        <h3 className="pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Where they came from</h3>
        {s.sources.length ? s.sources.map((r) => (
          <p key={r.source} className="flex justify-between gap-3 border-b border-border py-2.5 text-[15px]">
            <span className="truncate">{r.source}</span>
            <span className="shrink-0 font-mono text-[13px] text-muted-foreground">{r.leads} in · <b className="font-medium text-accent">{r.booked} booked</b></span>
          </p>
        )) : <p className="text-[15px] text-muted-foreground">Nothing yet.</p>}
      </section>
      <section className="grid gap-1">
        <h3 className="pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Why they were lost</h3>
        {s.lost.length ? s.lost.map((r) => (
          <p key={r.reason} className="flex justify-between border-b border-border py-2.5 text-[15px]"><span>{r.reason}</span><span className="font-mono text-[13px] text-muted-foreground">{r.n}</span></p>
        )) : <p className="text-[15px] text-muted-foreground">None lost.</p>}
      </section>
      <section className="grid gap-1">
        <h3 className="pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">By stage · {s.total} leads</h3>
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
          <h3 className={h3}>Reply with a template</h3>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => {
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
        <h3 className={h3}>Contact</h3>
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
        <h3 className={h3}>Reminder</h3>
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
            <label className={cn(fieldLabel, "min-w-[12rem] flex-1")}>What for<input value={rText} onChange={(e) => setRText(e.target.value)} placeholder="Send the quote" className={field} /></label>
            <button type="submit" className={btn}>Remind me</button>
          </form>
        )}
      </section>

      <section className="grid gap-2.5">
        <h3 className={h3}>Quote</h3>
        <div className="flex flex-wrap items-end gap-2.5">
          <label className={fieldLabel}>
            Amount in dollars
            <input
              inputMode="decimal"
              value={quote ?? (full?.quote !== undefined ? String(full.quote) : "")}
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
      </section>

      <section className="grid gap-2.5">
        <h3 className={h3}>Notes</h3>
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
          <h3 className={h3}>Same person, another record</h3>
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
