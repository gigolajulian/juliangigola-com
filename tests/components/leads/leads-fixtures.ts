import type { InvoiceRow as Row } from "@/components/leads/invoices";
import type { LeadSummary } from "@/lib/leads/leads";

// Shared fixtures for the Leads desk component tests.
export const iso = new Date().toISOString();
export const lead = (id: string, extra: Partial<LeadSummary> = {}) =>
  ({ id, email: `${id}@x.com`, name: id, stage: "Inquiry", stageAt: iso, firstAt: iso, lastAt: iso, ...extra }) as LeadSummary;
export const json = (o: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status }));
export const inv = (no: string, extra: Partial<Row> = {}): Row => ({
  no,
  date: "2026-11-16",
  lines: [{ desc: "Portraits", qty: 1, rate: 900 }],
  paid: 100,
  at: "2026-11-16T20:00:00Z",
  lead: "a",
  name: "Ana Ruiz",
  ...extra,
});
