import { getCloudflareContext } from "@opennextjs/cloudflare";
import { notify, subscribe, unsubscribe } from "@/lib/leads/lead-push";
import { publicKey } from "@/lib/leads/web-push";
import { secretJson } from "@/lib/secrets";
import { gate } from "@/lib/leads/desk-route";
import { bodyOf, json } from "@/lib/http";

/* The desk's notifications (`lib/leads/lead-push.ts`): GET the key a device subscribes with, PUT a
   subscription, DELETE `{ endpoint }` to turn a device off, POST a test. Behind the /admin gate. */

export const dynamic = "force-dynamic";

const noVapid = () => json({ error: "Push needs VAPID_KEY on the Worker." }, 503);

/** The key a device subscribes to pushes with. Public by nature, still gated. */
export async function GET(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;
  if (!g.vapid) return noVapid();
  return json({ key: publicKey(secretJson<JsonWebKey>(g.vapid, "VAPID_KEY")) });
}

/** A device subscribing: the browser's `PushSubscription` as JSON. */
export async function PUT(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;
  const sub = (await bodyOf(request)) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  if (typeof sub?.endpoint !== "string" || !sub.endpoint.startsWith("https://")) return json({ error: "Bad subscription." }, 400);
  if (typeof sub.keys?.p256dh !== "string" || typeof sub.keys.auth !== "string") return json({ error: "Bad subscription." }, 400);
  await subscribe(g.kv, { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  return json({ ok: true });
}

/** A device turning these off, by its endpoint. */
export async function DELETE(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;
  const given = await bodyOf(request);
  if (typeof given?.endpoint !== "string" || !given.endpoint.startsWith("https://")) return json({ error: "Bad subscription." }, 400);
  await unsubscribe(g.kv, given.endpoint);
  return json({ ok: true });
}

/** "Send a test": one ping to every device that turned these on. */
export async function POST(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;
  if (!g.vapid) return noVapid();
  const vapid = g.vapid;
  const devices = (await g.kv.list({ prefix: "push:" })).keys.length;
  const send = () => notify(g.kv, vapid, { title: "Test notification", body: "Leads can reach this device.", url: "/admin/leads" });
  // 10 seconds later, so he can lock the phone: iOS shows no banner while the app is open.
  const { ctx } = (await getCloudflareContext({ async: true })) as { ctx?: { waitUntil(p: Promise<unknown>): void } };
  if (devices && ctx?.waitUntil) ctx.waitUntil(new Promise((r) => setTimeout(r, 10_000)).then(send));
  else if (devices) await send();
  return json({ devices });
}
