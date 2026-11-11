"use client";

import * as React from "react";
import { PAPER, paperDue, type Lead, type LeadSummary, type Paper } from "@/lib/leads/leads";
import { cn } from "@/lib/utils";
import { LicenceField } from "@/components/leads/lead-licence";
import { DEPOSIT, usd } from "@/lib/leads/invoice";
import { adminCall, cash, day, errorText, now, type Patch } from "@/lib/leads/lead-desk";
import { btn, field, fieldLabel, HEAD, primary } from "@/components/leads/shared";
import { InvoiceRow, InvoiceSheetB } from "@/components/leads/invoice";

/* ── money on a lead: the quote, the deposit, the balance, its invoices ──
 * Julian (2026-11-06, Leads plan B1 and A1). One block in place of a bare
 * quote field, a deposit row and a red Stripe button. */

const LOST_REASONS = ["Price", "Dates", "No reply", "Went elsewhere", "Not a fit", "Other"];
const ledger = "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-[15px] tabular-nums";
const dt = "font-mono text-[13px] leading-6 text-muted-foreground";
const dd = "text-right font-mono text-[14px] leading-6";

/** A shape per paperwork status, so it never relies on color alone. */
const DOT: Record<Paper, string> = { "Not sent": "○", Sent: "◐", Signed: "●", "Not needed": "–" };

/** "Paperwork: Contract ● · Release ●", from Confirmed on. A tap moves a dot to its next status. */
export function Paperwork({ l, patch }: { l: LeadSummary; patch: Patch }) {
  const due = paperDue(l, now());
  return (
    <p className="flex flex-wrap items-center gap-x-1 font-mono text-[13px] text-muted-foreground">
      Paperwork:
      {(["contract", "release"] as const).map((k, i) => {
        const v = l[k] ?? "Not sent";
        const name = k === "contract" ? "Contract" : "Release";
        return (
          <span key={k} className="inline-flex items-center whitespace-nowrap">
            {i ? <span aria-hidden="true">·</span> : null}
            <button
              type="button"
              title={v}
              aria-label={`${name}: ${v}. Change`}
              onClick={() => patch({ [k]: PAPER[(PAPER.indexOf(v) + 1) % PAPER.length] }).catch((e) => console.error("paperwork", e))}
              className={cn("inline-flex min-h-11 items-center gap-1.5 px-1.5", due === k ? "text-accent" : v === "Signed" ? "text-foreground" : "")}
            >
              {name} <span aria-hidden="true">{DOT[v]}</span>
            </button>
          </span>
        );
      })}
    </p>
  );
}

