"use client";

/* ── Money on Astryx ──────────────────────────────────────────────
 * Julian (2026-11-10) approved the mock (claude.ai/artifact/WWQy2jVbaeTG7sdDKgGmU5,
 * #money): his Stripe balance as tiles and what moved it as a table.
 * Same read-only /api/money as the classic MoneyView
 * (components/leads/money.tsx), paged with Show more.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import { Layout, LayoutContent, LayoutHeader, HStack, VStack, StackItem, Card } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Button } from "@astryxdesign/core/Button";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Table } from "@astryxdesign/core/Table";
import { adminCall, cash, day, errorText } from "@/lib/leads/lead-desk";
import { KIND, type Txn } from "@/components/leads/money";

type Row = Txn & Record<string, unknown>;
const kind = (t: Txn) => KIND[t.type] ?? t.type.replace(/_/g, " ");

export function MoneyAstryx() {
  const [top, setTop] = React.useState<{ available: number; pending: number; test: boolean } | null>(null);
  const [txns, setTxns] = React.useState<Txn[]>([]);
  const [more, setMore] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const page = React.useCallback((after?: string) => {
    adminCall<{ available?: number; pending?: number; test?: boolean; txns: Txn[]; more: boolean }>(`/api/money${after ? `?after=${after}` : ""}`)
      .then((o) => {
        if (o.available !== undefined) setTop({ available: o.available, pending: o.pending ?? 0, test: !!o.test });
        setTxns((t) => (after ? [...t, ...o.txns] : o.txns));
        setMore(o.more);
      })
      .catch((e: unknown) => setErr(errorText(e)))
      .finally(() => setBusy(false));
  }, []);
  React.useEffect(() => page(), [page]);

  const tile = (k: string, v: string, hint: string) => (
    <Card padding={4}>
      <VStack gap={1}>
        <Text type="code" size="xsm" color="secondary" weight="medium">{k.toUpperCase()}</Text>
        <Heading level={2}>{v}</Heading>
        <Text type="code" size="sm" color="secondary">{hint}</Text>
      </VStack>
    </Card>
  );

  return (
    <Layout
      height="fill"
      defaultHasDividers
      header={
        <LayoutHeader>
          <HStack gap={3} vAlign="center">
            <StackItem size="fill"><VStack gap={0}><Text type="code" size="xsm" color="secondary" weight="medium">STRIPE{top ? (top.test ? " · TEST MODE" : " · LIVE") : ""}</Text><Heading level={1} weight="bold">Money</Heading></VStack></StackItem>
            <Button label="Refresh" variant="ghost" size="sm" isDisabled={busy} onClick={() => { setBusy(true); setErr(null); page(); }} />
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent role="main" label="Money">
          <VStack gap={6}>
            {err && !top ? <Text color="secondary">{err}</Text> : null}
            {!top && !err ? <Text type="code" size="sm" color="secondary">Asking Stripe</Text> : null}
            {top?.test ? <Banner status="info" title="Stripe test mode" description="These are test payments." /> : null}
            {top ? (
              <Grid columns={{ minWidth: 180 }} gap={3}>
                {tile("Available", cash(top.available), "Ready to pay out")}
                {tile("On the way", cash(top.pending), "Not settled yet")}
              </Grid>
            ) : null}
            {top ? (
              <VStack gap={2}>
                <Heading level={2}>Transactions</Heading>
                {txns.length ? (
                  <Table<Row>
                    data={txns as Row[]}
                    idKey="id"
                    textOverflow="truncate"
                    columns={[
                      { key: "at", header: "Date", renderCell: (t) => day(t.at) },
                      { key: "type", header: "Type", renderCell: (t) => <Badge label={kind(t)} variant={t.net < 0 ? "neutral" : t.type === "dispute" ? "error" : "teal"} /> },
                      { key: "what", header: "What", renderCell: (t) => `${t.what || kind(t)}${t.status === "pending" ? " · on the way" : ""}` },
                      { key: "fee", header: "Stripe fee", align: "end", renderCell: (t) => (t.fee ? cash(t.fee) : "") },
                      { key: "net", header: "Net", align: "end", renderCell: (t) => <Text type="code" weight="medium" color={t.net < 0 ? "secondary" : undefined}>{cash(t.net)}</Text> },
                    ]}
                  />
                ) : <Text type="supporting" color="secondary">Nothing yet.</Text>}
                {more ? <HStack><Button label={busy ? "Loading" : "Show more"} variant="ghost" size="sm" isDisabled={busy} onClick={() => { setBusy(true); page(txns.at(-1)?.id); }} /></HStack> : null}
                {err ? <Text color="secondary" role="alert">{err}</Text> : null}
                <Text type="supporting" color="secondary">Net is after the Stripe fee. Payouts show as money leaving the balance.</Text>
              </VStack>
            ) : null}
          </VStack>
        </LayoutContent>
      }
    />
  );
}
