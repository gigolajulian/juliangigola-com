"use client";

/* ── the lead desk on Astryx ─────────────────────────────────────
 * Served at /admin/leads only, so Astryx's CSS never reaches the site.
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
import { createStaticSource } from "@astryxdesign/core/Typeahead";
import { Layout, LayoutContent, LayoutHeader, LayoutPanel, HStack, VStack, StackItem } from "@astryxdesign/core/Layout";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { LockedGate } from "@/components/desk/sign-in";
import { LeadDesk, type LeadAsk } from "@/components/leads/lead";
import { FROST_ROOM, frostBar, GLASS, setUnreadBadge, WIN_CSS } from "@/components/leads/shared";
import { deskCall, inFilter, isSetAside, matches, sendLeadPatch, type Size } from "@/lib/leads/lead-desk";
import { loadErrorText, LOCKED } from "@/lib/admin/admin-call";
import { errorText } from "@/lib/utils";
import { useSiteThemeRead } from "@/lib/site-theme";
import type { Template } from "@/lib/leads/lead-crm";
import { KEY_STORE, TOKEN_STORE } from "@/lib/admin/admin-github";
import { localGet, localRemove, localSet } from "@/lib/storage";
import { leadIdOf, leadStoreKey, leadSummary, shootTag, type Lead, type LeadPatch, type LeadSummary } from "@/lib/leads/leads";
import { TodayDesk } from "@/components/leads/today";
import { NewLeadDesk } from "@/components/leads/new-lead";
import { BoardDesk } from "@/components/leads/board";
import { CalendarDesk } from "@/components/leads/calendar";
import { MoneyDesk } from "@/components/leads/money";
import { ASIDE, AsideDesk, LicencesDesk } from "@/components/leads/lists";
import { About, joinParts, Age, Next } from "@/components/leads/row";
import { InvoicesDesk } from "@/components/leads/invoices";
import { PanelDesk, StatsDesk } from "@/components/leads/numbers";
import { DeviceDesk, HoursDesk, TemplatesDesk } from "@/components/leads/setup-panels";
import { type Filter } from "@/lib/leads/lead-desk";
import { ProofsDesk } from "@/components/proofs/desk";
import { Eyebrow, FIND_KEY, FindGlyph, GO, isView, Nav, More, PlusGlyph, Rail, sectionOf, TabBar, type Found, type View } from "@/components/leads/desk-nav";
import { date, OpenLeadPanel } from "@/components/leads/lead-panel";
import { DAY_MS, pacificFormat, WEEK_MS } from "@/lib/time-zone";

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
/** A day from the moment of the swipe or press. */
const dayOn = () => new Date(Date.now() + DAY_MS).toISOString();
const BOARD_STORE = "jg-leads-board";
const stamp = (t: number) => pacificFormat({ weekday: "short", month: "short", day: "numeric" }).format(new Date(t)).toUpperCase().replace(",", "");

/* The palette on a phone: the whole screen, as a sheet, with the list taking what the field leaves. */
const SHEET_CSS = "dialog[data-jg-sheet]{inset:0;margin:0;width:100vw!important;max-width:none!important;height:100dvh!important;max-height:none!important;border:0;border-radius:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}dialog[data-jg-sheet]>*{height:100%;max-height:none!important}";
const PULL = 72; // px of pull, at the top of the page, that refreshes on release

/**
 * Pull down to refresh: the installed phone app has no browser bar to do it. At the top of the page, a pull past
 * PULL px calls `onPull` and bumps the tick, so a page keyed on it remounts and its own fetches (money, visits,
 * galleries) run again. `enabled` is read as each touch starts. Gives the pull distance and the tick.
 */
function usePullRefresh(onPull: () => void, enabled: React.RefObject<boolean>): [number, number] {
  const [tick, setTick] = React.useState(0);
  const [pull, setPull] = React.useState(0);
  React.useEffect(() => {
    let x0 = 0, y0 = -1, d = 0;
    const atTop = (el: Element | null) => { for (; el; el = el.parentElement) if (el.scrollTop > 0) return false; return true; };
    const start = (e: TouchEvent) => {
      d = 0;
      y0 = enabled.current && e.touches.length === 1 && atTop(e.target as Element) ? e.touches[0].clientY : -1;
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
      if (e.type === "touchend" && y0 >= 0 && d > PULL) { onPull(); setTick((t) => t + 1); }
      y0 = -1;
      setPull(0);
    };
    addEventListener("touchstart", start, { passive: true });
    addEventListener("touchmove", move, { passive: true });
    addEventListener("touchend", end);
    addEventListener("touchcancel", end);
    return () => { removeEventListener("touchstart", start); removeEventListener("touchmove", move); removeEventListener("touchend", end); removeEventListener("touchcancel", end); };
  }, [onPull, enabled]);
  return [pull, tick];
}

