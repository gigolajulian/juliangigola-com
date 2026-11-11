"use client";

/* ── Licences and Put aside on Astryx ─────────────────────────────
 * The classic desk's LicenceList (components/leads/lead-licence.tsx) and
 * its Put aside lists (Snoozed, Archived, Trash, Delivered, Lost) as
 * tables. Same filters (`pass` in lib/leads/lead-desk.ts), same Empty
 * trash DELETE, asked twice as before.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import { Layout, LayoutContent, LayoutHeader, HStack, VStack } from "@astryxdesign/core/Layout";
import { Button } from "@astryxdesign/core/Button";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Table } from "@astryxdesign/core/Table";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { endDay } from "@/components/leads/lead-licence";
import { renewDue, type LeadSummary } from "@/lib/leads/leads";
import { type Call, day, errorText, pass, type Filter } from "@/lib/leads/lead-desk";

type Row = LeadSummary & Record<string, unknown>;
export const ASIDE: [Filter, string][] = [["snoozed", "Snoozed"], ["archived", "Archived"], ["trash", "Trash"], ["Delivered", "Delivered"], ["Lost", "Lost"]];

function Page({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <Layout
      height="fill"
      defaultHasDividers
      header={<LayoutHeader><VStack gap={0}><Text type="code" size="xsm" color="secondary" weight="medium">{eyebrow}</Text><Heading level={1} weight="bold">{title}</Heading></VStack></LayoutHeader>}
      content={<LayoutContent role="main" label={title}><VStack gap={4}>{children}</VStack></LayoutContent>}
    />
  );
}

const nameCol = (open: (l: LeadSummary) => void) => ({ key: "name", header: "Lead", renderCell: (l: Row) => <Button label={l.name || l.email} variant="ghost" size="sm" onClick={() => open(l)} /> });

export function LicencesAstryx({ leads, open }: { leads: LeadSummary[]; open: (l: LeadSummary) => void }) {
  const [now] = React.useState(() => Date.now());
  const list = leads.filter((l) => l.licence).sort((a, b) => a.licence!.end.localeCompare(b.licence!.end)) as Row[];
  return (
    <Page eyebrow={`${list.length} ON THE DESK`} title="Licences">
      {list.length ? (
        <Table<Row>
          data={list}
          idKey="id"
          textOverflow="truncate"
          columns={[
            nameCol(open),
            { key: "use", header: "Use", renderCell: (l) => l.licence?.use || "Licence" },
            { key: "end", header: "Ends", renderCell: (l) => (renewDue(l, now) ? <Badge label={`Renew · ${endDay(l.licence!.end)}`} variant="teal" /> : endDay(l.licence!.end)) },
          ]}
        />
      ) : <Text color="secondary">No licences yet. Add one under Money on a lead.</Text>}
    </Page>
  );
}

export function AsideAstryx({ leads, call, open, done, tab, setTab }: { leads: LeadSummary[]; call: Call; open: (l: LeadSummary) => void; done: () => void; tab: Filter; setTab: (f: Filter) => void }) {
  const [sure, setSure] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const rows = leads.filter((l) => pass(l, tab)) as Row[];
  const empty = () => {
    setBusy(true);
    call({ method: "DELETE", body: JSON.stringify({ emptyTrash: true }) })
      .then(done)
      .catch((e: unknown) => setNote(errorText(e)))
      .finally(() => { setBusy(false); setSure(false); });
  };
  return (
    <Page eyebrow="OUT OF THE WAY" title="Put aside">
      <TabList value={tab} onChange={(v) => { setTab(v as Filter); setSure(false); }} hasDivider layout="hug">
        {ASIDE.map(([f, label]) => <Tab key={f} value={f} label={`${label} · ${leads.filter((l) => pass(l, f)).length}`} />)}
      </TabList>
      {tab === "trash" && rows.length ? (
        sure ? (
          <Banner status="error" title={`Delete ${rows.length} for good?`} description="This cannot be undone."
            endContent={<HStack gap={2}><Button label="Delete for good" variant="destructive" size="sm" isDisabled={busy} onClick={empty} /><Button label="Cancel" variant="ghost" size="sm" onClick={() => setSure(false)} /></HStack>} />
        ) : <HStack><Button label="Empty trash" variant="secondary" size="sm" onClick={() => setSure(true)} /></HStack>
      ) : null}
      {note ? <Text color="secondary" role="alert">{note}</Text> : null}
      {rows.length ? (
        <Table<Row>
          data={rows}
          idKey="id"
          textOverflow="truncate"
          columns={[
            nameCol(open),
            { key: "stage", header: "Stage", renderCell: (l) => l.stage },
            { key: "kind", header: "Shoot", renderCell: (l) => l.kind ?? "" },
            { key: "when", header: tab === "snoozed" ? "Back on" : "Last heard", renderCell: (l) => day(tab === "snoozed" && l.snoozeUntil ? l.snoozeUntil : l.lastAt) },
          ]}
        />
      ) : <Text color="secondary">No leads here.</Text>}
    </Page>
  );
}
