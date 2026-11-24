/* What the /admin desk's routes share: the gate and the answer without LEADS_KEY.
   The routes are /api/inbox (the enquiries), the lead resources under /api/leads, /api/contract and /api/proof. */
import { refuseAdmin } from "@/lib/admin/vouch";
import { sealedStore } from "@/lib/kv";
import { json } from "@/lib/http";

/** What a lead read or write answers on a Worker without LEADS_KEY. */
export const noSeal = () => json({ error: "Leads need LEADS_KEY on the Worker." }, 503);

/**
 * The admin gate, then the binding: `kv`, the opened sealer `s` (null without LEADS_KEY, refused per
 * route with `noSeal`, since push and templates need none), Notion and VAPID.
 *
 * Opens with the /admin credentials in `lib/admin/vouch.ts`: the admin key (`x-admin-key`, the `INBOX_KEY` secret), compared in constant time,
 * or a GitHub token that can push. With neither set, it refuses everything: an enquiry or a lead carries
 * somebody's name, their email and what they want. `noInbox` is the 503 message when INBOX is unbound.
 */
export async function gate(request: Request, noInbox = "This build has no inbox attached. Deploy with the INBOX namespace bound.") {
  const { env, seal, kv } = await sealedStore();
  // Who is asking first: what this build is missing is for /admin only.
  const denied = await refuseAdmin(request, env.INBOX_KEY);
  if (denied) return { error: denied };
  if (!kv) return { error: json({ error: noInbox }, 503) };
  return { env, kv, s: seal, notion: env.NOTION_TOKEN, vapid: env.VAPID_KEY };
}

/** `gate`, then `refused()` without LEADS_KEY: for the routes that open leads (and contracts, with their own messages). */
export async function sealedGate(request: Request, noInbox?: string, refused = noSeal) {
  const g = await gate(request, noInbox);
  if (g.error) return g;
  if (!g.s) return { error: refused() };
  return { ...g, s: g.s };
}
