/* ── the Monday mail to hello@ ────────────────────────────────────
 * Once a week (booking Worker cron, `worker/index.ts`), the last seven days
 * off the master log: new leads, money in and out, sessions booked, moved
 * or cancelled, and what is stuck. Plain text, built here, sent by
 * `app/api/leads/weekly/route.ts`. Pure: no KV, no mail.
 * ─────────────────────────────────────────────────────────────── */

import { TZ } from "../booking/booking-rules";
import type { MasterEntry } from "./activity-log";
import { balance, isPaid, usdB } from "./invoice";
import type { Lead, LeadEvent } from "./leads";

const day = (t: number) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" }).format(new Date(t));
const ymd = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(t));

export function weeklyMail(all: (Lead & { id?: string })[], master: MasterEntry[], now: number): { subject: string; lines: string[] } {
  const from = new Date(now - 7 * 864e5).toISOString();
  const to = new Date(now).toISOString();
  const leads = all.filter((l) => !l.trashedAt);
  const live = new Set(leads.map((l) => l.id));
  const week = master.filter((m) => live.has(m.lead) && m.event.at >= from && m.event.at < to);
  const of = (...kinds: LeadEvent["kind"][]) => week.filter((m) => kinds.includes(m.event.kind));
  const sum = (ms: MasterEntry[]) => ms.reduce((n, m) => n + (m.event.amount ?? 0), 0);
  const list = (ms: MasterEntry[], money = false) => ms.map((m) => `  ${m.name}${money ? `, ${usdB(m.event.amount ?? 0)}` : m.event.note ? `, ${m.event.note}` : ""}`);

  const fresh = leads.filter((l) => l.firstAt >= from && l.firstAt < to);
  const paid = of("payment");
  const refunds = of("refund");
  const booked = of("booking", "call");
  const moved = of("reschedule");
  const cancelled = of("cancel");
  const today = ymd(now);
  const stuck = leads.filter((l) => !l.archivedAt && l.flags?.includes("stuck"));
  const overdue = leads.flatMap((l) => (l.invoices ?? []).filter((v) => !isPaid(v) && v.b?.due && v.b.due < today).map((v) => ({ l, v })));

  const block = (title: string, rows: string[]) => (rows.length ? [title, ...rows, ""] : []);
  const lines = [
    `My week on the desk, ${day(now - 7 * 864e5)} to ${day(now)}.`,
    "",
    `New leads: ${fresh.length}`,
    ...fresh.map((l) => `  ${l.name}${l.kind ? `, ${l.kind.replace(/-/g, " ")}` : ""}${l.source ? ` (${l.source})` : ""}`),
    "",
    `Paid in: ${usdB(sum(paid))}${refunds.length ? `, refunded ${usdB(sum(refunds))}` : ""}`,
    ...list(paid, true),
    ...(refunds.length ? ["Refunds:", ...list(refunds, true)] : []),
    "",
    `Sessions booked: ${booked.length}, moved: ${moved.length}, cancelled: ${cancelled.length}`,
    ...block("Booked:", list(booked)),
    ...block("Moved:", list(moved)),
    ...block("Cancelled:", list(cancelled)),
    ...(stuck.length || overdue.length
      ? ["Stuck:", ...stuck.map((l) => `  ${l.name}, deposit stuck, refund or rebook`), ...overdue.map(({ l, v }) => `  ${l.name}, invoice ${v.no} due ${v.b!.due}, ${usdB(balance(v))} open`)]
      : ["Nothing stuck."]),
  ];
  return { subject: `My week: ${fresh.length} new, ${usdB(sum(paid) - sum(refunds))} in, ${booked.length} booked`, lines: lines.filter((s, i, a) => s || a[i - 1]) };
}
