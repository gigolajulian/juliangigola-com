"use client";

/* ── the lead desk on Astryx, opt-in ──────────────────────────────
 * Julian (2026-11-09): "use it to redesign leads app", then picked the
 * Leads redesign mock (claude.ai/artifact/9TrLqxf8vV4jU4uWPLZz2W, "yes
 * send it to backend"). /admin/leads since the original desk retired (2026-11-11); Astryx's
 * CSS never reaches the site.
 *
 * Home is the table-filter shape: Your move, This week, Waiting on them,
 * with the open lead beside the list when wide. Phone (≤760) gets a tab
 * bar, mid (<1180) a stacked header; under 1280 the side nav is an icon rail. The lead page is
 * its own Astryx layout (components/leads/lead.tsx).
 * ─────────────────────────────────────────────────────────────── */

import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-neutral/theme.css";
import * as React from "react";
import { defineTheme, Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { CommandPalette } from "@astryxdesign/core/CommandPalette";
import { createStaticSource, type SearchableItem } from "@astryxdesign/core/Typeahead";
import { Layout, LayoutContent, LayoutHeader, LayoutPanel, HStack, VStack, StackItem, Card } from "@astryxdesign/core/Layout";
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Badge } from "@astryxdesign/core/Badge";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { SignIn } from "@/components/leads/setup";
import { LeadDesk } from "@/components/leads/lead";
import { badge, FROST_ROOM, frostBar, GLASS, WIN_CSS } from "@/components/leads/shared";
import { ago, aside, errorText, inboxCall, loadError, matches, nextStep, pass } from "@/lib/leads/lead-desk";
import { useSiteThemeRead } from "@/lib/site-theme";
import type { Template } from "@/lib/leads/lead-crm";
import { TZ } from "@/lib/booking/booking-rules";
import { KEY_STORE, saveAdminKey, TOKEN_STORE } from "@/lib/admin/admin-github";
import { leadSummary, shootTag, STAGES, type Lead, type LeadPatch, type LeadSummary, type Stage as StageName } from "@/lib/leads/leads";
import { TodayDesk } from "@/components/leads/today";
import { NewLeadDesk } from "@/components/leads/new-lead";
import { BoardDesk } from "@/components/leads/board";
import { CalendarDesk } from "@/components/leads/calendar";
import { MoneyDesk } from "@/components/leads/money";
import { ASIDE, AsideDesk, LicencesDesk } from "@/components/leads/lists";
import { About, about, Age, Next } from "@/components/leads/row";
import { InvoicesDesk } from "@/components/leads/invoices";
import { PanelDesk, StatsDesk } from "@/components/leads/numbers";
import { DeviceDesk, HoursDesk, TemplatesDesk } from "@/components/leads/setup-panels";
import { type Filter } from "@/lib/leads/lead-desk";
import { ProofsDesk } from "@/components/proofs/desk";

type Size = "phone" | "mid" | "wide";
/** Every page of the desk. */
type View = "today" | "leads" | "new" | "calendar" | "money" | "invoices" | "licences" | "aside" | "stats" | "traffic" | "seo" | "hours" | "templates" | "device" | "more" | "proofs";
/** Julian (2026-11-10): "simplify the left tab or group them up", "merge panels that are related", "add icon to all".
 * One nav item per group; a group with more than one page gets a tab row on top. */
const SECTIONS: [View, string, [string, View][]][] = [
  ["leads", "Leads", [["Open", "leads"], ["Put aside", "aside"]]],
  ["calendar", "Calendar", [["Calendar", "calendar"], ["Hours", "hours"]]],
  ["money", "Money", [["Stripe", "money"], ["Invoices", "invoices"], ["Licences", "licences"]]],
  ["stats", "Numbers", [["Stats", "stats"], ["Traffic", "traffic"], ["SEO", "seo"]]],
  ["templates", "Settings", [["Templates", "templates"], ["This device", "device"]]],
  ["proofs", "Proofs", [["Galleries", "proofs"]]],
];
const sectionOf = (v: View) => SECTIONS.find(([, , pages]) => pages.some(([, p]) => p === v));
type Group = "now" | "week" | "waiting";

