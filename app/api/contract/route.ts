import { getCloudflareContext } from "@opennextjs/cloudflare";
import { bearer, isAdmin } from "@/lib/vouch";
import { sealer } from "@/lib/leads/lead-crypto";
import { readLead } from "@/lib/leads/lead-store";
import type { InvoiceFrom } from "@/lib/leads/invoice";
import { cleanContractTemplates, cleanDraft, contractOf, contractUrl, copyName, draft, fillContract, fromLines, readContract, signedCopy, writeContract, CONTRACT_TEMPLATES, UNSET } from "@/lib/contracts/contract";
import { contractStep } from "@/lib/contracts/contract-lead";
import { contractMail, sendClient } from "@/lib/email/proof-mail";
import { attachment } from "@/lib/proofs/delivery-serve";
import { bodyOf, json, NO_STORE } from "@/lib/http";
import { parseOr } from "@/lib/json";

/* ── contracts, Julian's side ─────────────────────────────────────
 * Behind the /admin gate like /api/inbox. GET ?templates, ?lead=<lead id>
 * (its contract), ?copy=<contract id> (the signed copy as an HTML file).
 * PUT {templates}. POST {lead, template}: a contract filled from the lead.
 * PATCH {id, to, text, send?: "mail" | "link"}: the draft saved, then sent
 * by mail or marked sent when he copies the link himself.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const TEMPLATES_KEY = "leads:contract-templates";
/** The invoice details (`app/api/inbox`): the contract shows the name, address and email from them. */
const FROM_KEY = "leads:invoice-from";

async function gate(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.INBOX) return { error: json({ error: "This build has no inbox attached." }, 503) };
  if (!(await isAdmin(request, env.INBOX_KEY))) return { error: json({ error: bearer(request) ? "GitHub did not accept that token for this repository." : "Not authorized." }, 401) };
  const seal = sealer(env.LEADS_KEY);
  if (!seal) return { error: json({ error: "Contracts need LEADS_KEY on the Worker." }, 503) };
  return { env, kv: env.INBOX, s: await seal };
}

const templates = async (kv: NonNullable<CloudflareEnv["INBOX"]>) => {
  const saved = parseOr<unknown>(await kv.get(TEMPLATES_KEY), null);
  return saved ? cleanContractTemplates(saved) : CONTRACT_TEMPLATES;
};

export async function GET(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;
  const q = new URL(request.url).searchParams;
  if (q.has("templates")) return json({ templates: await templates(g.kv) });
  const copy = q.get("copy");
  if (copy) {
    const c = await readContract(g.kv, g.s, copy);
    if (!c) return json({ error: "Gone." }, 404);
    // An attachment that cannot run on this origin: the client's typed name is in it.
    return new Response(signedCopy(c), { headers: { ...NO_STORE, "content-type": "text/html; charset=utf-8", "content-disposition": attachment(copyName(c)), "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" } });
  }
  const lead = q.get("lead");
  if (!lead) return json({ error: "Unknown." }, 400);
  const c = await contractOf(g.kv, g.s, lead);
  return json({ contract: c, url: c ? contractUrl(c.id) : null });
}

export async function PUT(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;
  const b = await bodyOf(request);
  if (!b || !Array.isArray(b.templates)) return json({ error: "Not JSON." }, 400);
  const t = cleanContractTemplates(b.templates);
  await g.kv.put(TEMPLATES_KEY, JSON.stringify(t));
  return json({ templates: t });
}

/** A contract from a template, filled from the lead. Replaces an unsigned one; a signed one stays and a new one starts. */
export async function POST(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;
  const b = await bodyOf(request);
  if (typeof b?.lead !== "string") return json({ error: "Not JSON." }, 400);
  const lead = await readLead(g.kv, g.s, b.lead).catch((e: unknown) => (console.error("contract lead", String(e)), undefined));
  if (lead === undefined) return json({ error: "That lead cannot be opened. LEADS_KEY may have changed." }, 500);
  if (!lead) return json({ error: "Gone." }, 404);
  const t = (await templates(g.kv)).find((x) => x.id === b.template) ?? (await templates(g.kv))[0];
  if (!t) return json({ error: "Add a contract template first." }, 400);
  const before = await contractOf(g.kv, g.s, b.lead);
  const email = lead.email.includes("@") && !lead.email.startsWith("ig:") && !lead.email.startsWith("tel:") ? lead.email : "";
  const c = draft(before?.signed ? null : before, b.lead, { to: { name: lead.name, email }, text: fillContract(t.body, lead), template: t.id }, new Date().toISOString());
  if ("error" in c) return json(c, 409);
  await writeContract(g.kv, g.s, c);
  return json({ contract: c, url: contractUrl(c.id) });
}

export async function PATCH(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;
  const b = await bodyOf(request);
  if (!b) return json({ error: "Not JSON." }, 400);
  const before = typeof b.id === "string" ? await readContract(g.kv, g.s, b.id) : null;
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
