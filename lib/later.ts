/**
 * Work that may run after the response: a push service or Notion can take
 * seconds, and the form, a booking and Stripe must not wait on them. In the
 * Worker it goes to waitUntil; with no request around it (tests, scripts) it
 * runs inline. Imported lazily so no client bundle ever loads OpenNext.
 */
export async function later(work: Promise<unknown>): Promise<void> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { ctx } = await getCloudflareContext({ async: true });
    if (ctx?.waitUntil) {
      ctx.waitUntil(work);
      return;
    }
  } catch {
    // No request context: run it here.
  }
  await work;
}