export function Money({ l, full, patch, run, quote, setQuote }: { l: LeadSummary; full: Lead | null; patch: Patch; run: (p: Promise<unknown>, ok?: string) => void; quote: string | null; setQuote: (v: string | null) => void }) {
  const [making, setMaking] = React.useState(false);
  const paidAt = full?.deposit ? full.events.find((e) => e.kind === "booking")?.at : undefined;
  const q = full?.quote;
  const owed = q !== undefined ? q - (full?.deposit ? DEPOSIT : 0) : undefined;
  return (
    <section className="grid gap-3">
      <h3 aria-level={2} className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Money</h3>
      <div className="flex flex-wrap items-end gap-2.5">
        <label className={fieldLabel}>
          Quote in dollars
          <input
            inputMode="decimal"
            value={quote ?? (q !== undefined ? String(q) : "")}
            onChange={(e) => setQuote(e.target.value.replace(/[^\d.]/g, ""))}
            onBlur={() => {
              if (quote === null) return;
              const n = quote === "" ? null : Number(quote);
              if (n === null || Number.isFinite(n)) run(patch({ quote: n }), "Quote saved.");
            }}
            placeholder="0"
            className={cn(field, "w-40 font-mono")}
          />
        </label>
        {l.stage === "Lost" ? (
          <label className={fieldLabel}>
            Why it was lost
            <select value={full?.lostReason ?? ""} onChange={(e) => run(patch({ lostReason: e.target.value }), "Saved.")} className={cn(field, "w-auto")}>
              <option value="">Pick one</option>
              {LOST_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      <LicenceField key={full?.licence?.end ?? ""} full={full} patch={patch} run={run} cls={{ btn, field, label: fieldLabel }} />
      <dl className={ledger}>
        <dt className={dt}>{paidAt ? `Deposit, ${day(paidAt)}` : "Deposit"}</dt>
        <dd className={dd}>
          {full?.deposit ? <a href={full.deposit} target="_blank" rel="noreferrer" className="text-accent" aria-label={`${usd(DEPOSIT)} paid, open in Stripe`}>{usd(DEPOSIT)} paid</a> : <span className="text-muted-foreground">None</span>}
        </dd>
        {owed !== undefined ? (<><dt className={dt}>Balance</dt><dd className={cn(dd, "font-medium text-accent")}>{usd(owed)}</dd></>) : null}
      </dl>
      {full?.invoices?.length ? (
        <ul className="grid">
          {[...full.invoices].reverse().map((inv) => <InvoiceRow key={inv.no} inv={inv} l={l} full={full} />)}
        </ul>
      ) : null}
      {making && full ? (
        <InvoiceSheetB l={l} full={full} patch={patch} done={() => setMaking(false)} />
      ) : (
        <button type="button" onClick={() => setMaking(true)} disabled={!full} className={cn(btn, primary, "justify-self-start")}>Make invoice</button>
      )}
    </section>
  );
}

/* ── Money: his Stripe balance and what moved it ──────────────────
 * Julian (2026-11-06): "add my stripe balance too and show the
 * transactions in there". Read-only, through `/api/money`. */

type Txn = { id: string; at: string; type: string; amount: number; fee: number; net: number; currency: string; status: string; what: string };
/** Stripe's types in his words. */
const KIND: Record<string, string> = { charge: "Payment", payment: "Payment", refund: "Refund", payment_refund: "Refund", payout: "Payout", stripe_fee: "Stripe fee", adjustment: "Adjustment", dispute: "Dispute" };

export function MoneyView() {
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

  if (err && !top) return <p className="px-1 py-8 text-[15px] text-muted-foreground lg:px-5">{err}</p>;
  if (!top) return <p className="px-1 py-8 font-mono text-[13px] text-muted-foreground lg:px-5">Asking Stripe</p>;
  const tile = (k: string, v: string, hint: string) => (
    <div className="grid gap-1 rounded-xl border border-border p-3.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{k}</span>
      <span style={HEAD} className="text-[26px] leading-none tabular-nums">{v}</span>
      <span className="text-[12.5px] text-muted-foreground">{hint}</span>
    </div>
  );
  return (
    <div className="grid gap-6 px-1 py-5 lg:px-5">
      {top.test ? <p className="font-mono text-[12.5px] text-muted-foreground">Stripe test mode: these are test payments.</p> : null}
      <div className="grid grid-cols-2 gap-2.5">
        {tile("Available", cash(top.available), "ready to pay out")}
        {tile("On the way", cash(top.pending), "not settled yet")}
      </div>
      <section className="grid">
        <h3 aria-level={2} className="pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Transactions</h3>
        {txns.length ? (
          <ul>
            {txns.map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-3 border-b border-border py-2.5">
                <span className="grid min-w-0">
                  <span className="truncate text-[15px]">{t.what || KIND[t.type] || t.type.replace(/_/g, " ")}</span>
                  <span className="font-mono text-[12px] text-muted-foreground">
                    {day(t.at)} · {KIND[t.type] ?? t.type.replace(/_/g, " ")}{t.status === "pending" ? " · on the way" : ""}{t.fee ? ` · fee ${cash(t.fee)}` : ""}
                  </span>
                </span>
                <span className={cn("shrink-0 font-mono text-[14px] tabular-nums", t.net < 0 ? "text-muted-foreground" : "text-foreground")}>{cash(t.net)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="py-2.5 text-[15px] text-muted-foreground">Nothing yet.</p>}
        {more ? <button type="button" disabled={busy} onClick={() => { setBusy(true); page(txns.at(-1)?.id); }} className={cn(btn, "mt-3 justify-self-start")}>{busy ? "Loading" : "Show more"}</button> : null}
        {err ? <p role="alert" className="pt-2 text-[14px] text-destructive">{err}</p> : null}
      </section>
      <p className="font-mono text-[12.5px] text-muted-foreground">Net is after the Stripe fee. Payouts show as money leaving the balance.</p>
    </div>
  );
}
