/* What the /admin desk's routes share: the gate, the answer without LEADS_KEY, and a KV list read page by page.
   The routes are /api/inbox (the enquiries) and the lead resources under /api/leads. */
import { refuseAdmin } from "@/lib/vouch";
import { sealedStore } from "@/lib/kv";
import { json } from "@/lib/http";

/** What a lead read or write answers on a Worker without LEADS_KEY. */
export const noSeal = () => json({ error: "Leads need LEADS_KEY on the Worker." }, 503);

/** Every key under a prefix, page after page: one KV list stops at 1000. */
export async function* everyKey<M>(inbox: NonNullable<CloudflareEnv["INBOX"]>, prefix: string) {
  let cursor: string | undefined;
  for (;;) {
    const listed = await inbox.list<M>({ prefix, cursor });
    yield* listed.keys;
    if (listed.list_complete) return;
    cursor = listed.cursor;
  }
}

/**
 * The admin gate, then the binding: `kv`, the opened sealer `s` (null without LEADS_KEY, refused per
 * route with `noSeal`, since push and templates need none), Notion and VAPID.
 *
 * Opens with the /admin credentials in `lib/vouch.ts`: the admin key (`x-admin-key`, the `INBOX_KEY` secret), compared in constant time,
 * or a GitHub token that can push. With neither set, it refuses everything: an enquiry or a lead carries
 * somebody's name, their email and what they want.
 */
export async function gate(request: Request) {
  const { env, seal, kv } = await sealedStore();
  // Who is asking first: what this build is missing is for /admin only.
  const denied = await refuseAdmin(request, env.INBOX_KEY);
  if (denied) return { error: denied };
  if (!kv) return { error: json({ error: "This build has no inbox attached. Deploy with the INBOX namespace bound." }, 503) };
  return { env, kv, s: seal ? await seal : null, notion: env.NOTION_TOKEN, vapid: env.VAPID_KEY };
}

