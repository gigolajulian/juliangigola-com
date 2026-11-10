"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { authed, btn, cash, day, HEAD } from "@/components/leads/shared";

/* ── Money: his Stripe balance and what moved it ──────────────────
 * Julian (2026-11-06): "add my stripe balance too and show the
 * transactions in there". Read-only, through `/api/money`. */

type Txn = { id: string; at: string; type: string; amount: number; fee: number; net: number; currency: string; status: string; what: string };
/** Stripe's types in his words. */
const KIND: Record<string, string> = { charge: "Payment", payment: "Payment", refund: "Refund", payment_refund: "Refund", payout: "Payout", stripe_fee: "Stripe fee", adjustment: "Adjustment", dispute: "Dispute" };

function MoneyView() {
  const [top, setTop] = React.useState<{ available: number; pending: number; test: boolean } | null>(null);
  const [txns, setTxns] = React.useState<Txn[]>([]);
  const [more, setMore] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const page = React.useCallback((after?: string) => {
    fetch(`/api/money${after ? `?after=${after}` : ""}`, { headers: authed(), cache: "no-store" })
      .then(async (r) => {
        const o = (await r.json().catch(() => ({}))) as { error?: string; available?: number; pending?: number; test?: boolean; txns: Txn[]; more: boolean };
        if (!r.ok) throw new Error(o.error ?? `Request failed (${r.status})`);
        if (o.available !== undefined) setTop({ available: o.available, pending: o.pending ?? 0, test: !!o.test });
        setTxns((t) => (after ? [...t, ...o.txns] : o.txns));
        setMore(o.more);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)))
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

export { KIND, MoneyView };
export type { Txn };
