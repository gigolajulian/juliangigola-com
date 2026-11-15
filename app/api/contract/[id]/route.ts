import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sealer } from "@/lib/leads/lead-crypto";
import { readContract, sign, writeContract } from "@/lib/contracts/contract";
import { contractStep } from "@/lib/contracts/contract-lead";
import { sendClient, signedMail } from "@/lib/email/proof-mail";
import { alertHello } from "@/lib/hello-mail";
import { bodyOf, json } from "@/lib/http";

/* ── contracts, the client's side ─────────────────────────────────
 * POST {name, email, agree, hash, mark | typed}: the signature. The id in the path is the
 * only key. Stored first, then the lead, then the two mails, so a lead or a
 * mail that fails never loses a signature.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { env } = await getCloudflareContext({ async: true });
  const seal = sealer(env.LEADS_KEY);
  if (!env.INBOX || !seal) return json({ error: "This contract is not available." }, 404);
  const s = await seal;
  const c = await readContract(env.INBOX, s, (await params).id);
  if (!c || !c.sentAt) return json({ error: "This contract is not available." }, 404);
  if (!(await env.DEPOSIT_LIMIT.limit({ key: request.headers.get("cf-connecting-ip") ?? "unknown" })).success) return json({ error: "Too many tries. Wait a minute." }, 429);
  const b = (await bodyOf(request)) ?? {};
  const at = new Date().toISOString();
  const done = await sign(c, { name: b.name, email: b.email, agree: b.agree, seen: b.hash, mark: b.mark, typed: b.typed, ip: request.headers.get("cf-connecting-ip") ?? "", ua: request.headers.get("user-agent") ?? "" }, at);
  if ("error" in done) return json({ error: done.error }, done.status);
  await writeContract(env.INBOX, s, done);
  const sig = done.signed!;
  await contractStep(env.INBOX, s, done.lead, "Signed", { at, kind: "contract", ref: `signed:${done.id}`, note: sig.name }, env.NOTION_TOKEN);
  const [mailed] = await Promise.all([
    sendClient(env.CLIENT_EMAIL, sig.email, signedMail(done)),
    alertHello(env.EMAIL, `Signed: ${done.to.name}`, [`${sig.name} (${sig.email}) signed the contract for ${done.to.name}.`, `SHA-256 ${sig.hash}`, "", "Leads: https://juliangigola.com/admin/leads"], { name: sig.name, email: sig.email }),
  ]);
  return json({ signed: { name: sig.name, at: sig.at, hash: sig.hash, mark: sig.mark ?? null }, mailed });
}