/* The site's tokens (app/styles/tokens.css): warm near-black, one teal accent; the site's own Inter Tight and Plex Mono. */
const leadsTheme = defineTheme({
  name: "leads",
  extends: neutralTheme,
  tokens: {
    "--color-accent": ["oklch(0.5 0.09 195)", "oklch(0.72 0.095 195)"],
    "--color-background-body": ["oklch(0.945 0.003 250)", "oklch(0.145 0.003 70)"],
    "--color-background-card": ["#ffffff", "oklch(0.185 0.003 70)"],
    "--color-background-surface": ["#ffffff", "oklch(0.185 0.003 70)"],
    "--color-background-muted": ["oklch(0.92 0.003 250)", "oklch(0.21 0.003 70)"],
    "--color-text-accent": ["oklch(0.5 0.09 195)", "oklch(0.72 0.095 195)"],
    "--font-family-body": 'var(--font-display), "Inter Tight", system-ui, sans-serif',
    "--font-family-heading": 'var(--font-display), "Inter Tight", system-ui, sans-serif',
    "--font-family-code": 'var(--font-mono), "IBM Plex Mono", ui-monospace, monospace',
  },
});

const GROUPS: [Group, string][] = [["now", "Your move"], ["week", "This week"], ["waiting", "Waiting on them"]];
const ROAD: readonly StageName[] = STAGES.filter((s) => s !== "Lost");
/** A day from the moment of the swipe or press. */
const dayOn = () => new Date(Date.now() + 864e5).toISOString();
const BOARD_STORE = "jg-leads-board";
const WEEK = 7 * 864e5;
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...o });
const date = (iso: string) => fmt({ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
const stamp = (t: number) => fmt({ weekday: "short", month: "short", day: "numeric" }).format(new Date(t)).toUpperCase().replace(",", "");

const svg = (d: React.ReactNode) =>
  function Glyph(p: React.SVGProps<SVGSVGElement>) {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{d}</svg>;
  };
const HomeGlyph = svg(<path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z" />);
const InboxGlyph = svg(<><path d="M4 13l3-8h10l3 8v6H4z" /><path d="M4 13h5l1 2h4l1-2h5" /></>);
const CalendarGlyph = svg(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>);
const MoreGlyph = svg(<><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></>);
const MoneyGlyph = svg(<><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>);
const PlusGlyph = svg(<path d="M12 5v14M5 12h14" />);
const ChartGlyph = svg(<path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />);
const GearGlyph = svg(<><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></>);
const PhotoGlyph = svg(<><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M20 16l-5-5-8 8" /></>);
const FindGlyph = svg(<><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>);
const SiteGlyph = svg(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11" /></>);
const GLYPH: Partial<Record<View, React.ComponentType<React.SVGProps<SVGSVGElement>>>> = { proofs: PhotoGlyph, leads: InboxGlyph, calendar: CalendarGlyph, money: MoneyGlyph, stats: ChartGlyph, templates: GearGlyph };
/** Out of the desk: the site editor. */
const LINKS: [string, string, React.ComponentType<React.SVGProps<SVGSVGElement>>][] = [["Pages and work", "/admin", SiteGlyph]];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text type="code" size="xsm" color="secondary" weight="medium">{children}</Text>;
}


function Stage({ l }: { l: LeadSummary }) {
  const at = ROAD.indexOf(l.stage);
  return (
    <VStack gap={1}>
      <HStack gap={2} vAlign="center">
        <StackItem size="fill"><Text type="label">{l.stage}</Text></StackItem>
        {at >= 0 ? <Text type="code" size="xsm" color="secondary">{at + 1} of {ROAD.length}</Text> : null}
      </HStack>
      {at >= 0 ? <ProgressBar label="Stage" isLabelHidden value={at + 1} max={ROAD.length} /> : null}
    </VStack>
  );
}

/* The side nav in the order of the work: what to do, what it earns, how it is set up (Julian, 2026-11-14). */
const NAV: [string, View[]][] = [["Work", ["leads", "calendar", "proofs"]], ["Business", ["money", "stats"]], ["Setup", ["templates"]]];
const FIND_KEY = () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "\u2318K" : "Ctrl K");
type Found = SearchableItem<{ group: string; words?: string[] }>;
const GO: Found[] = [["new", "New lead"], ["today", "Today"], ...SECTIONS.map(([to, label]): [View, string] => [to, label])].map(([to, label]) => ({ id: `go:${to}`, label, auxiliaryData: { group: "Go to" } }));

function Nav({ needs, view, go, find }: { needs: number; view: View; go: (v: View) => void; find: () => void }) {
  return (
    <SideNav header={<SideNavHeading heading="Desk" subheading="juliangigola.com" />}>
      <SideNavSection title="Desk" isHeaderHidden>
        <SideNavItem label="New lead" icon={PlusGlyph} isSelected={view === "new"} onClick={() => go("new")} />
        <SideNavItem label="Search" icon={FindGlyph} onClick={find} endContent={<Text type="code" size="xsm" color="secondary">{FIND_KEY()}</Text>} />
      </SideNavSection>
      {NAV.map(([title, tos]) => (
        <SideNavSection key={title} title={title}>
          {title === "Work" ? <SideNavItem label="Today" icon={HomeGlyph} isSelected={view === "today"} onClick={() => go("today")} /> : null}
          {SECTIONS.filter(([to]) => tos.includes(to)).map(([to, label]) => (
            <SideNavItem key={to} label={label} icon={GLYPH[to]} isSelected={sectionOf(view)?.[0] === to} onClick={() => go(to)}
              endContent={to === "leads" ? <Text type="code" size="xsm">{needs}</Text> : undefined} />
          ))}
          {title === "Setup" ? LINKS.map(([label, href, glyph]) => <SideNavItem key={label} label={label} icon={glyph} href={href} />) : null}
        </SideNavSection>
      ))}
    </SideNav>
  );
}

/** The phone's More tab: everything the side nav holds below the four tabs. */
function More({ go }: { go: (v: View) => void }) {
  return (
    <Layout
      height="fill"
      header={<LayoutHeader><Heading level={1} weight="bold">More</Heading></LayoutHeader>}
      content={
        <LayoutContent role="main" label="More" padding={4}>
          <VStack gap={5}>
            <List hasDividers>
              <ListItem label="New lead" startContent={<Icon icon={PlusGlyph} color="secondary" />} onClick={() => go("new")} />
              {SECTIONS.filter(([to]) => to !== "leads" && to !== "calendar").map(([to, label]) => <ListItem key={to} label={label} startContent={<Icon icon={GLYPH[to]!} color="secondary" />} onClick={() => go(to)} />)}
              <ListItem label="Put aside" startContent={<Icon icon={InboxGlyph} color="secondary" />} onClick={() => go("aside")} />
            </List>
            <VStack gap={1}>
              <Eyebrow>ELSEWHERE</Eyebrow>
              <List hasDividers>{LINKS.map(([label, href, glyph]) => <ListItem key={label} label={label} startContent={<Icon icon={glyph} color="secondary" />} href={href} />)}</List>
            </VStack>
          </VStack>
        </LayoutContent>
      }
    />
  );
}

/* The phone's tab bar. Astryx has no bottom bar, so each tab is a plain button: the whole cell is the
 * target (56px tall), a pill marks the tab that is on (not color alone), and Leads carries the count. */
const tabCell: React.CSSProperties = { flex: 1, minHeight: 56, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: "none", border: 0, padding: 0, cursor: "pointer", touchAction: "manipulation" };
const PULL = 72; // px of pull, at the top of the page, that refreshes on release
const tabPill = (on: boolean): React.CSSProperties => ({ position: "relative", width: 60, height: 30, borderRadius: 15, display: "grid", placeItems: "center", background: on ? "color-mix(in oklch, var(--color-accent) 20%, transparent)" : "transparent" });
const tabCount: React.CSSProperties = { position: "absolute", top: -4, insetInlineEnd: 2 };

function TabBar({ view, go, needs }: { view: View; go: (v: View) => void; needs: number }) {
  const tabs: [string, React.ComponentType<React.SVGProps<SVGSVGElement>>, View][] = [["Today", HomeGlyph, "today"], ["Leads", InboxGlyph, "leads"], ["Calendar", CalendarGlyph, "calendar"], ["More", MoreGlyph, "more"]];
  return (
    <nav aria-label="Desk" style={{ display: "flex", paddingInline: 8, paddingBlockStart: 4 }}>
      {tabs.map(([label, glyph, to]) => {
        // The Leads tab stays on for its pages (Put aside); More for what it opens.
        const on = to === view || (to === "leads" && view === "aside");
        return (
          <button key={label} type="button" style={tabCell} aria-current={on ? "page" : undefined} onClick={() => go(to)}>
            <span style={tabPill(on)}>
              <Icon icon={glyph} size="md" color={on ? "accent" : "secondary"} />
              {to === "leads" && needs ? <span style={tabCount}><Badge label={needs} variant="teal" /></span> : null}
            </span>
            <Text type="supporting" size="xsm" weight="medium" color={on ? "primary" : "secondary"}>{label}</Text>
          </button>
        );
      })}
    </nav>
  );
}

/* The iPad's nav: the tab bar's cells stood on end, 84 wide, so the page keeps the width. */
const railCell: React.CSSProperties = { ...tabCell, flex: "none", width: 76, minHeight: 58, textDecoration: "none" };

function Rail({ needs, view, go }: { needs: number; view: View; go: (v: View) => void }) {
  const face = (label: string, glyph: React.ComponentType<React.SVGProps<SVGSVGElement>>, on: boolean, count?: number) => (
    <>
      <span style={tabPill(on)}>
        <Icon icon={glyph} size="md" color={on ? "accent" : "secondary"} />
        {count ? <span style={tabCount}><Badge label={count} variant="teal" /></span> : null}
      </span>
      <Text type="supporting" size="xsm" weight="medium" color={on ? "primary" : "secondary"}>{label}</Text>
    </>
  );
  const items: [string, React.ComponentType<React.SVGProps<SVGSVGElement>>, View, boolean][] = [
    ["New", PlusGlyph, "new", view === "new"],
    ["Today", HomeGlyph, "today", view === "today"],
    ...SECTIONS.map(([to, label]): [string, React.ComponentType<React.SVGProps<SVGSVGElement>>, View, boolean] => [label, GLYPH[to]!, to, sectionOf(view)?.[0] === to]),
  ];
  return (
    <nav aria-label="Desk" style={{ height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingBlock: 12, /* the same panel as the phone bars and the desktop nav */ background: frostBar.background, backdropFilter: frostBar.backdropFilter, WebkitBackdropFilter: frostBar.WebkitBackdropFilter }}>
      {items.map(([label, glyph, to, on]) => (
        <button key={to} type="button" style={railCell} aria-current={on ? "page" : undefined} onClick={() => go(to)}>{face(label, glyph, on, to === "leads" ? needs : undefined)}</button>
      ))}
      <span style={{ flex: 1 }} />
      {LINKS.map(([label, href, glyph]) => <a key={label} href={href} style={railCell} aria-label={label}>{face("Site", glyph, false)}</a>)}
    </nav>
  );
}

export function LeadsDesk() {
  const [leads, setLeads] = React.useState<LeadSummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [pick, setPick] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  // Today first, as on the classic desk.
  const [screen, setScreen] = React.useState<View>("today");
  const [fresh, setFresh] = React.useState<Lead | null>(null);
  const [calTab, setCalTab] = React.useState<"bookings" | "availability">("bookings");
  const [asideTab, setAsideTab] = React.useState<Filter>("snoozed");
  // List or Board, kept on this device under the classic desk's key. The desk draws nothing until mounted (see `mode`), so no hydration gap.
  const [board, setBoardState] = React.useState(() => typeof window !== "undefined" && (() => { try { return localStorage.getItem(BOARD_STORE) === "1"; } catch { return false; } })());
  const setBoard = (on: boolean) => { setBoardState(on); try { localStorage.setItem(BOARD_STORE, on ? "1" : "0"); } catch {} };
  // The gallery a lead's Galleries section opened the Proofs desk on; the side nav opens it on the list.
  const [proofPick, setProofPick] = React.useState<string | null>(null);
  const show = (v: View) => { setScreen(v); setOpen(null); setProofPick(null); };
  const [templates, setTemplates] = React.useState<Template[]>([]);
  // When the list was loaded: groups by date without reading the clock during render.
  const [at, setAt] = React.useState(0);
  const isPhone = useMediaQuery("(max-width: 760px)");
  // Wide from 1180, an iPad on its side: the rail below is what leaves room for the open lead.
  const isMid = useMediaQuery("(max-width: 1179px)");
  const railed = useMediaQuery("(max-width: 1279px)");
  const size: Size = isPhone ? "phone" : isMid ? "mid" : "wide";

  const call = inboxCall;
  const load = React.useCallback(() => {
    call<{ leads: LeadSummary[] }>({ query: "?leads" })
      .then((o) => { setLeads(o.leads); setAt(Date.now()); })
      .catch((e: unknown) => setError(loadError(e)));
  }, [call]);
  React.useEffect(load, [load]);
  // The installed app's badge: unread leads not put aside, as on the original desk.
  React.useEffect(() => { if (leads) badge(leads.filter((l) => l.unread && !aside(l)).length); }, [leads]);
  React.useEffect(() => {
    call<{ templates: Template[] }>({ query: "?templates" }).then((o) => setTemplates(o.templates)).catch(() => {});
  }, [call]);
  // Search and quick actions, on Ctrl or Cmd K: every lead by name, email, shoot or stage, and every page.
  const [finding, setFinding] = React.useState(false);
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      setFinding((v) => !v);
    };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, []);
  const finder = React.useMemo(
    () => createStaticSource<Found>(
      [...GO, ...(leads ?? []).filter((l) => !l.trashedAt && l.id).map((l) => ({ id: `lead:${l.id}`, label: l.name || l.email, auxiliaryData: { group: "Leads", words: [l.email, l.kind ?? "", l.stage] } }))],
      { keywords: (i) => i.auxiliaryData?.words ?? [] },
    ),
    [leads],
  );
  // Astryx follows the site's own light/dark (html[data-theme], dark when unset), so the ink matches the page behind it.
  // Unknown until read: Astryx's root Theme writes data-theme onto <html> itself, so mounting it with a guess would lock that guess in.
  const mode = useSiteThemeRead();

  // Pull down to refresh: the installed phone app has no browser bar to do it. At the top of the page, a pull past
  // PULL px loads the leads again and remounts the page, so its own fetches (money, visits, galleries) run again.
  // Never with a lead open, which may hold typing.
  const [tick, setTick] = React.useState(0);
  const [pull, setPull] = React.useState(0);
  const pullOk = React.useRef(false);
  React.useEffect(() => {
    let x0 = 0, y0 = -1, d = 0;
    const atTop = (el: Element | null) => { for (; el; el = el.parentElement) if (el.scrollTop > 0) return false; return true; };
    const start = (e: TouchEvent) => {
      d = 0;
      y0 = pullOk.current && e.touches.length === 1 && atTop(e.target as Element) ? e.touches[0].clientY : -1;
      x0 = e.touches[0].clientX;
    };
    const move = (e: TouchEvent) => {
      if (y0 < 0) return;
      d = e.touches[0].clientY - y0;
      // a sideways swipe (the week strip, a tab row) is not a pull
      if (Math.abs(e.touches[0].clientX - x0) > Math.max(24, d)) { y0 = -1; d = 0; }
      setPull(Math.max(0, d));
    };
    const end = (e: TouchEvent) => {
      if (e.type === "touchend" && y0 >= 0 && d > PULL) { load(); setTick((t) => t + 1); }
      y0 = -1;
      setPull(0);
    };
    addEventListener("touchstart", start, { passive: true });
    addEventListener("touchmove", move, { passive: true });
    addEventListener("touchend", end);
    addEventListener("touchcancel", end);
    return () => { removeEventListener("touchstart", start); removeEventListener("touchmove", move); removeEventListener("touchend", end); removeEventListener("touchcancel", end); };
  }, [load]);

  if (error === "Not authorized." || error?.startsWith("GitHub did not accept"))
    return (
      <SignIn
        onKey={(k) => {
          saveAdminKey(k);
          setError(null);
          load();
        }}
        wrong={!!(localStorage.getItem(KEY_STORE) || localStorage.getItem(TOKEN_STORE))}
      />
    );

  const live = (leads ?? []).filter((l) => !l.trashedAt);
  const words = query.trim().toLowerCase();
  const groupOf = (l: LeadSummary): Group | null => {
    if (pass(l, "needs")) return "now";
    if (!pass(l, "open")) return null;
    if (pass(l, "upcoming") && Date.parse(l.when!) < at + WEEK) return "week";
    return "waiting";
  };
  const rows = live.filter((l) => matches(l, words)).map((l) => [l, groupOf(l)] as const).filter((r): r is readonly [LeadSummary, Group] => r[1] !== null);
  const needs = rows.filter(([, g]) => g === "now").length;
  const sel = live.find((l) => l.id === pick) ?? rows[0]?.[0];
  const current = live.find((l) => l.id === open);
  const changed = (l: Lead) => setLeads((rs) => rs?.map((r) => (r.email === l.email ? { ...r, ...leadSummary(l), id: r.id } : r)) ?? null);
  /** A swipe or a button here: the same PATCH the lead's own Snooze, Archive and stage buttons send. */
  const act = (l: LeadSummary, body: LeadPatch) =>
    call<{ lead: Lead }>({ method: "PATCH", body: JSON.stringify({ key: `lead:${l.id}`, ...body }) })
      .then((o) => changed(o.lead))
      .catch((e: unknown) => { alert(errorText(e)); load(); });
  const tomorrow = (l: LeadSummary) => act(l, { snoozeUntil: dayOn() });
  // The board is for a laptop: a phone keeps the list.
  const boarding = board && size !== "phone";
  const eyebrow = `${at ? stamp(at) : ""} · ${needs} NEED YOU`;

  const newLead = size === "phone"
    ? <IconButton label="New lead" variant="secondary" onClick={() => show("new")} icon={<Icon icon={PlusGlyph} />} />
    : <Button label="New lead" variant="secondary" size="sm" onClick={() => show("new")} icon={<Icon icon={PlusGlyph} />} />;
  const search = <TextInput value={query} onChange={setQuery} label="Find a lead" isLabelHidden placeholder="Name, email, shoot" size={size === "phone" ? "lg" : "sm"} />;
  // Open or Put aside, under the title and search on both pages (it was a tab row above the title).
  const openCount = live.filter((l) => groupOf(l) !== null).length;
  const asideCount = (leads ?? []).filter((l) => ASIDE.some(([f]) => pass(l, f))).length;
  const switcher = (
    <SegmentedControl label="Open or put aside" value={screen === "aside" ? "aside" : "leads"} onChange={(v) => show(v as View)} layout={size === "wide" ? "hug" : "fill"} size={size === "phone" ? "lg" : "md"}>
      <SegmentedControlItem value="leads" label={`Open ${openCount}`} />
      <SegmentedControlItem value="aside" label={`Put aside ${asideCount}`} />
    </SegmentedControl>
  );
  const view = (
    <SegmentedControl label="View" value={board ? "board" : "list"} onChange={(v) => setBoard(v === "board")} size="sm">
      <SegmentedControlItem value="list" label="List" />
      <SegmentedControlItem value="board" label="Board" />
    </SegmentedControl>
  );
  const title = (
    <VStack gap={0}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Heading level={1} weight="bold">Leads</Heading>
    </VStack>
  );

  const home = (
    <Layout
      height="fill"
      defaultHasDividers
      header={
        <LayoutHeader>
          {size === "wide" ? (
            <HStack gap={3} vAlign="center">
              <StackItem size="fill">{title}</StackItem>
              <StackItem>{switcher}</StackItem>
              {railed ? search : <Button label={`Search ${FIND_KEY()}`} variant="secondary" size="sm" icon={<Icon icon={FindGlyph} />} onClick={() => setFinding(true)} />}
              {view}
              {newLead}
            </HStack>
          ) : (
            <VStack gap={3}>
              <HStack gap={2} vAlign="center"><StackItem size="fill">{title}</StackItem>{newLead}</HStack>
              <HStack gap={3} vAlign="center"><StackItem size="fill">{search}</StackItem>{size === "mid" ? view : null}</HStack>
              {switcher}
            </VStack>
          )}
        </LayoutHeader>
      }
      content={
        <LayoutContent role="main" label="Leads" padding={4}>
          <VStack gap={6}>
            {error ? <Text color="secondary">{error}</Text> : null}
            {!leads && !error ? <Eyebrow>LOADING LEADS</Eyebrow> : null}
            {boarding ? (
              <BoardDesk leads={live.filter((l) => !l.archivedAt && l.stage !== "Lost" && matches(l, words))} onMove={(l, stage) => act(l, { stage })} open={(l) => setOpen(l.id ?? null)} />
            ) : GROUPS.map(([g, name]) => {
              const these = rows.filter(([, gg]) => gg === g).map(([l]) => l).sort((a, b) => (g === "week" ? a.when!.localeCompare(b.when!) : b.lastAt.localeCompare(a.lastAt)));
              if (!these.length) return null;
              return (
                <VStack key={g} gap={1}>
                  <HStack gap={2} vAlign="center"><Text type="label" weight="semibold">{name}</Text><Text type="supporting">{these.length}</Text></HStack>
                  <List hasDividers>
                    {these.map((l) => (
                      <ListItem
                        key={l.id}
                        align="first-line"
                        isSelected={size === "wide" && l.id === sel?.id}
                        onClick={() => (size === "wide" ? setPick(l.id ?? null) : setOpen(l.id ?? null))}
                        startContent={<StatusDot variant={l.unread ? "accent" : "neutral"} label={l.unread ? "New" : "Read"} />}
                        label={<HStack gap={2} vAlign="center"><StackItem size="fill"><Text type="large" weight="semibold">{l.name}</Text></StackItem><Age l={l} /></HStack>}
                        description={
                          <VStack gap={1}>
                            <About>{about([l.kind ? shootTag(l.kind) : null, l.stage, l.when ? date(l.when) : null])}</About>
                            {/* Their last words stay beside the list on wider screens; a phone row is three lines. */}
                            {size !== "phone" && l.snippet ? <Text type="body" color="secondary" maxLines={1}>{l.snippet}</Text> : null}
                            <Next l={l} waiting={g === "waiting"} />
                          </VStack>
                        }
                        // Julian: swipe on the iPhone. Right: later, a day; left: archive.
                        swipeActions={{
                          leading: [{ id: "later", label: "Tomorrow", variant: "neutral", hasRemoval: true, onActivate: () => tomorrow(l) }],
                          trailing: [{ id: "archive", label: "Archived", variant: "accent", hasRemoval: true, onActivate: () => act(l, { archive: true }) }],
                        }}
                      />
                    ))}
                  </List>
                </VStack>
              );
            })}
            {leads && !rows.length && !boarding ? <Text type="supporting">Nothing here.</Text> : null}
          </VStack>
        </LayoutContent>
      }
      end={size !== "wide" || !sel || boarding ? undefined : (
        <LayoutPanel width={400} hasDivider label="Open lead">
          <VStack gap={5}>
            <VStack gap={1}>
              <Eyebrow>{[sel.kind ? shootTag(sel.kind)?.toUpperCase() : null, sel.when ? date(sel.when) : null].filter(Boolean).join(" · ") || "LEAD"}</Eyebrow>
              <Heading level={2}>{sel.name}</Heading>
            </VStack>
            <Stage l={sel} />
            <Card variant="muted" padding={4}>
              <VStack gap={3}>
                <Eyebrow>NEXT</Eyebrow>
                {/* The step itself, large; the money flag and "waiting" read as the row does. */}
                {nextStep(sel) && !sel.flags?.length ? <Text type="large">{nextStep(sel)}</Text> : <Next l={sel} waiting={groupOf(sel) === "waiting"} />}
                <HStack gap={2}>
                  <Button label={nextStep(sel) ?? "Open lead"} variant="primary" onClick={() => setOpen(sel.id ?? null)} />
                  <Button label="Snooze" variant="ghost" onClick={() => tomorrow(sel)} />
                </HStack>
              </VStack>
            </Card>
            {sel.snippet ? (
              <VStack gap={2}>
                <Eyebrow>LAST MESSAGE · {ago(sel.lastAt).toUpperCase()} AGO</Eyebrow>
                <Text type="body">{sel.snippet}</Text>
              </VStack>
            ) : null}
            <Button label="Open lead" variant="secondary" onClick={() => setOpen(sel.id ?? null)} />
          </VStack>
        </LayoutPanel>
      )}
    />
  );

  // The lead page: its own Astryx layout (components/leads/lead.tsx).
  const lead = current ? (
    <LeadDesk key={current.id} summary={current} initial={fresh?.email === current.email ? fresh : null} call={call} onChange={changed} onBack={() => setOpen(null)} reload={load} templates={templates} others={live.filter((o) => o.id !== current.id)} size={size} toProofs={(token) => { show("proofs"); setProofPick(token ?? null); }} />
  ) : null;

  // The lead from the POST itself: KV lists lag a fresh write, so it goes in by hand and opens whole.
  const added = (id: string, l: Lead) => {
    setFresh(l);
    setLeads((rs) => [{ ...leadSummary(l), id }, ...(rs ?? []).filter((r) => r.id !== id)]);
    setScreen("leads");
    setOpen(id);
  };
  const openLead = (l: LeadSummary) => setOpen(l.id ?? null);
  const signOut = () => {
    try { localStorage.removeItem(KEY_STORE); localStorage.removeItem(TOKEN_STORE); } catch {}
    setLeads(null);
    setError("Not authorized.");
  };
  const pages: Partial<Record<View, React.ReactNode>> = {
    invoices: <InvoicesDesk leads={live} call={call} open={openLead} changed={changed} />,
    licences: <LicencesDesk leads={live} open={openLead} />,
    aside: <AsideDesk leads={leads ?? []} call={call} open={openLead} done={() => { setOpen(null); load(); }} tab={asideTab} setTab={setAsideTab} top={switcher} />,
    stats: <StatsDesk call={call} />,
    traffic: <PanelDesk which="traffic" />,
    seo: <PanelDesk which="seo" />,
    hours: <HoursDesk />,
    templates: <TemplatesDesk call={call} templates={templates} saved={setTemplates} />,
    device: <DeviceDesk call={call} reload={load} signOut={signOut} />,
    more: <More go={show} />,
    proofs: <ProofsDesk embedded key={proofPick ?? ""} initial={proofPick ?? undefined} />,
  };
  const page = lead ?? pages[screen] ?? (screen === "money" ? <MoneyDesk /> : screen === "calendar" ? <CalendarDesk leads={live.filter((l) => !l.archivedAt)} size={size} open={(l) => setOpen(l.id ?? null)} tab={calTab} setTab={setCalTab} /> : screen === "new" ? <NewLeadDesk call={call} leads={live} size={size} done={added} open={(l) => setOpen(l.id ?? null)} cancel={() => show("leads")} /> : screen === "today" && leads ? <TodayDesk leads={live} size={size} open={(l) => setOpen(l.id ?? null)} show={() => show("leads")} /> : home);
  const section = lead ? null : sectionOf(screen);
  // Leads carries its own Open / Put aside switch under the title; the other groups keep the tab row.
  const shown = section && section[2].length > 1 && section[0] !== "leads" ? (
    <Layout
      height="fill"
      header={<LayoutHeader><TabList value={screen} onChange={(v) => show(v as View)} hasDivider layout="hug">{section[2].map(([label, v]) => <Tab key={v} value={v} label={label} />)}</TabList></LayoutHeader>}
      content={page}
    />
  ) : page;
  pullOk.current = !lead;
  if (!mode) return null;
  return (
    <Theme theme={leadsTheme} mode={mode}>
      {/* The site sets mono capitals everywhere; Astryx sets its own type inside. */}
      {/* The site's capitals are unlayered element rules, so they beat Astryx's layers; this beats them inside the desk. */}
      <style>{`:root [data-astryx-desk][data-astryx-desk] *,:root [data-astryx-desk][data-astryx-desk] ::placeholder{text-transform:none}${FROST_ROOM}${GLASS}${WIN_CSS}`}</style>
      <div data-astryx-desk="" data-bars={size === "phone" ? "" : undefined} data-glass={mode === "dark" ? "" : undefined}
        // Enter takes the first result when none is marked yet: the palette marks one only after an arrow key.
        onKeyDownCapture={(e) => {
          if (e.key !== "Enter" || !finding) return;
          const rows = e.currentTarget.querySelectorAll<HTMLElement>(".astryx-command-palette-item");
          if (rows.length && ![...rows].some((r) => r.hasAttribute("data-highlighted") && r.dataset.highlighted !== "false")) rows[0].click();
        }} /* the page pads the status bar above the desk (page.tsx), so the desk is the screen less that: at a full 100dvh the phone tab bar sat that far under the screen */ style={{ position: "relative", height: "calc(100dvh - env(safe-area-inset-top))", textTransform: "none", letterSpacing: "normal" }}>
        <CommandPalette
          isOpen={finding}
          onOpenChange={setFinding}
          searchSource={finder}
          label="Search leads and pages"
          onValueChange={(id) => {
            setFinding(false);
            if (id.startsWith("go:")) show(id.slice(3) as View);
            else setOpen(id.slice(5));
          }}
        />
        {size === "phone"
          ? <>{pull > 12 ? <div role="status" style={{ position: "absolute", zIndex: 5, top: "calc(env(safe-area-inset-top) + 10px)", left: 0, right: 0, textAlign: "center", pointerEvents: "none", fontSize: 12, color: "var(--color-text-secondary)", opacity: Math.min(1, pull / PULL) }}>{pull > PULL ? "Release to refresh" : "Pull to refresh"}</div> : null}<Layout height="fill" content={<React.Fragment key={tick}>{shown}</React.Fragment>} />{lead ? null /* a lead brings its own action bar */ : <div style={frostBar}><TabBar view={screen} go={show} needs={needs} /></div>}</>
          : <Layout height="fill" start={railed
              ? <LayoutPanel width={84} padding={0} hasDivider label="Desk"><Rail needs={needs} view={screen} go={show} /></LayoutPanel>
              : <LayoutPanel width={260} padding={0} label="Desk" /* SideNav draws 260 wide by default; a narrower panel clipped the counts. */><Nav needs={needs} view={screen} go={show} find={() => setFinding(true)} /></LayoutPanel>} content={shown} />}
      </div>
    </Theme>
  );
}
