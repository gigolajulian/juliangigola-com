import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sealer } from "@/lib/seal";

/** The INBOX KV namespace as every store reads it (leads, proofs, contracts, the activity log): get, put, list, delete. */
export type InboxKV = Pick<NonNullable<CloudflareEnv["INBOX"]>, "get" | "put" | "list" | "delete">;

/** Every key under a prefix, page after page: one KV list stops at 1000. */
export async function* everyKey<M>(inbox: InboxKV, prefix: string) {
  let cursor: string | undefined;
  for (;;) {
    const listed = await inbox.list<M>({ prefix, cursor });
    yield* listed.keys;
    if (listed.list_complete) return;
    cursor = listed.cursor;
  }
}

/** The Worker env, the opened lead sealer (null without a valid LEADS_KEY) and INBOX (null when unbound).
    Each caller answers its own refusal when either is missing. */
export async function sealedStore() {
  const { env } = await getCloudflareContext({ async: true });
  const p = sealer(env.LEADS_KEY);
  return { env, seal: p ? await p : null, kv: env.INBOX ?? null };
}
