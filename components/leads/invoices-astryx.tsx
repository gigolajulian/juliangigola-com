"use client";

/* ── Money > Invoices on Astryx ───────────────────────────────────
 * Every invoice across leads, from `/api/inbox?invoices` (invoices live
 * on full leads, never in the list's summaries). Paid by `isPaid`, Sent
 * when the Gmail sync saw hello@ mail it. New invoice picks the lead and
 * opens the same design B sheet the lead page uses (InvoiceSheetB), whose
 * page sits beside the form once the content is 760 wide.
 * ─────────────────────────────────────────────────────────────── */

import * as React from "react";
import { HStack, StackItem, Card, VStack } from "@astryxdesign/core/Layout";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { Selector } from "@astryxdesign/core/Selector";
import { Table } from "@astryxdesign/core/Table";
import { Page } from "@/components/leads/lists-astryx";
import { Deliver, InvoiceSheetB, makePdf } from "@/components/leads/invoice";
import { kindOf } from "@/components/leads/shared";
import { balance, isPaid, subtotal, usd, type Invoice } from "@/lib/leads/invoice";
import { type Call, day, errorText, type Patch } from "@/lib/leads/lead-desk";
import type { Lead, LeadSummary } from "@/lib/leads/leads";

/** One invoice as `?invoices` answers it: the invoice, its lead's id and name. */
export type InvoiceRow = Invoice & { lead: string; name: string };
type Row = InvoiceRow & Record<string, unknown>;

export const status = (i: Invoice) => (isPaid(i) ? "Paid" : i.sentAt ? "Sent" : "Unpaid");

export function InvoicesAstryx({ leads, call, open, changed }: { leads: LeadSummary[]; call: Call; open: (l: LeadSummary) => void; changed: (l: Lead) => void }) {
  const [rows, setRows] = React.useState<InvoiceRow[] | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [made, setMade] = React.useState<{ inv: Invoice; l: LeadSummary; file: File } | null>(null);
  // null: the table. "": picking the lead. An id: that lead's sheet, once `full` is in.
  const [making, setMaking] = React.useState<string | null>(null);
  const [full, setFull] = React.useState<Lead | null>(null);
  const load = React.useCallback(() => {
    call<{ invoices: InvoiceRow[] }>({ query: "?invoices" }).then((o) => setRows(o.invoices)).catch((e: unknown) => setNote(errorText(e)));
  }, [call]);
  React.useEffect(load, [load]);

  const byId = (id: string) => leads.find((l) => l.id === id);
  const lead = (id: string) => call<{ lead: Lead }>({ query: `?key=${encodeURIComponent(`lead:${id}`)}` }).then((o) => o.lead);
  const pdf = (r: InvoiceRow) => {
    const l = byId(r.lead);
    if (!l) return;
    setNote(null);
    lead(r.lead).then((f) => makePdf(r, l, f)).then((file) => setMade({ inv: r, l, file }), (e: unknown) => setNote(errorText(e)));
  };
  const pick = (id: string) => {
    setMaking(id);
    setFull(null);
    lead(id).then(setFull, (e: unknown) => setNote(errorText(e)));
  };
  const patch: Patch = async (body) => {
    const { lead: next } = await call<{ lead: Lead }>({ method: "PATCH", body: JSON.stringify({ key: `lead:${making}`, ...body }) });
    setFull(next);
    changed(next);
    return next;
  };

  const owed = (rows ?? []).filter((r) => !isPaid(r)).reduce((n, r) => n + balance(r), 0);
  const picked = making ? byId(making) : undefined;
  return (
    <Page eyebrow={rows ? `${rows.length} ON THE DESK · ${usd(owed)} UNPAID` : "LOADING"} title="Invoices">
      {making === null ? <HStack><Button label="New invoice" variant="secondary" size="sm" onClick={() => setMaking("")} /></HStack> : null}
      {making === "" ? (
        <HStack gap={2} vAlign="end">
          <StackItem size="fill">
            <Selector label="Who is it for" hasSearch placeholder="Pick a lead" value={null as never} onChange={pick}
              options={leads.filter((l) => l.id).map((l) => ({ value: l.id!, label: l.name || l.email, description: [kindOf(l.kind), l.stage].filter(Boolean).join(" · ") }))} />
          </StackItem>
          <Button label="Cancel" variant="ghost" size="sm" onClick={() => setMaking(null)} />
        </HStack>
      ) : null}
      {making && picked ? (
        full ? <InvoiceSheetB l={picked} full={full} patch={patch} done={() => { setMaking(null); load(); }} /> : <Text color="secondary">Opening {picked.name}</Text>
      ) : null}
      {made ? (
        <Card padding={4}>
          <VStack gap={3}>
            <HStack vAlign="center"><StackItem size="fill"><Text weight="semibold">Invoice {made.inv.no}, {made.l.name}</Text></StackItem><Button label="Close" variant="ghost" size="sm" onClick={() => setMade(null)} /></HStack>
            <Deliver file={made.file} inv={made.inv} l={made.l} />
          </VStack>
        </Card>
      ) : null}
      {note ? <Text color="secondary" role="alert">{note}</Text> : null}
      {rows?.length ? (
        <Table<Row>
          data={rows as Row[]}
          idKey="no"
          textOverflow="truncate"
          columns={[
            { key: "no", header: "No.", renderCell: (r) => <Text type="code">{r.no}</Text> },
            { key: "name", header: "Client", renderCell: (r) => r.name },
            { key: "shoot", header: "Shoot", renderCell: (r) => kindOf(byId(r.lead)?.kind) ?? "" },
            { key: "date", header: "Date", renderCell: (r) => day(`${r.date}T12:00:00`) },
            { key: "total", header: "Total", renderCell: (r) => <Text type="code">{usd(subtotal(r.lines))}</Text> },
            { key: "balance", header: "Balance", renderCell: (r) => <Text type="code">{usd(balance(r))}</Text> },
            { key: "status", header: "Status", renderCell: (r) => <Badge label={status(r)} variant={status(r) === "Paid" ? "success" : status(r) === "Sent" ? "blue" : "neutral"} /> },
            {
              key: "do", header: "", renderCell: (r) => (
                <HStack gap={1}>
                  <Button label="PDF" variant="ghost" size="sm" isDisabled={!byId(r.lead)} onClick={() => pdf(r)} />
                  <Button label="Open" variant="ghost" size="sm" isDisabled={!byId(r.lead)} onClick={() => open(byId(r.lead)!)} />
                </HStack>
              ),
            },
          ]}
        />
      ) : rows ? <Text color="secondary">No invoices yet. New invoice makes one from a lead.</Text> : null}
    </Page>
  );
}
