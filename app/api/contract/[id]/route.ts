import { sealedStore } from "@/lib/kv";
import { copyName, readContract, sign, signedCopy, writeContract } from "@/lib/contracts/contract";
import { contractStep } from "@/lib/contracts/contract-lead";
import { sendClient, signedMail } from "@/lib/email/proof-mail";
import { alertHello } from "@/lib/email/hello-mail";
import { bodyOf, json, limited } from "@/lib/http";
import { logged } from "@/lib/utils";

/* ── contracts, the client's side ─────────────────────────────────
 * POST {name, email, agree, hash, mark | typed}: the signature. The id in the path is the
 * only key. Stored first, then the lead, then the two mails, so a lead or a
 * mail that fails never loses a signature.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { env, seal: s, kv } = await sealedStore();
  if (!kv || !s) return json({ error: "This contract is not available." }, 404);
  const draft = await readContract(kv, s, (await params).id).catch(logged("contract sign open"));
  // Same words to the client either way; the status says it is broken, not missing.
  if (draft === undefined) return json({ error: "This contract is not available." }, 500);
  if (!draft || !draft.sentAt) return json({ error: "This contract is not available." }, 404);
  const slow = await limited(env.PUBLIC_WRITE_LIMIT, "sign", request);
  if (slow) return slow;
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
