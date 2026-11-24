import { sealedStore } from "@/lib/kv";
import { copyName, readContract, sign, signedCopy, writeContract } from "@/lib/contracts/contract";
import { contractStep } from "@/lib/contracts/contract-lead";
import { sendClient, signedMail } from "@/lib/email/proof-mail";
import { alertHello } from "@/lib/email/hello-mail";
import { bodyOf, json } from "@/lib/http";

/* ── contracts, the client's side ─────────────────────────────────
 * POST {name, email, agree, hash, mark | typed}: the signature. The id in the path is the
 * only key. Stored first, then the lead, then the two mails, so a lead or a
 * mail that fails never loses a signature.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { env, seal, kv } = await sealedStore();
  if (!kv || !seal) return json({ error: "This contract is not available." }, 404);
  const s = await seal;
  const draft = await readContract(kv, s, (await params).id).catch((e: unknown) => (console.error("contract sign open", String(e)), undefined));
  // Same words to the client either way; the status says it is broken, not missing.
  if (draft === undefined) return json({ error: "This contract is not available." }, 500);
  if (!draft || !draft.sentAt) return json({ error: "This contract is not available." }, 404);
  if (!(await env.DEPOSIT_LIMIT.limit({ key: `sign:${request.headers.get("cf-connecting-ip") ?? "unknown"}` })).success) return json({ error: "Too many tries. Wait a minute." }, 429);
  const b = (await bodyOf(request)) ?? {};
  const at = new Date().toISOString();
  const contract = await sign(draft, { name: b.name, email: b.email, agree: b.agree, seen: b.hash, mark: b.mark, typed: b.typed, ip: request.headers.get("cf-connecting-ip") ?? "", ua: request.headers.get("user-agent") ?? "" }, at);
  if ("error" in contract) return json({ error: contract.error }, contract.status);
  await writeContract(kv, s, contract);
  const sig = contract.signed!;
  await contractStep(kv, s, contract.lead, "Signed", { at, kind: "contract", ref: `signed:${contract.id}`, note: sig.name }, env.NOTION_TOKEN);
  const [mailed] = await Promise.all([
    sendClient(env.CLIENT_EMAIL, sig.email, signedMail(contract, { html: signedCopy(contract), filename: copyName(contract) })),
    alertHello(env.EMAIL, `Signed: ${contract.to.name}`, [`${sig.name} (${sig.email}) signed the contract for ${contract.to.name}.`, `SHA-256 ${sig.hash}`, "", "Leads: https://juliangigola.com/admin/leads"], { name: sig.name, email: sig.email }),
  ]);
  return json({ signed: { name: sig.name, at: sig.at, hash: sig.hash, mark: sig.mark ?? null }, mailed });
}
