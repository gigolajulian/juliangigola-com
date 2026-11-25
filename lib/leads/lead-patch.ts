/* ── a lead changed by hand ───────────────────────────────────────
 * The lead desk's PATCH on one lead (`app/api/leads/route.ts` hands its plain `id`
 * here, and `mergeFrom` is a plain id too): every field checked, every 404 decided before anything is written,
 * then folded onto the record and its log. The route turns the answer into a Response.
 * ─────────────────────────────────────────────────────────────── */
import type { InboxKV as KV } from "@/lib/kv";
import type { Sealer } from "@/lib/seal";
import { applyLeadEvent, isPaper, isStage, REMIND_MAX, type Lead, type LeadPatch } from "@/lib/leads/leads";
import { buryLead, hasPerson, linkPeople, openLead, personKey, UNOPENABLE, writeLead } from "@/lib/leads/lead-store";
import { adoptLog } from "@/lib/leads/activity-log";
import { notionPaper, notionStage } from "@/lib/leads/notion-lead";
import { cleanPeople, cleanPlan, cleanTasks, merge } from "@/lib/leads/lead-crm";
import { balance, cleanInvoice, invoiceCountKey, invoiceNo, invoicesTaken, usd } from "@/lib/leads/invoice";
import { logged } from "@/lib/utils";

/** The changed lead, or why not and with which status. */
export type PatchResult = { lead: Lead } | { error: string; status: number };
const refuse = (error: string, status: number): PatchResult => ({ error, status });

/**
 * A lead changed by hand: its stage, a snooze (an ISO time, or "" to wake
 * it), opened (`seen`) or marked unread (`seen: false`). Stage and snooze go through `applyLeadEvent`, so they land
 * on the timeline like everything else.
 */
