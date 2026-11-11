"use client";

/* ── the lead desk on Astryx, opt-in ──────────────────────────────
 * Julian (2026-11-09): "use it to redesign leads app", then picked the
 * Leads redesign mock (claude.ai/artifact/9TrLqxf8vV4jU4uWPLZz2W, "yes
 * send it to backend"). Lives at /admin/leads/astryx only, so Astryx's
 * CSS never reaches the site or the classic desk.
 *
 * Home is the table-filter shape: Your move, This week, Waiting on them,
 * with the open lead beside the list when wide. Phone (≤760) gets a tab
 * bar, mid (≤1200) the side nav and a stacked header. The lead page is
 * its own Astryx layout (components/leads/lead-astryx.tsx).
 * ─────────────────────────────────────────────────────────────── */

import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-neutral/theme.css";
import * as React from "react";
import { defineTheme, Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { useMediaQuery } from "@astryxdesign/core/hooks";
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
import { SignIn } from "@/components/admin/admin-leads";
import { LeadAstryx } from "@/components/leads/lead-astryx";
import { ago, inboxCall, loadError, matches, nextStep, pass } from "@/lib/leads/lead-desk";
import type { Template } from "@/lib/leads/lead-crm";
import { TZ } from "@/lib/booking/booking-rules";
import { KEY_STORE, TOKEN_STORE } from "@/lib/admin/admin-github";
import { leadSummary, shootTag, STAGES, type Lead, type LeadPatch, type LeadSummary, type Stage as StageName } from "@/lib/leads/leads";
import { useRouter } from "next/navigation";

type Size = "phone" | "mid" | "wide";
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
const CLASSIC = "/admin/leads";
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
const PlusGlyph = svg(<path d="M12 5v14M5 12h14" />);

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text type="code" size="xsm" color="secondary" weight="medium">{children}</Text>;
}