/** A yes or no kept on this device under `key`. Read on first render, so only for a component that draws nothing on the server. */
function useStoredFlag(key: string): [boolean, (on: boolean) => void] {
  const [on, setOn] = React.useState(() => typeof window !== "undefined" && localGet(key) === "1");
  const set = (next: boolean) => {
    setOn(next);
    localSet(key, next ? "1" : "0");
  };
  return [on, set];
}

/** What the Ctrl or Cmd K palette offers: every lead by name, email, shoot or stage, actions on the open lead, then every page. */
function finderItems(leads: LeadSummary[] | null, openName: string | undefined): Found[] {
  return [
    ...(leads ?? []).filter((l) => !l.trashedAt && l.id).map((l) => ({ id: leadStoreKey(l.id!), label: l.name || l.email, auxiliaryData: { group: "Leads", words: [l.email, l.kind ?? "", l.stage], note: [l.stage, l.when ? pacificFormat({ month: "short", day: "numeric" }).format(new Date(l.when)) : null].filter(Boolean).join(" · ") } })),
    // Actions on the lead that is open, then the ones that need none.
    ...(openName ? [{ id: "do:task", label: `Add a task to ${openName}`, auxiliaryData: { group: "Do", words: ["task", "todo"] } }, { id: "do:invoice", label: `New invoice for ${openName}`, auxiliaryData: { group: "Do", words: ["invoice", "bill"] } }] : []),
    { id: "go:new", label: "New lead", auxiliaryData: { group: "Do", words: ["add", "lead"] } },
    ...GO,
  ];
}

/** Where a lead sits on the home list, or null when it is not open. `at` is when the list loaded. */
const groupAt = (at: number) => (l: LeadSummary): Group | null => {
  if (inFilter(l, "needs")) return "now";
  if (!inFilter(l, "open")) return null;
  if (inFilter(l, "upcoming") && Date.parse(l.when!) < at + WEEK_MS) return "week";
  return "waiting";
};

