/* ── error alerts ──────────────────────────────────────────────────
 * A server error mails hello@, at most once an hour per label, so a
 * stranger forcing 502s cannot flood the inbox. Called by `upstreamError`
 * (Stripe, Google, the booking lock) and by `instrumentation.ts` for
 * anything thrown. The booking Worker's hourly site check covers the
 * site being down. Never throws.
 * ─────────────────────────────────────────────────────────────── */

import { alertHello } from "@/lib/email/hello-mail";
import { later } from "@/lib/later";
import { errorText } from "@/lib/utils";

/** One mail per label in this many seconds. */
export const ALERT_QUIET_S = 3600;

export async function reportError(label: string, e: unknown): Promise<void> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    if (!env.EMAIL || !env.INBOX) return;
    const key = `erralert:${label.slice(0, 200)}`;
    if (await env.INBOX.get(key)) return;
    await env.INBOX.put(key, new Date().toISOString(), { expirationTtl: ALERT_QUIET_S });
    await alertHello(env.EMAIL, `Site error: ${label}`, [
      errorText(e).slice(0, 500),
      "",
      `Mailed once an hour per error. Logs: Cloudflare dashboard, Workers, juliangigola-com, Observability.`,
    ]);
  } catch (err) {
    console.error("error alert", String(err));
  }
}

/** `reportError` after the response, so the visitor never waits on the mail. */
export const alertLater = (label: string, e: unknown) => later(reportError(label, e));
