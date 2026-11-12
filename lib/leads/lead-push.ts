import { send, type Push, type Subscription } from "./web-push";
import type { Lead, LeadEvent } from "./leads";

/* ── the lead desk's devices ──────────────────────────────────────
 * Each device that turned notifications on (`components/leads/setup-panels.tsx`)
 * is one `push:<hash of its endpoint>` row in INBOX. A lead's arrival
 * pings them all; a device the push service says is gone is forgotten.
 * Nothing is sent while no device has subscribed, so the switch on the
 * desk is the only thing that turns this on.
 * ─────────────────────────────────────────────────────────────── */

type KV = Pick<NonNullable<CloudflareEnv["INBOX"]>, "get" | "put" | "list" | "delete">;

const keyOf = async (endpoint: string) =>
  `push:${[...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint)))].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("")}`;

export const subscribe = async (kv: KV, sub: Subscription) => kv.put(await keyOf(sub.endpoint), JSON.stringify(sub));
export const unsubscribe = async (kv: KV, endpoint: string) => kv.delete(await keyOf(endpoint));

/** What reaching the site looks like on the lock screen. Only arrivals ping. */
const TITLE: Partial<Record<LeadEvent["kind"], string>> = {
  inquiry: "New inquiry",
  call: "Call booked",
  booking: "New booking",
  "deposit-stuck": "Deposit stuck",
  wrote: "New reply",
  cancel: "Session cancelled",
  reschedule: "Session moved",
  selects: "Selects in",
};

export function pushFor(lead: Lead, event: LeadEvent): Push | null {
  // A payment pings unless it is a deposit: the booking already did.
  const title = event.kind === "payment" && !/deposit/i.test(event.note ?? "") ? "Payment in" : TITLE[event.kind];
  if (!title) return null;
  // No tag: on iOS a push with an earlier one's tag replaces it without a banner.
  return { title, body: [lead.name, lead.kind].filter(Boolean).join(", "), url: "/admin/leads" };
}

/** Pings every device. Never throws: the lead is already stored. */
export async function notify(kv: KV, secret: string | undefined, push: Push): Promise<void> {
  if (!secret) return;
  try {
    const { keys } = await kv.list({ prefix: "push:" });
    await Promise.all(
      keys.map(async ({ name }: { name: string }) => {
        const raw = await kv.get(name);
        if (!raw) return;
        if ((await send(secret, JSON.parse(raw) as Subscription, push)) === "gone") await kv.delete(name);
      }),
    );
  } catch (e) {
    console.error("push", String(e));
  }
}