export async function patchLead(inbox: KV, seal: Sealer, given: Record<string, unknown>, notion?: string): Promise<PatchResult> {
  const {
    id,
    stage,
    snoozeUntil,
    seen,
    archive,
    trash,
    notes,
    remind,
    details,
    quote,
    lostReason,
    mergeFrom,
    invoice,
    licence,
    contract,
    release,
    invoicePaid,
    people,
    plan,
    tasks,
  } = given as LeadPatch & { id: string };
  if ((contract !== undefined && !isPaper(contract)) || (release !== undefined && !isPaper(release))) return refuse("Unknown status.", 400);
  const bill = invoice === undefined ? undefined : cleanInvoice(invoice);
  if (bill && "error" in bill) return refuse(bill.error, 400);
  if (remind && (typeof remind.at !== "string" || isNaN(Date.parse(remind.at)))) return refuse("Bad time.", 400);
  if (quote !== undefined && quote !== null && !(typeof quote === "number" && quote >= 0 && quote < 1e7)) return refuse("Bad amount.", 400);
  if (licence && !(typeof licence.end === "string" && /^\d{4}-\d{2}-\d{2}$/.test(licence.end) && !isNaN(Date.parse(licence.end))))
    return refuse("Bad date.", 400);
  if (stage !== undefined && !isStage(stage)) return refuse("Unknown stage.", 400);
  if (snoozeUntil !== undefined && snoozeUntil !== "" && isNaN(Date.parse(snoozeUntil))) return refuse("Bad time.", 400);
  const opened = await openLead(inbox, seal, id);
  if (opened === undefined) return refuse(UNOPENABLE, 500);
  if (!opened) return refuse("Gone.", 404);
  let lead = opened;
  const wasPeople = lead.people;
  if (people !== undefined) {
    const list = cleanPeople(people, lead.email);
    if ("error" in list) return refuse(list.error, 400);
    // An address with a lead of its own, or on another lead, would split their mail: Merge is the way to join them.
    for (const p of list) {
      const own = await seal.id(p.email);
      const theirs = own !== id ? await openLead(inbox, seal, own) : null;
      if (theirs === undefined) return refuse(UNOPENABLE, 500);
      if (theirs) return refuse(`${p.email} has a lead of their own. Merge it into this one instead.`, 409);
      const to = await inbox.get(personKey(own));
      const there = to && to !== id ? await openLead(inbox, seal, to) : null;
      if (there === undefined) return refuse(UNOPENABLE, 500);
      if (there && hasPerson(there, p.email)) return refuse(`${p.email} is already on another lead.`, 409);
    }
    lead = {
      ...lead,
      people: list.length ? list : undefined,
      events: [...lead.events, { at: new Date().toISOString(), kind: "edit" as const, note: "people" }].slice(-50),
    };
  }
  // The shoot plan and tasks (`cleanPlan`, `cleanTasks`): whole replacements, checked against the people as they now stand.
  if (plan !== undefined) {
    const p = cleanPlan(plan, lead.people);
    if (p && "error" in p) return refuse(p.error, 400);
    lead = { ...lead, plan: p ?? undefined };
  }
  if (tasks !== undefined) {
    const t = cleanTasks(tasks, lead.tasks, lead.people);
    if ("error" in t) return refuse(t.error, 400);
    lead = { ...lead, tasks: t.tasks.length ? t.tasks : undefined, events: [...lead.events, ...t.events].slice(-50) };
  }
  // Every 404 is decided before anything is written: a patch that fails must not move the Notion board or use up an invoice number.
  const mergeId = typeof mergeFrom === "string" && mergeFrom && mergeFrom !== id ? mergeFrom : undefined;
  const other = mergeId ? await openLead(inbox, seal, mergeId) : null;
  if (other === undefined) return refuse(UNOPENABLE, 500);
  if (mergeId && !other) return refuse("Gone.", 404);
  const paidNo = invoicePaid && typeof invoicePaid.no === "string" ? invoicePaid.no : undefined;
  const billN = bill ? await invoicesTaken(inbox, bill.date) : 0;
  const nos = [...(lead.invoices ?? []), ...(other?.invoices ?? [])].map((v) => v.no);
  if (paidNo && !nos.includes(paidNo) && !(bill && paidNo === invoiceNo(bill.date, billN))) return refuse("No such invoice.", 404);
  // What the log compares against: events already logged (this lead's, and a merged record's) are not logged again.
  let from: Lead = lead;
  const at = new Date().toISOString();
  if (stage) {
    lead = applyLeadEvent(lead, lead.email, { event: { at, kind: "stage", note: stage }, stage });
    // Mirrored to the Notion board; a Notion failure never blocks the desk.
    const page = await notionStage(notion, lead.email, stage, lead.notion);
    if (page) lead.notion = page;
  }
  if (contract || release) {
    const paper = { ...(contract ? { contract } : {}), ...(release ? { release } : {}) };
    lead = { ...lead, ...paper };
    const page = await notionPaper(notion, lead.email, paper, lead.notion);
    if (page) lead.notion = page;
  }
  if (snoozeUntil !== undefined)
    lead = applyLeadEvent(lead, lead.email, { event: { at, kind: "snooze", note: snoozeUntil || "woken" }, snoozeUntil });
  if (typeof archive === "boolean")
    lead = applyLeadEvent(lead, lead.email, { event: { at, kind: "archive", note: archive ? "in" : "out" }, on: archive });
  if (typeof trash === "boolean")
    lead = applyLeadEvent(lead, lead.email, { event: { at, kind: "trash", note: trash ? "in" : "out" }, on: trash });
  // Opened (true), or marked unread again by hand (false).
  if (typeof seen === "boolean") lead = { ...lead, unread: !seen };
  // His own words and numbers (`lib/leads/lead-crm.ts`).
  const cut = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined);
  if (typeof notes === "string") lead = { ...lead, notes: cut(notes, 5000) };
  if (remind !== undefined) {
    const r = remind ? { at: new Date(remind.at!).toISOString(), text: cut(remind.text, REMIND_MAX) ?? "" } : undefined;
    lead = { ...lead, remind: r, events: [...lead.events, { at, kind: "remind" as const, note: r ? r.at : "" }].slice(-50) };
  }
  if (details) {
    const d = {
      name: cut(details.name, 80) ?? lead.name,
      phone: cut(details.phone, 40),
      ig: cut(details.ig, 31)?.replace(/^@?/, "@"),
      company: cut(details.company, 80),
      source: cut(details.source, 40),
      kind: cut(details.kind, 40)?.toLowerCase() ?? lead.kind,
    };
    lead = { ...lead, ...d, events: [...lead.events, { at, kind: "edit" as const }].slice(-50) };
  }
  if (quote !== undefined)
    lead = {
      ...lead,
      quote: quote ?? undefined,
      events: [...lead.events, { at, kind: "quote" as const, note: quote === null ? "" : String(quote) }].slice(-50),
    };
  if (typeof lostReason === "string") lead = { ...lead, lostReason: cut(lostReason, 80) };
  if (licence !== undefined) lead = { ...lead, licence: licence ? { use: cut(licence.use, 80) ?? "", end: licence.end! } : undefined };
  // Another record of the same person folded into this one; the other goes for good, once this one is written.
  let merged: string | undefined;
  if (mergeId && other) {
    lead = merge(lead, other, at);
    from = { ...from, events: [...from.events, ...other.events] };
    merged = mergeId;
  }
  // A new invoice takes the month's next number: 1126, then 1126-2.
  // shortcut: read then write the count is not atomic; one person makes these by hand, a Durable Object if that changes.
  if (bill) {
    const n = billN;
    const made = { ...bill, no: invoiceNo(bill.date, n), at };
    lead = {
      ...lead,
      invoices: [...(lead.invoices ?? []), made],
      events: [...lead.events, { at, kind: "invoice" as const, note: `${made.no}, ${usd(balance(made))} due` }].slice(-50),
    };
    await inbox.put(invoiceCountKey(bill.date), String(n + 1));
  }
  // Settled by hand (cash, Zelle), or opened again.
  if (invoicePaid && typeof invoicePaid.no === "string") {
    const inv = lead.invoices?.find((v) => v.no === invoicePaid.no);
    if (!inv) return refuse("No such invoice.", 404);
    // A second tap (or a retry) on an invoice already in that state changes nothing: no double count in paid total.
    if (!!inv.paidAt !== !!invoicePaid.paid) {
      // What his last hand mark on this invoice added, if that mark is still standing.
      const handPaid = [...lead.events].reverse().find((e) => e.kind === "invoice-paid" && e.note?.startsWith(`${inv.no} `))?.amount;
      const lastAdded = handPaid !== undefined && handPaid > 0 ? handPaid : undefined;
      lead = {
        ...lead,
        invoices: lead.invoices!.map((v) =>
          v === inv ? { ...v, paidAt: invoicePaid.paid ? at : undefined, unpaid: invoicePaid.paid ? undefined : true } : v,
        ),
        // Cash or Zelle is money too: the amount counts in paid total. An unmark takes off only what a hand mark added
        // (an old invoice counted as paid, or one a Stripe payment settled, was never added here).
        events: [
          ...lead.events,
          {
            at,
            kind: "invoice-paid" as const,
            note: `${inv.no} ${invoicePaid.paid ? `paid, ${usd(balance(inv))}` : "unpaid again"}`,
            amount: invoicePaid.paid ? balance(inv) : lastAdded !== undefined ? -lastAdded : undefined,
          },
        ].slice(-50),
      };
    }
  }
  for (const k of Object.keys(lead) as (keyof Lead)[]) if (lead[k] === undefined) delete lead[k];
  await writeLead(inbox, seal, id, lead, from);
  // Their mail finds this lead from now on; a merged record's people now point here too.
  if (people !== undefined || merged) await linkPeople(inbox, seal, id, lead.people, merged ? undefined : wasPeople);
  if (merged) {
    await adoptLog(inbox, seal, id, merged, lead).catch(logged("activity log merge"));
    // No seal: adoptLog above already moved the old log here.
    await buryLead(inbox, undefined, merged);
  }
  return { lead };
}
