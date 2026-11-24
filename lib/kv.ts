import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sealer } from "@/lib/leads/lead-crypto";

/** The INBOX KV namespace as every store reads it (leads, proofs, contracts, the activity log): get, put, list, delete. */
export type InboxKV = Pick<NonNullable<CloudflareEnv["INBOX"]>, "get" | "put" | "list" | "delete">;

/** The Worker env, the lead sealer (null without a valid LEADS_KEY) and INBOX (null when unbound).
    Each caller answers its own refusal when either is missing. */
export async function sealedStore() {
  const { env } = await getCloudflareContext({ async: true });
  return { env, seal: sealer(env.LEADS_KEY), kv: env.INBOX ?? null };
}
