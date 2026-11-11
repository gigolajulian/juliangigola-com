"use client";

/* ── Stats, Traffic and SEO on Astryx ─────────────────────────────
 * Stats is the classic StatsView (components/leads/stats.tsx) rebuilt:
 * same `?stats` read, tiles, 12 weeks of bars, sources, lost reasons,
 * stages. Traffic and SEO are the shared /admin panels, loaded lazily
 * inside an Astryx page: /admin uses them too, so they stay one copy.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import { Layout, LayoutContent, LayoutHeader, VStack, Card } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading, Text } from "@astryxdesign/core/Text";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { STAGES } from "@/lib/leads/leads";
import type { Stats } from "@/lib/leads/lead-crm";
import { type Call, errorText, money } from "@/lib/leads/lead-desk";

const AdminTraffic = React.lazy(() => import("@/components/admin/admin-traffic").then((m) => ({ default: m.AdminTraffic })));
const AdminSeo = React.lazy(() => import("@/components/admin/admin-seo").then((m) => ({ default: m.AdminSeo })));
const hours = (h: number | null) => (h === null ? "None yet" : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} d`);

function Page({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <Layout
      height="fill"
      defaultHasDividers
      header={<LayoutHeader><VStack gap={0}><Text type="code" size="xsm" color="secondary" weight="medium">{eyebrow}</Text><Heading level={1} weight="bold">{title}</Heading></VStack></LayoutHeader>}
      content={<LayoutContent role="main" label={title} padding={4}>{children}</LayoutContent>}
    />
  );
}

export function StatsAstryx({ call }: { call: Call }) {
  const [s, setS] = React.useState<Stats | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => {
    call<{ stats: Stats }>({ query: "?stats" }).then((o) => setS(o.stats)).catch((e: unknown) => setErr(errorText(e)));
  }, [call]);
  const tile = (k: string, v: string, hint: string) => (
    <Card padding={4}>
      <VStack gap={1}>
        <Text type="code" size="xsm" color="secondary" weight="medium">{k.toUpperCase()}</Text>
        <Heading level={2}>{v}</Heading>
        <Text type="code" size="sm" color="secondary">{hint}</Text>
      </VStack>
    </Card>
  );
  const top = s ? Math.max(1, ...s.weeks.map((w) => w.inquiries)) : 1;
  return (
    <Page eyebrow={s ? `${s.total} LEADS` : "THE NUMBERS"} title="Stats">
      {err ? <Text color="secondary">{err}</Text> : !s ? <Text type="code" size="sm" color="secondary">Counting</Text> : (
        <VStack gap={6} maxWidth={760}>
          <Grid columns={{ minWidth: 160 }} gap={3}>
            {tile("Booked", s.bookedRate === null ? "None yet" : `${Math.round(s.bookedRate * 100)}%`, "of leads over a week old")}
            {tile("First reply", hours(s.replyHours), "median, inquiry to answer")}
            {tile("Quoted, open", money(s.pipeline), "waiting on an answer")}
            {tile("Booked value", money(s.won), "from the quotes you entered")}
          </Grid>
          <VStack gap={2}>
            <Heading level={2}>Last 12 weeks</Heading>
            <div role="img" aria-label={s.weeks.map((w) => `Week of ${w.start}: ${w.inquiries} inquiries, ${w.booked} booked`).join(". ")} style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 128 }}>
              {s.weeks.map((w) => (
                <div key={w.start} title={`Week of ${w.start}: ${w.inquiries} in, ${w.booked} booked`} style={{ position: "relative", flex: 1, height: "100%", display: "flex", alignItems: "flex-end" }}>
                  <div style={{ width: "100%", height: `${(w.inquiries / top) * 100}%`, borderRadius: "3px 3px 0 0", background: "var(--color-border, currentColor)", opacity: 0.5 }} />
                  <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${(Math.min(w.booked, w.inquiries || w.booked) / top) * 100}%`, borderRadius: "3px 3px 0 0", background: "var(--color-accent)" }} />
                </div>
              ))}
            </div>
            <Text type="code" size="sm" color="secondary">Grey: inquiries. Teal: booked.</Text>
          </VStack>
          <VStack gap={2}>
            <Heading level={2}>Where they came from</Heading>
            {s.sources.length ? <MetadataList>{s.sources.map((r) => <MetadataListItem key={r.source} label={r.source}>{r.leads} in · {r.booked} booked</MetadataListItem>)}</MetadataList> : <Text color="secondary">Nothing yet.</Text>}
          </VStack>
          <VStack gap={2}>
            <Heading level={2}>Why they were lost</Heading>
            {s.lost.length ? <MetadataList>{s.lost.map((r) => <MetadataListItem key={r.reason} label={r.reason}>{r.n}</MetadataListItem>)}</MetadataList> : <Text color="secondary">None lost.</Text>}
          </VStack>
          <VStack gap={2}>
            <Heading level={2}>By stage</Heading>
            <MetadataList>{STAGES.map((st) => <MetadataListItem key={st} label={st}>{s.stages[st] ?? 0}</MetadataListItem>)}</MetadataList>
          </VStack>
        </VStack>
      )}
    </Page>
  );
}

/** A shared /admin panel inside the desk. */
export function PanelAstryx({ which }: { which: "traffic" | "seo" }) {
  return (
    <Page eyebrow={which === "traffic" ? "CLOUDFLARE" : "SEARCH"} title={which === "traffic" ? "Traffic" : "SEO"}>
      <React.Suspense fallback={<Text type="code" size="sm" color="secondary">Loading</Text>}>{which === "traffic" ? <AdminTraffic /> : <AdminSeo />}</React.Suspense>
    </Page>
  );
}
