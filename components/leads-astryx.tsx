"use client";

/* ── the lead desk on Astryx, opt-in ──────────────────────────────
 * Julian (2026-11-09): "use it to redesign leads app", mock
 * claude.ai/artifact/Uv3UowadawaAyqXktnftFY, then "build it". Lives at
 * /admin/leads/astryx only, so Astryx's CSS never reaches the site or
 * the classic desk. Today is new: sidebar, three tiles, search, three
 * lists and the open lead. The open lead itself is still the classic
 * Detail, and every other page links back to the classic desk.
 * ─────────────────────────────────────────────────────────────── */

import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-neutral/theme.css";
import * as React from "react";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { Layout, LayoutContent, LayoutPanel } from "@astryxdesign/core/Layout";
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { Button } from "@astryxdesign/core/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { Avatar } from "@astryxdesign/core/Avatar";
import { List, ListItem } from "@astryxdesign/core/List";
import { Heading, Text } from "@astryxdesign/core/Text";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Card } from "@astryxdesign/core/Card";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { credentials, KEY_STORE } from "@/components/admin-inbox";
import { ago, Detail, matches, money, nextStep, OFFLINE, pass, SignIn, type Filter } from "@/components/admin-leads";
import { TOKEN_STORE } from "@/lib/admin-github";
import { leadSummary, shootTag, type Lead, type LeadSummary } from "@/lib/leads";

type Call = (init?: RequestInit & { query?: string }) => Promise<Record<string, unknown>>;
type Template = React.ComponentProps<typeof Detail>["templates"][number];

const LISTS: [Filter, string][] = [["needs", "Waiting on me"], ["open", "All open"], ["snoozed", "Later"]];
const CLASSIC = "/admin/leads";
const when = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
const today = () => new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "long", month: "long", day: "numeric" }).format(new Date());

function Tile({ k, v }: { k: string; v: string }) {
  return (
    <Card variant="muted" padding={3} width="100%">
      <VStack gap={1}>
        <Text type="supporting">{k}</Text>
        <Text type="large" weight="semibold" hasTabularNumbers>{v}</Text>
      </VStack>
    </Card>
  );
}

