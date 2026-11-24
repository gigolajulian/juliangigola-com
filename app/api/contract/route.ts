import { gate } from "@/lib/admin/gate";
import { mailable } from "@/lib/leads/lead-crm";
import type { InboxKV } from "@/lib/kv";
import { readLead } from "@/lib/leads/lead-store";
import { FROM_KEY, type InvoiceFrom } from "@/lib/leads/invoice";
import { cleanContractTemplates, cleanDraft, contractOf, contractUrl, copyName, draft, fillContract, fromLines, readContract, signedCopy, writeContract, CONTRACT_TEMPLATES, UNSET } from "@/lib/contracts/contract";
import { contractStep } from "@/lib/contracts/contract-lead";
import { contractMail, sendClient } from "@/lib/proofs/proof-mail";
import { attachment } from "@/lib/proofs/delivery-serve";
import { bodyOf, json, NO_STORE } from "@/lib/http";
import { parseOr } from "@/lib/json";
import { logged } from "@/lib/utils";

/* ── contracts, Julian's side ─────────────────────────────────────
 * Behind the /admin gate. GET ?templates, ?lead=<lead id>
 * (its contract), ?copy=<contract id> (the signed copy as an HTML file).
 * PUT {templates}. POST {lead, template}: a contract filled from the lead.
 * PATCH {id, to, text, send?: "mail" | "link"}: the draft saved, then sent
 * by mail or marked sent when he copies the link himself.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const TEMPLATES_KEY = "leads:contract-templates";

/** A contract that is there but will not open (a rotated LEADS_KEY): `logged`, then `broken()`, never "Gone". */
const broken = () => json({ error: "That contract cannot be opened. LEADS_KEY may have changed." }, 500);

/** A sealed read: its value (null when missing), or the `refused` answer when it is there but will not open, logged under `label`. */
async function openOr<T>(label: string, read: Promise<T>, refused = broken): Promise<T | Response> {
  const v = await read.catch(logged(label));
  return v === undefined ? refused() : v;
}

/** The desk's gate with this route's INBOX message, then LEADS_KEY. */
async function contractGate(request: Request) {
  const g = await gate(request, "This build has no inbox attached.");
  if (g.error) return g;
  if (!g.s) return { error: json({ error: "Contracts need LEADS_KEY on the Worker." }, 503) };
  return { ...g, s: g.s };
}

const templates = async (kv: InboxKV) => {
  const saved = parseOr<unknown>(await kv.get(TEMPLATES_KEY), null);
  return saved ? cleanContractTemplates(saved) : CONTRACT_TEMPLATES;
};

export async function GET(request: Request) {
  const g = await contractGate(request);
  if (g.error) return g.error;
  const q = new URL(request.url).searchParams;
  if (q.has("templates")) return json({ templates: await templates(g.kv) });
  const copy = q.get("copy");
  if (copy) {
    const c = await openOr("contract copy", readContract(g.kv, g.s, copy));
    if (c instanceof Response) return c;
    if (!c) return json({ error: "Gone." }, 404);
    // An attachment that cannot run on this origin: the client's typed name is in it.
    return new Response(signedCopy(c), { headers: { ...NO_STORE, "content-type": "text/html; charset=utf-8", "content-disposition": attachment(copyName(c)), "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" } });
  }
  const lead = q.get("lead");
  if (!lead) return json({ error: "Unknown." }, 400);
  const c = await openOr("contract of lead", contractOf(g.kv, g.s, lead));
  if (c instanceof Response) return c;
  return json({ contract: c, url: c ? contractUrl(c.id) : null });
}

export async function PUT(request: Request) {
  const g = await contractGate(request);
  if (g.error) return g.error;
  const b = await bodyOf(request);
  if (!b || !Array.isArray(b.templates)) return json({ error: "Not JSON." }, 400);
  const t = cleanContractTemplates(b.templates);
  await g.kv.put(TEMPLATES_KEY, JSON.stringify(t));
  return json({ templates: t });
}

/** A contract from a template, filled from the lead. Replaces an unsigned one; a signed one stays and a new one starts. */
export async function POST(request: Request) {
  const g = await contractGate(request);
  if (g.error) return g.error;
  const b = await bodyOf(request);
  if (typeof b?.lead !== "string") return json({ error: "Not JSON." }, 400);
  const lead = await openOr("contract lead", readLead(g.kv, g.s, b.lead), () => json({ error: "That lead cannot be opened. LEADS_KEY may have changed." }, 500));
  if (lead instanceof Response) return lead;
  if (!lead) return json({ error: "Gone." }, 404);
  const t = (await templates(g.kv)).find((x) => x.id === b.template) ?? (await templates(g.kv))[0];
  if (!t) return json({ error: "Add a contract template first." }, 400);
  const before = await openOr("contract before new", contractOf(g.kv, g.s, b.lead));
  if (before instanceof Response) return before;
  const email = mailable(lead.email) ? lead.email : "";
  const c = draft(before?.signed ? null : before, b.lead, { to: { name: lead.name, email }, text: fillContract(t.body, lead), template: t.id }, new Date().toISOString());
  if ("error" in c) return json(c, 409);
  await writeContract(g.kv, g.s, c);
  return json({ contract: c, url: contractUrl(c.id) });
}

export async function PATCH(request: Request) {
  const g = await contractGate(request);
  if (g.error) return g.error;
  const b = await bodyOf(request);
  if (!b) return json({ error: "Not JSON." }, 400);
  const before = typeof b.id === "string" ? await openOr("contract save", readContract(g.kv, g.s, b.id)) : null;
  if (before instanceof Response) return before;
  if (!before) return json({ error: "Gone." }, 404);
  const d = cleanDraft(b);
  if ("error" in d) return json(d, 400);
  const at = new Date().toISOString();
  let c = draft(before, before.lead, d, at);
  if ("error" in c) return json(c, 409);
  const send = b.send === "mail" || b.send === "link" ? b.send : null;
  if (send && UNSET.test(c.text)) return json({ error: "Fill in every line marked \"to be set\" first." }, 400);
  if (send === "mail" && !c.to.email) return json({ error: "Add the client's email to send it." }, 400);
  if (send) {
    const raw = await g.kv.get(FROM_KEY);
    const from = raw ? await g.s.open<InvoiceFrom>(raw).catch(() => null) : null;
    c = { ...c, from: fromLines(from).length ? fromLines(from) : ["Julian Gigola", "hello@juliangigola.com"], sentAt: c.sentAt ?? at };
  }
  await writeContract(g.kv, g.s, c);
  let mailed: boolean | undefined;
  if (send === "mail") mailed = await sendClient(g.env.CLIENT_EMAIL, c.to.email, contractMail(c));
  if (send && (send === "link" || mailed)) {
    await contractStep(g.kv, g.s, c.lead, "Sent",
      send === "mail" ? { at, kind: "mail", note: "Your contract", mail: { to: "client", kind: "contract" } } : { at, kind: "mail", note: "Contract link copied", mail: { to: "client", kind: "contract-link" } }, g.env.NOTION_TOKEN);
  }
  if (mailed === false) return json({ contract: c, url: contractUrl(c.id), error: "Saved, but the mail did not go out. Copy the link instead." }, 502);
  return json({ contract: c, url: contractUrl(c.id), ...(mailed ? { mailed } : {}) });
}