/** The one next step in teal; money stuck as an error dot; grey when the ball is with them. */
function Next({ l, waiting }: { l: LeadSummary; waiting: boolean }) {
  const bad = l.flags?.includes("stuck") ? "Deposit stuck" : l.flags?.includes("no-deposit") ? "No deposit" : null;
  if (bad) return <Text type="code" size="sm" color="secondary"><StatusDot variant="error" label="Money stuck" /> {bad}</Text>;
  const step = nextStep(l);
  if (!step) return waiting ? <Text type="code" size="sm" color="secondary">Waiting on them</Text> : null;
  return <Text type="code" size="sm" color="accent">{step} →</Text>;
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

function Nav({ needs }: { needs: number }) {
  return (
    <SideNav header={<SideNavHeading heading="Desk" subheading="juliangigola.com" />}>
      <SideNavSection title="Desk" isHeaderHidden>
        <SideNavItem label="Today" icon={HomeGlyph} href={CLASSIC} />
        <SideNavItem label="Leads" icon={InboxGlyph} isSelected endContent={<Text type="code" size="xsm">{needs}</Text>} />
        <SideNavItem label="Calendar" icon={CalendarGlyph} href={`${CLASSIC}?calendar`} />
        <SideNavItem label="Money" href={CLASSIC} />
      </SideNavSection>
      <SideNavSection title="Site">
        <SideNavItem label="Pages and work" href="/admin" />
        <SideNavItem label="Classic desk" href={CLASSIC} />
      </SideNavSection>
    </SideNav>
  );
}

function TabBar() {
  const tabs: [string, React.ComponentType<React.SVGProps<SVGSVGElement>>, string | null][] = [["Today", HomeGlyph, CLASSIC], ["Leads", InboxGlyph, null], ["Calendar", CalendarGlyph, `${CLASSIC}?calendar`], ["More", MoreGlyph, CLASSIC]];
  return (
    <HStack gap={0} paddingBlockEnd={1}>
      {tabs.map(([label, glyph, href]) => (
        <StackItem key={label} size="fill">
          <VStack gap={0} hAlign="center">
            <IconButton label={label} variant="ghost" href={href ?? undefined} icon={<Icon icon={glyph} color={href ? "secondary" : "accent"} />} />
            <Text type="supporting" size="2xs" color={href ? "secondary" : "accent"}>{label}</Text>
          </VStack>
        </StackItem>
      ))}
    </HStack>
  );
}

export function LeadsAstryx() {
  const [leads, setLeads] = React.useState<LeadSummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [pick, setPick] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const [templates, setTemplates] = React.useState<Template[]>([]);
  // When the list was loaded: groups by date without reading the clock during render.
  const [at, setAt] = React.useState(0);
  const router = useRouter();
  const isPhone = useMediaQuery("(max-width: 760px)");
  const isMid = useMediaQuery("(max-width: 1200px)");
  const size: Size = isPhone ? "phone" : isMid ? "mid" : "wide";

  const call = inboxCall;
  const load = React.useCallback(() => {
    call<{ leads: LeadSummary[] }>({ query: "?leads" })
      .then((o) => { setLeads(o.leads); setAt(Date.now()); })
      .catch((e: unknown) => setError(loadError(e)));
  }, [call]);
  React.useEffect(load, [load]);
  React.useEffect(() => {
    call<{ templates: Template[] }>({ query: "?templates" }).then((o) => setTemplates(o.templates)).catch(() => {});
  }, [call]);
  // Astryx follows the site's own light/dark (html[data-theme], dark when unset), so the ink matches the page behind it.
  // Unknown until read: Astryx's root Theme writes data-theme onto <html> itself, so mounting it with a guess would lock that guess in.
  const [mode, setMode] = React.useState<"light" | "dark" | null>(null);
  React.useEffect(() => {
    const read = () => setMode(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    read();
    const watch = new MutationObserver(read);
    watch.observe(document.documentElement, { attributeFilter: ["data-theme"] });
    return () => watch.disconnect();
  }, []);

  if (error === "Not authorized." || error?.startsWith("GitHub did not accept"))
    return (
      <SignIn
        onKey={(k) => {
          if (/^(ghp_|github_pat_)/.test(k)) {
            localStorage.setItem(TOKEN_STORE, k);
            localStorage.removeItem(KEY_STORE);
          } else localStorage.setItem(KEY_STORE, k);
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
      .catch((e: unknown) => { alert(e instanceof Error ? e.message : String(e)); load(); });
  const tomorrow = (l: LeadSummary) => act(l, { snoozeUntil: dayOn() });
  const eyebrow = `${at ? stamp(at) : ""} · ${needs} NEED YOU`;

  const newLead = size === "phone"
    ? <IconButton label="New lead" variant="secondary" href={CLASSIC} icon={<Icon icon={PlusGlyph} />} />
    : <Button label="New lead" variant="secondary" size="sm" href={CLASSIC} icon={<Icon icon={PlusGlyph} />} />;
  const search = <TextInput value={query} onChange={setQuery} label="Find a lead" isLabelHidden placeholder="Name, email, shoot" size="sm" />;
  // Board lives on the classic desk for now.
  const view = (
    <SegmentedControl label="View" value="list" onChange={(v) => v === "board" && router.push(CLASSIC)} size="sm">
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
              {search}
              {view}
              {newLead}
            </HStack>
          ) : (
            <VStack gap={3}>
              <HStack gap={2} vAlign="center"><StackItem size="fill">{title}</StackItem>{newLead}</HStack>
              <HStack gap={3} vAlign="center"><StackItem size="fill">{search}</StackItem>{size === "mid" ? view : null}</HStack>
            </VStack>
          )}
        </LayoutHeader>
      }
      content={
        <LayoutContent role="main" label="Leads">
          <VStack gap={6}>
            {error ? <Text color="secondary">{error}</Text> : null}
            {!leads && !error ? <Eyebrow>LOADING LEADS</Eyebrow> : null}
            {GROUPS.map(([g, name]) => {
              const these = rows.filter(([, gg]) => gg === g).map(([l]) => l).sort((a, b) => (g === "week" ? a.when!.localeCompare(b.when!) : b.lastAt.localeCompare(a.lastAt)));
              if (!these.length) return null;
              return (
                <VStack key={g} gap={1}>
                  <Eyebrow>{name.toUpperCase()} · {these.length}</Eyebrow>
                  <List hasDividers>
                    {these.map((l) => (
                      <ListItem
                        key={l.id}
                        align="first-line"
                        isSelected={size === "wide" && l.id === sel?.id}
                        onClick={() => (size === "wide" ? setPick(l.id ?? null) : setOpen(l.id ?? null))}
                        startContent={<StatusDot variant={l.unread ? "accent" : "neutral"} label={l.unread ? "New" : "Read"} />}
                        label={<HStack gap={2} vAlign="center"><StackItem size="fill"><Text type="large" weight="semibold">{l.name}</Text></StackItem><Text type="code" size="xsm" color="secondary">{ago(l.lastAt)}</Text></HStack>}
                        description={
                          <VStack gap={1}>
                            <Eyebrow>{[l.kind ? shootTag(l.kind)?.toUpperCase() : null, l.when ? date(l.when) : null, l.stage.toUpperCase()].filter(Boolean).join(" · ")}</Eyebrow>
                            {l.snippet ? <Text type="body" color="secondary" maxLines={1}>{l.snippet}</Text> : null}
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
            {leads && !rows.length ? <Text type="supporting">Nothing here.</Text> : null}
          </VStack>
        </LayoutContent>
      }
      end={size !== "wide" || !sel ? undefined : (
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

  // The lead page: its own Astryx layout (components/leads/lead-astryx.tsx).
  const lead = current ? (
    <LeadAstryx key={current.id} summary={current} call={call} onChange={changed} onBack={() => setOpen(null)} reload={load} templates={templates} others={live.filter((o) => o.id !== current.id)} size={size} />
  ) : null;

  const page = lead ?? home;
  if (!mode) return null;
  return (
    <Theme theme={leadsTheme} mode={mode}>
      {/* The site sets mono capitals everywhere; Astryx sets its own type inside. */}
      {/* The site's capitals are unlayered element rules, so they beat Astryx's layers; this beats them inside the desk. */}
      <style>{":root [data-astryx-desk][data-astryx-desk] *,:root [data-astryx-desk][data-astryx-desk] ::placeholder{text-transform:none}"}</style>
      <div data-astryx-desk="" style={{ height: "100dvh", textTransform: "none", letterSpacing: "normal" }}>
        {size === "phone"
          ? <Layout height="fill" content={page} footer={<TabBar />} />
          : <Layout height="fill" start={<Nav needs={needs} />} content={page} />}
      </div>
    </Theme>
  );
}