export function LeadsDesk() {
  const [leads, setLeads] = React.useState<LeadSummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [pick, setPick] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  // The desk opens on Today.
  const [screen, setScreen] = React.useState<View>("today");
  const [fresh, setFresh] = React.useState<Lead | null>(null);
  const [calTab, setCalTab] = React.useState<"bookings" | "availability">("bookings");
  const [asideTab, setAsideTab] = React.useState<Filter>("snoozed");
  // List or Board, kept on this device. The desk draws nothing until mounted (see `mode`), so no hydration gap.
  const [board, setBoard] = useStoredFlag(BOARD_STORE);
  // The gallery a lead's Galleries section opened the Proofs desk on; the side nav opens it on the list.
  const [proofPick, setProofPick] = React.useState<string | null>(null);
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [templatesError, setTemplatesError] = React.useState<string | null>(null);
  // When the list was loaded: groups by date without reading the clock during render.
  const [at, setAt] = React.useState(0);
  // Search and quick actions, on Ctrl or Cmd K.
  const [finding, setFinding] = React.useState(false);
  // What the palette asked the open lead to do (add a task, start an invoice).
  const [ask, setAsk] = React.useState<LeadAsk | null>(null);
  const isPhone = useMediaQuery("(max-width: 760px)");
  // Wide from 1180, an iPad on its side: the rail below is what leaves room for the open lead.
  const isMid = useMediaQuery("(max-width: 1179px)");
  const railed = useMediaQuery("(max-width: 1279px)");
  const size: Size = isPhone ? "phone" : isMid ? "mid" : "wide";

  const load = React.useCallback(() => {
    deskCall<{ leads: LeadSummary[] }>()
      .then((o) => { setLeads(o.leads); setAt(Date.now()); setError(null); })
      .catch((e: unknown) => setError(loadErrorText(e)));
  }, []);
  React.useEffect(load, [load]);
  // The installed app's badge: unread leads not put aside.
  React.useEffect(() => { if (leads) setUnreadBadge(leads.filter((l) => l.unread && !isSetAside(l)).length); }, [leads]);
  React.useEffect(() => {
    deskCall<{ templates: Template[] }>({ path: "/templates" })
      .then((o) => { setTemplates(o.templates); setTemplatesError(null); })
      .catch(() => setTemplatesError("Templates did not load. Saving now would replace them."));
  }, []);
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      setFinding((v) => !v);
    };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, []);
  const openName = leads?.find((l) => l.id === open)?.name;
  const finder = React.useMemo(
    () => createStaticSource<Found>(finderItems(leads, openName), { keywords: (i) => i.auxiliaryData?.words ?? [] }),
    [leads, openName],
  );
  // Astryx follows the site's own light/dark (html[data-theme], dark when unset), so the ink matches the page behind it.
  // Unknown until read: Astryx's root Theme writes data-theme onto <html> itself, so mounting it with a guess would lock that guess in.
  const mode = useSiteThemeRead();

  // Pull down to refresh, never with a lead open, which may hold typing. `tick` remounts the page.
  const pullOk = React.useRef(false);
  const [pull, tick] = usePullRefresh(load, pullOk);

  const words = query.trim().toLowerCase();
  // The home list once per change: open leads that match, each with its group, and each group in its own order.
  const { live, groupOf, rows, grouped } = React.useMemo(() => {
    const live = (leads ?? []).filter((l) => !l.trashedAt);
    const groupOf = groupAt(at);
    const rows = live.filter((l) => matches(l, words)).map((l) => [l, groupOf(l)] as const).filter((r): r is readonly [LeadSummary, Group] => r[1] !== null);
    const grouped = GROUPS.map(([g, name]) => [g, name, rows.filter(([, gg]) => gg === g).map(([l]) => l).sort((a, b) => (g === "week" ? a.when!.localeCompare(b.when!) : b.lastAt.localeCompare(a.lastAt)))] as const);
    return { live, groupOf, rows, grouped };
  }, [leads, at, words]);

  const show = (v: View) => { setScreen(v); setOpen(null); setProofPick(null); };

  if (error === LOCKED)
    return (
      <LockedGate
        retry={() => {
          setError(null);
          load();
        }}
      />
    );

  const needs = rows.filter(([, g]) => g === "now").length;
  const sel = live.find((l) => l.id === pick) ?? rows[0]?.[0];
  const current = live.find((l) => l.id === open);
  const changed = (l: Lead) => setLeads((rs) => rs?.map((r) => (r.email === l.email ? { ...r, ...leadSummary(l), id: r.id } : r)) ?? null);
  /** A swipe or a button here: the same PATCH the lead's own Snooze, Archive and stage buttons send. */
  const act = (l: LeadSummary, body: LeadPatch) =>
    sendLeadPatch(l.id!, body)
      .then(changed)
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
  const asideCount = (leads ?? []).filter((l) => ASIDE.some(([f]) => inFilter(l, f))).length;
  const switcher = (
    <SegmentedControl label="Open or put aside" value={screen === "aside" ? "aside" : "leads"} onChange={(v) => isView(v) && show(v)} layout={size === "wide" ? "hug" : "fill"} size={size === "phone" ? "lg" : "md"}>
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
            ) : grouped.map(([g, name, these]) => {
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
                            <About>{joinParts([l.kind ? shootTag(l.kind) : null, l.stage, l.when ? date(l.when) : null])}</About>
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
        <OpenLeadPanel sel={sel} waiting={groupOf(sel) === "waiting"} open={() => setOpen(sel.id ?? null)} snooze={() => tomorrow(sel)} />
      )}
    />
  );

  // The lead page: its own Astryx layout (components/leads/lead.tsx).
  const lead = current ? (
    <LeadDesk key={current.id} ask={ask} summary={current} initial={fresh?.email === current.email ? fresh : null} onChange={changed} onBack={() => setOpen(null)} reload={load} templates={templates} others={live.filter((o) => o.id !== current.id)} size={size} toProofs={(token) => { show("proofs"); setProofPick(token ?? null); }} />
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
    localRemove(KEY_STORE);
    localRemove(TOKEN_STORE);
    setLeads(null);
    setError(LOCKED);
  };
  const pages: Partial<Record<View, React.ReactNode>> = {
    invoices: <InvoicesDesk leads={live} open={openLead} changed={changed} />,
    licences: <LicencesDesk leads={live} open={openLead} />,
    aside: <AsideDesk leads={leads ?? []} open={openLead} done={() => { setOpen(null); load(); }} tab={asideTab} setTab={setAsideTab} top={switcher} />,
    stats: <StatsDesk />,
    traffic: <PanelDesk which="traffic" />,
    seo: <PanelDesk which="seo" />,
    hours: <HoursDesk />,
    templates: <TemplatesDesk templates={templates} saved={setTemplates} error={templatesError} />,
    device: <DeviceDesk reload={load} signOut={signOut} />,
    more: <More go={show} find={() => setFinding(true)} />,
    proofs: <ProofsDesk embedded key={proofPick ?? ""} initial={proofPick ?? undefined} />,
    money: <MoneyDesk />,
    calendar: <CalendarDesk leads={live.filter((l) => !l.archivedAt)} size={size} open={openLead} tab={calTab} setTab={setCalTab} />,
    new: <NewLeadDesk leads={live} size={size} done={added} open={openLead} cancel={() => show("leads")} />,
    // Today waits for the first list; until then the screen is home.
    today: leads ? <TodayDesk leads={live} size={size} open={openLead} show={() => show("leads")} /> : undefined,
  };
  const page = lead ?? pages[screen] ?? home;
  const section = lead ? null : sectionOf(screen);
  // Leads carries its own Open / Put aside switch under the title; the other groups keep the tab row.
  const shown = section && section[2].length > 1 && section[0] !== "leads" ? (
    <Layout
      height="fill"
      header={<LayoutHeader><TabList value={screen} onChange={(v) => isView(v) && show(v)} hasDivider layout="hug">{section[2].map(([label, v]) => <Tab key={v} value={v} label={label} />)}</TabList></LayoutHeader>}
      content={page}
    />
  ) : page;
  // eslint-disable-next-line react-hooks/refs -- only the touch handlers read it; set after the sign-in return, so no hook can
  pullOk.current = !lead;
  if (!mode) return null;
  // A phone: the pull-to-refresh note, the page, and the tab bar unless a lead brings its own action bar.
  const pullNote = pull > 12 ? (
    <div role="status" style={{ position: "absolute", zIndex: 5, top: "calc(env(safe-area-inset-top) + 10px)", left: 0, right: 0, textAlign: "center", pointerEvents: "none", fontSize: 12, color: "var(--color-text-secondary)", opacity: Math.min(1, pull / PULL) }}>{pull > PULL ? "Release to refresh" : "Pull to refresh"}</div>
  ) : null;
  const phoneShell = (
    <>
      {pullNote}
      <Layout height="fill" content={<React.Fragment key={tick}>{shown}</React.Fragment>} />
      {lead ? null : <div style={frostBar}><TabBar view={screen} go={show} needs={needs} /></div>}
    </>
  );
  return (
    <Theme theme={leadsTheme} mode={mode}>
      {/* The site sets mono capitals everywhere; Astryx sets its own type inside. */}
      {/* The site's capitals are unlayered element rules, so they beat Astryx's layers; this beats them inside the desk. */}
      <style>{`:root [data-astryx-desk][data-astryx-desk] *,:root [data-astryx-desk][data-astryx-desk] ::placeholder{text-transform:none}${FROST_ROOM}${GLASS}${WIN_CSS}${SHEET_CSS}`}</style>
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
          label="Jump to a lead or page, or do something"
          // A phone gets the whole screen, as a sheet.
          {...(size === "phone" ? { "data-jg-sheet": "", maxHeight: "100dvh", footer: <HStack padding={3} hAlign="end"><Button label="Close" variant="secondary" onClick={() => setFinding(false)} /></HStack> } : {})}
          renderItem={(i) => (
            <HStack gap={3} vAlign="center">
              <Text>{i.label}</Text>
              {i.auxiliaryData?.note ? <Text type="supporting" color="secondary" maxLines={1}>{i.auxiliaryData.note}</Text> : null}
            </HStack>
          )}
          onValueChange={(id) => {
            setFinding(false);
            const page = id.slice(3);
            if (id.startsWith("go:")) {
              if (isView(page)) show(page);
            } else if (id.startsWith("do:")) setAsk({ do: id.slice(3) as LeadAsk["do"], n: Date.now() });
            else setOpen(leadIdOf(id));
          }}
        />
        {size === "phone"
          ? phoneShell
          : <Layout height="fill" start={railed
              ? <LayoutPanel width={84} padding={0} hasDivider label="Desk"><Rail needs={needs} view={screen} go={show} /></LayoutPanel>
              : <LayoutPanel width={260} padding={0} label="Desk" /* SideNav draws 260 wide by default; a narrower panel clipped the counts. */><Nav needs={needs} view={screen} go={show} find={() => setFinding(true)} /></LayoutPanel>} content={shown} />}
      </div>
    </Theme>
  );
}