export function LeadsAstryx() {
  const [leads, setLeads] = React.useState<LeadSummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [list, setList] = React.useState<Filter>("needs");
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState<string | null>(null);
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [stripe, setStripe] = React.useState<number | null>(null);
  const [wide, setWide] = React.useState(false);

  const call: Call = React.useCallback(async (init = {}) => {
    const res = await fetch(`/api/inbox${init.query ?? ""}`, {
      ...init,
      headers: { ...credentials(localStorage.getItem(KEY_STORE) ?? ""), "content-type": "application/json" },
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
    // The second tile: what Stripe holds. Quiet when Stripe is not connected.
    fetch("/api/money", { headers: credentials(localStorage.getItem(KEY_STORE) ?? ""), cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((o: { available?: number } | null) => o?.available !== undefined && setStripe(o.available))
      .catch(() => {});
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
  React.useEffect(() => {
    const mq = matchMedia("(min-width: 1024px)");
    const set = () => setWide(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
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
  const count = (f: Filter) => live.filter((l) => pass(l, f)).length;
  const needs = count("needs");
  const words = query.trim().toLowerCase();
  const shown = live.filter((l) => pass(l, list) && matches(l, words)).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  const owed = live.filter((l) => l.stage === "Invoiced" && !l.paid).reduce((s, l) => s + (l.quote ?? 0), 0);
  const calls = live.filter((l) => pass(l, "upcoming")).sort((a, b) => a.when!.localeCompare(b.when!));
  const current = live.find((l) => l.id === open);
  const changed = (l: Lead) => setLeads((rows) => rows?.map((r) => (r.email === l.email ? { ...r, ...leadSummary(l), id: r.id } : r)) ?? null);
  /** A swipe on a row: the same PATCH the lead's own Snooze and Archive buttons send. */
  const act = (l: LeadSummary, body: Record<string, unknown>) =>
    call({ method: "PATCH", body: JSON.stringify({ key: `lead:${l.id}`, ...body }) })
      .then((o) => changed(o.lead as Lead))
      .catch((e: unknown) => { alert(e instanceof Error ? e.message : String(e)); load(); });

  const nav = (
    <SideNav header={<SideNavHeading heading="Leads" subheading="Julian Gigola" />} topContent={<Button label="New lead" variant="primary" width="100%" href={CLASSIC} />}>
      <SideNavSection title="Desk" isHeaderHidden>
        <SideNavItem label="Today" isSelected endContent={needs ? <Badge label={String(needs)} variant="blue" /> : undefined} />
        <SideNavItem label="Leads" href={CLASSIC} endContent={<Text type="supporting" hasTabularNumbers>{count("open")}</Text>} />
        <SideNavItem label="Calendar" href={`${CLASSIC}?calendar`} />
        <SideNavItem label="Money" href={CLASSIC} />
        <SideNavItem label="Proofs" href={CLASSIC} />
      </SideNavSection>
      <SideNavSection title="Setup" isHeaderHidden>
        <SideNavItem label="Classic desk" href={CLASSIC} />
      </SideNavSection>
    </SideNav>
  );

  const today_ = (
    <VStack gap={4}>
      <VStack gap={1}>
        <Text type="supporting">{today()}</Text>
        <Heading level={1}>{leads ? (needs ? `${needs} waiting on you` : "Nothing waiting on you") : "Loading leads"}</Heading>
      </VStack>
      {error ? <Text color="secondary">{error}</Text> : null}
      <HStack gap={wide ? 3 : 2}>
        <Tile k="Owed" v={money(owed)} />
        <Tile k="In Stripe" v={stripe === null ? "–" : money(stripe / 100)} />
        <Tile k="Next call" v={calls[0] ? when(calls[0].when!) : "None"} />
      </HStack>
      <TextInput label="Search leads" isLabelHidden placeholder="Search name, email or message" value={query} onChange={setQuery} />
      <TabList value={list} onChange={(v) => setList(v as Filter)} hasDivider layout={wide ? "hug" : "fill"}>
        {LISTS.map(([f, t]) => <Tab key={f} value={f} label={t} />)}
      </TabList>
      <List hasDividers edge="outset">
        {shown.map((l) => {
          const step = nextStep(l);
          return (
            <ListItem
              key={l.id}
              isSelected={l.id === open}
              onClick={() => setOpen(l.id ?? null)}
              startContent={<Avatar name={l.name} size="sm" tooltip={false} />}
              label={<HStack gap={1.5} vAlign="center"><Text weight={l.unread ? "semibold" : "medium"}>{l.name}</Text>{l.unread ? <StatusDot variant="accent" label="Unread" /> : null}</HStack>}
              description={[l.kind ? shootTag(l.kind) : null, l.stage, ago(l.lastAt)].filter(Boolean).join(" · ")}
              endContent={step ? <Badge label={step} variant="blue" /> : undefined}
              // Julian: swipe on the iPhone. Right: later, a day; left: archive.
              swipeActions={{
                leading: [{ id: "later", label: "Tomorrow", variant: "neutral", hasRemoval: list !== "snoozed", onActivate: () => act(l, { snoozeUntil: new Date(Date.now() + 864e5).toISOString() }) }],
                trailing: [{ id: "archive", label: "Archived", variant: "accent", hasRemoval: true, onActivate: () => act(l, { archive: true }) }],
              }}
            />
          );
        })}
      </List>
      {leads && !shown.length ? <Text type="supporting">Nothing here.</Text> : null}
    </VStack>
  );

  const detail = current ? (
    <Detail key={current.id} summary={current} call={call} onChange={changed} onBack={() => setOpen(null)} reload={load} tick={0} templates={templates} others={live.filter((o) => o.id !== current.id)} />
  ) : null;

  if (!mode) return null;
  return (
    <Theme theme={neutralTheme} mode={mode}>
      {/* The site sets mono capitals everywhere; Astryx sets its own type here, in the site's text face. */}
      <div data-astryx-desk="" style={{ height: wide ? "calc(100dvh - 48px)" : undefined, textTransform: "none", letterSpacing: "normal", ["--font-family-body" as string]: 'var(--font-v2-text, "Helvetica Neue", Helvetica, Arial, sans-serif)' }}>
        {wide ? (
          <Layout
            height="fill"
            start={nav}
            content={<LayoutContent padding={6} label="Leads">{today_}</LayoutContent>}
            end={<LayoutPanel width={480} padding={6} hasDivider label="Lead">{detail ?? <Text type="supporting">Pick a lead to see it here.</Text>}</LayoutPanel>}
          />
        ) : (
          <VStack gap={4}>{detail ?? today_}</VStack>
        )}
      </div>
    </Theme>
  );
}
