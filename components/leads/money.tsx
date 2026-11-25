"use client";

/* ── Money on Astryx ──────────────────────────────────────────────
 * His Stripe balance as tiles and what moved it as a table.
 * Read-only /api/money, paged with Show more.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import { Layout, LayoutContent, LayoutHeader, HStack, VStack, StackItem } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Button } from "@astryxdesign/core/Button";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Table } from "@astryxdesign/core/Table";
import { centsLabel, dayLabel } from "@/lib/leads/lead-desk";
import { adminCall } from "@/lib/admin/admin-call";
import { errorText } from "@/lib/utils";
import { StatTile } from "@/components/leads/numbers";
import type { MoneyAnswer, Txn } from "@/lib/leads/money";

/** Stripe's types in his words. */
export const TXN_LABEL: Record<string, string> = {
  charge: "Payment",
  payment: "Payment",
  refund: "Refund",
  payment_refund: "Refund",
  payout: "Payout",
  stripe_fee: "Stripe fee",
  adjustment: "Adjustment",
  dispute: "Dispute",
};

type Row = Txn & Record<string, unknown>;
const kind = (t: Txn) => TXN_LABEL[t.type] ?? t.type.replace(/_/g, " ");

export function MoneyDesk() {
  const [top, setTop] = React.useState<{ available: number; pending: number; test: boolean } | null>(null);
  const [txns, setTxns] = React.useState<Txn[]>([]);
  const [more, setMore] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const page = React.useCallback((after?: string) => {
    adminCall<MoneyAnswer>(`/api/money${after ? `?after=${after}` : ""}`)
      .then((o) => {
        if (o.available !== undefined) setTop({ available: o.available, pending: o.pending ?? 0, test: !!o.test });
        setTxns((t) => (after ? [...t, ...o.txns] : o.txns));
        setMore(o.more);
      })
      .catch((e: unknown) => setErr(errorText(e)))
      .finally(() => setBusy(false));
  }, []);
  React.useEffect(() => page(), [page]);

  return (
    <Layout
      height="fill"
      defaultHasDividers
      header={
        <LayoutHeader>
          <HStack gap={3} vAlign="center">
            <StackItem size="fill">
              <VStack gap={0}>
                <Text type="code" size="xsm" color="secondary" weight="medium">
                  STRIPE{top ? (top.test ? " · TEST MODE" : " · LIVE") : ""}
                </Text>
                <Heading level={1} weight="bold">
                  Money
                </Heading>
              </VStack>
            </StackItem>
            <Button
              label="Refresh"
              variant="ghost"
              size="sm"
              isDisabled={busy}
              onClick={() => {
                setBusy(true);
                setErr(null);
                page();
              }}
            />
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent role="main" label="Money" padding={4}>
          <VStack gap={6}>
            {err && !top ? <Text color="secondary">{err}</Text> : null}
            {!top && !err ? (
              <Text type="code" size="sm" color="secondary">
                Asking Stripe
              </Text>
            ) : null}
            {top?.test ? <Banner status="info" title="Stripe test mode" description="These are test payments." /> : null}
            {top ? (
              <Grid columns={{ minWidth: 180 }} gap={3}>
                <StatTile k="Available" v={centsLabel(top.available)} hint="Ready to pay out" />
                <StatTile k="On the way" v={centsLabel(top.pending)} hint="Not settled yet" />
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
                      { key: "at", header: "Date", renderCell: (t) => dayLabel(t.at) },
                      {
                        key: "type",
                        header: "Type",
                        renderCell: (t) => (
                          <Badge label={kind(t)} variant={t.net < 0 ? "neutral" : t.type === "dispute" ? "error" : "teal"} />
                        ),
                      },
                      {
                        key: "what",
                        header: "What",
                        renderCell: (t) => `${t.what || kind(t)}${t.status === "pending" ? " · on the way" : ""}`,
                      },
                      { key: "fee", header: "Stripe fee", align: "end", renderCell: (t) => (t.fee ? centsLabel(t.fee) : "") },
                      {
                        key: "net",
                        header: "Net",
                        align: "end",
                        renderCell: (t) => (
                          <Text type="code" weight="medium" color={t.net < 0 ? "secondary" : undefined}>
                            {centsLabel(t.net)}
                          </Text>
                        ),
                      },
                    ]}
                  />
                ) : (
                  <Text type="supporting" color="secondary">
                    Nothing yet.
                  </Text>
                )}
                {more ? (
                  <HStack>
                    <Button
                      label={busy ? "Loading" : "Show more"}
                      variant="ghost"
                      size="sm"
                      isDisabled={busy}
                      onClick={() => {
                        setBusy(true);
                        page(txns.at(-1)?.id);
                      }}
                    />
                  </HStack>
                ) : null}
                {err ? (
                  <Text color="secondary" role="alert">
                    {err}
                  </Text>
                ) : null}
                <Text type="supporting" color="secondary">
                  Net is after the Stripe fee. Payouts show as money leaving the balance.
                </Text>
              </VStack>
            ) : null}
          </VStack>
        </LayoutContent>
      }
    />
  );
}
