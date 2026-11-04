"use client";

import * as React from "react";
import { credentials, KEY_STORE, References } from "@/components/admin-inbox";
import { TOKEN_STORE } from "@/lib/admin-github";
import type { Enquiry } from "@/lib/inbox";
import { isLate, STAGES, trashDaysLeft, type Lead, type LeadEvent, type LeadSummary, type Stage } from "@/lib/leads";
import { cn } from "@/lib/utils";

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

type Filter = "needs" | "open" | "upcoming" | Stage | "snoozed" | "archived" | "trash" | "more";

const DAY = 864e5;
const now = () => Date.now();
const snoozed = (l: LeadSummary) => !!l.snoozeUntil && Date.parse(l.snoozeUntil) > now();
const closed = (s: Stage) => s === "Delivered" || s === "Lost";
/** Archived or in the trash: out of every list but its own. */
const aside = (l: LeadSummary) => !!(l.archivedAt || l.trashedAt);
const needsMe = (l: LeadSummary) => !aside(l) && !snoozed(l) && !closed(l.stage) && (l.unread || isLate(l, now()) || !!l.flags?.length);

/** What to do next, in a word or two, and whether it is late. */
function nextStep(l: LeadSummary): string | null {
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
  const changed = (l: Lead) => setLeads((rows) => rows?.map((r) => (r.email === l.email ? { ...r, ...l, snoozeUntil: l.snoozeUntil, archivedAt: l.archivedAt, trashedAt: l.trashedAt, id: r.id } : r)) ?? null);

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
  const needs = count("needs");
  const pick = (f: Filter) => { setFilter(f); setOpen(null); scrollTo(0, 0); };
  const signOut = () => {
    try { localStorage.removeItem(KEY_STORE); localStorage.removeItem(TOKEN_STORE); } catch {}
    setLeads(null);
    setError("Not authorized.");
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
      style={{ fontFamily: 'var(--font-v2-text, "Helvetica Neue", Helvetica, Arial, sans-serif)', letterSpacing: 0 }}
      ref={fit}
      className="normal-case text-foreground max-lg:pb-[calc(84px+env(safe-area-inset-bottom))] lg:grid lg:grid-cols-[220px_minmax(0,420px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden lg:rounded-[14px] lg:border lg:border-border lg:bg-background [&_button]:normal-case [&_h2]:normal-case [&_h3]:normal-case"
    >
      {/* Desktop: the sidebar. Every list, then this device's switches. */}
      <nav aria-label="Lead lists" className="hidden min-h-0 flex-col overflow-y-auto border-r border-border p-2.5 lg:flex">
        {(["needs", "open", "upcoming"] as const).map((f) => (
          <SideLink key={f} on={filter === f} n={count(f)} onClick={() => pick(f)}>{label(f)}</SideLink>
        ))}
        <SideGroup>Stage</SideGroup>
        {OPEN_STAGES.map((s) => <SideLink key={s} on={filter === s} n={count(s)} onClick={() => pick(s)}>{s}</SideLink>)}
        <SideGroup>Closed</SideGroup>
        {(["Delivered", "Lost"] as const).map((s) => <SideLink key={s} on={filter === s} n={count(s)} onClick={() => pick(s)}>{s}</SideLink>)}
        <SideGroup>Put aside</SideGroup>
        {(["snoozed", "archived", "trash"] as const).map((f) => <SideLink key={f} on={filter === f} n={count(f)} onClick={() => pick(f)}>{label(f)}</SideLink>)}
        <div className="mt-auto grid border-t border-border pt-2">{device}</div>
      </nav>

      <section aria-label="Leads" className={cn("min-w-0 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-border", open && "max-lg:hidden")}>
        <header className="grid gap-3 border-b border-border px-1 pb-3 pt-2 lg:px-5 lg:pt-4">
          <p className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
            {needs ? `${needs} waiting on you` : "Nothing waiting on you"}
          </p>
          <div className="flex items-baseline justify-between gap-3">
            <h2 style={HEAD} className="text-[32px] leading-none lg:text-xl">{filter === "more" ? "More" : label(filter)}</h2>
            {filter === "more" ? null : (
              <span className="font-mono text-[12.5px] text-muted-foreground">{shown.length} {shown.length === 1 ? "lead" : "leads"}</span>
            )}
          </div>
          {filter === "more" ? null : (
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
          {MORE.includes(filter) ? (
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
            </ul>
            <div className="grid">
              <p className="px-1 pb-1 font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">This device</p>
              {device}
            </div>
          </div>
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
          <Detail key={current.id} summary={current} call={call} onChange={changed} onBack={() => setOpen(null)} />
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
const tabOf = (f: Filter): Tab => (f === "needs" || f === "upcoming" ? f : f === "more" || MORE.includes(f) ? "more" : "open");
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "needs", label: "Needs me", icon: <><path d="M4 13l3-8h10l3 8v6H4z" /><path d="M4 13h5l1 2h4l1-2h5" /></> },
  { id: "open", label: "Open", icon: <path d="M5 6h14M5 12h14M5 18h9" /> },
  { id: "upcoming", label: "Upcoming", icon: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></> },
  { id: "more", label: "More", icon: <><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></> },
];

const initials = (l: LeadSummary) =>
  (l.name.includes("@") ? l.name.slice(0, 2) : l.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("")).toUpperCase();

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
      <span
        aria-hidden="true"
        className={cn("grid size-10 shrink-0 place-items-center rounded-full border bg-card font-mono text-[13px] font-medium", l.unread ? "border-accent text-accent" : "border-border")}
      >
        {initials(l)}
      </span>
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

function SideLink({ on, n, onClick, children }: { on: boolean; n: number; onClick: () => void; children: React.ReactNode }) {
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
      <span className={cn("font-mono text-[12.5px]", on ? "text-accent" : "text-muted-foreground")}>{n}</span>
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
  return (
    <div className="grid gap-1 px-3 pt-4 font-mono text-[12.5px] text-muted-foreground">
      {on === null ? null : (
        <button type="button" onClick={on ? turnOff : turnOn} className="min-h-11 w-fit text-left hoverable:hover:text-foreground">
          Notifications: <span className={on ? "text-accent" : undefined}>{on ? "on" : "off"}</span>
        </button>
      )}
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
  if (f === "more") return false;
  if (f === "snoozed") return snoozed(l);
  if (f === "open") return !closed(l.stage);
  return l.stage === f && !snoozed(l);
}
const LABEL: Partial<Record<Filter, string>> = { needs: "Needs me", open: "All open", upcoming: "Upcoming", snoozed: "Snoozed", archived: "Archived", trash: "Trash" };
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

function Detail({ summary, call, onChange, onBack }: { summary: LeadSummary; call: Call; onChange: (l: Lead) => void; onBack: () => void }) {
  const [lead, setLead] = React.useState<Lead | null>(null);
  const [message, setMessage] = React.useState<Enquiry | null>(null);
  const [msgKey, setMsgKey] = React.useState<string | null>(null);
  const [asked, setAsked] = React.useState(false);
  const [snoozing, setSnoozing] = React.useState(false);
  const key = `lead:${summary.id}`;

  const patch = React.useCallback(
    async (body: Record<string, unknown>) => {
      const o = await call({ method: "PATCH", body: JSON.stringify({ key, ...body }) });
      setLead(o.lead as Lead);
      onChange(o.lead as Lead);
    },
    [call, key, onChange],
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
    <div className="grid gap-6 px-5 py-6 lg:px-8 lg:py-7">
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
  }
}
