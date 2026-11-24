import * as React from "react";
import type { SearchableItem } from "@astryxdesign/core/Typeahead";
import { Layout, LayoutContent, LayoutHeader, VStack } from "@astryxdesign/core/Layout";
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { frostBar, glyph } from "@/components/leads/shared";

/** Every page of the desk. */
export type View = "today" | "leads" | "new" | "calendar" | "money" | "invoices" | "licences" | "aside" | "stats" | "traffic" | "seo" | "hours" | "templates" | "device" | "more" | "proofs";
/** One nav item per group, each with an icon; a group with more than one page gets a tab row on top. */
export const SECTIONS: [View, string, [string, View][]][] = [
  ["leads", "Leads", [["Open", "leads"], ["Put aside", "aside"]]],
  ["calendar", "Calendar", [["Calendar", "calendar"], ["Hours", "hours"]]],
  ["money", "Money", [["Stripe", "money"], ["Invoices", "invoices"], ["Licences", "licences"]]],
  ["stats", "Numbers", [["Stats", "stats"], ["Traffic", "traffic"], ["SEO", "seo"]]],
  ["templates", "Settings", [["Templates", "templates"], ["This device", "device"]]],
  ["proofs", "Proofs", [["Galleries", "proofs"]]],
];
export const sectionOf = (v: View) => SECTIONS.find(([, , pages]) => pages.some(([, p]) => p === v));

export const HomeGlyph = glyph(<path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z" />);
export const InboxGlyph = glyph(<><path d="M4 13l3-8h10l3 8v6H4z" /><path d="M4 13h5l1 2h4l1-2h5" /></>);
export const CalendarGlyph = glyph(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>);
export const MoreGlyph = glyph(<><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></>);
export const MoneyGlyph = glyph(<><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>);
export const PlusGlyph = glyph(<path d="M12 5v14M5 12h14" />);
export const ChartGlyph = glyph(<path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />);
export const GearGlyph = glyph(<><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></>);
export const PhotoGlyph = glyph(<><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M20 16l-5-5-8 8" /></>);
export const FindGlyph = glyph(<><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>);
export const SiteGlyph = glyph(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11" /></>);
export const GLYPH: Partial<Record<View, React.ComponentType<React.SVGProps<SVGSVGElement>>>> = { proofs: PhotoGlyph, leads: InboxGlyph, calendar: CalendarGlyph, money: MoneyGlyph, stats: ChartGlyph, templates: GearGlyph };
/** Out of the desk: the site editor. */
export const LINKS: [string, string, React.ComponentType<React.SVGProps<SVGSVGElement>>][] = [["Pages and work", "/admin", SiteGlyph]];

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text type="code" size="xsm" color="secondary" weight="medium">{children}</Text>;
}

/* The side nav in the order of the work: what to do, what it earns, how it is set up. */
const NAV: [string, View[]][] = [["Work", ["leads", "calendar", "proofs"]], ["Business", ["money", "stats"]], ["Setup", ["templates"]]];
export const FIND_KEY = () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "\u2318K" : "Ctrl K");
export type Found = SearchableItem<{ group: string; words?: string[]; note?: string }>;
export const GO: Found[] = [["today", "Today"], ...SECTIONS.map(([to, label]): [View, string] => [to, label])].map(([to, label]) => ({ id: `go:${to}`, label, auxiliaryData: { group: "Go to" } }));

export function Nav({ needs, view, go, find }: { needs: number; view: View; go: (v: View) => void; find: () => void }) {
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
export function More({ go, find }: { go: (v: View) => void; find: () => void }) {
  return (
    <Layout
      height="fill"
      header={<LayoutHeader><Heading level={1} weight="bold">More</Heading></LayoutHeader>}
      content={
        <LayoutContent role="main" label="More" padding={4}>
          <VStack gap={5}>
            <List hasDividers>
              <ListItem label="Jump or do" description="Find a lead or page, add a task, start an invoice" startContent={<Icon icon={FindGlyph} color="secondary" />} onClick={find} />
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
const tabPill = (on: boolean): React.CSSProperties => ({ position: "relative", width: 60, height: 30, borderRadius: 15, display: "grid", placeItems: "center", background: on ? "color-mix(in oklch, var(--color-accent) 20%, transparent)" : "transparent" });
const tabCount: React.CSSProperties = { position: "absolute", top: -4, insetInlineEnd: 2 };

export function TabBar({ view, go, needs }: { view: View; go: (v: View) => void; needs: number }) {
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

export function Rail({ needs, view, go }: { needs: number; view: View; go: (v: View) => void }) {
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
