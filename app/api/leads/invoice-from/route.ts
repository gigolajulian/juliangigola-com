import { cleanFrom, FROM_KEY, invoiceNo, invoicesTaken, type InvoiceFrom } from "@/lib/leads/invoice";
import { gate, noSeal, sealedGate } from "@/lib/leads/desk-route";
import { bodyOf, json } from "@/lib/http";

/* His details for invoices, sealed: GET them, with `?no=<YYYY-MM-DD>` also the number the next invoice on
   that date would get; PUT `{ from }` to save them. Behind the /admin gate. */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await sealedGate(request);
  if (g.error) return g.error;
  const seal = g.s;
  const raw = await g.kv.get(FROM_KEY);
  const from = raw ? cleanFrom(await seal.open<InvoiceFrom>(raw)) : null;
  const date = new URL(request.url).searchParams.get("no") ?? "";
  return json({ from, ...(/^\d{4}-\d{2}-\d{2}$/.test(date) ? { no: invoiceNo(date, await invoicesTaken(g.kv, date)) } : {}) });
}

export async function PUT(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;
  const given = await bodyOf(request);
  if (!given) return json({ error: "Not JSON." }, 400);
  const seal = g.s;
  if (!seal) return noSeal();
  const from = cleanFrom(given.from);
  await g.kv.put(FROM_KEY, await seal.seal(from));
  return json({ from });
}
