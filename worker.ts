/* ── the site Worker's entry (wrangler `main`) ─────────────────────
 * OpenNext's generated worker, with the delivery downloads answered first:
 * its response wrapper drops a streamed body's length and backpressure.
 * See `lib/proofs/delivery-serve.ts`. Everything else goes to OpenNext.
 * ─────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- ignore, not expect-error: the file exists only after a build
// @ts-ignore: made by `opennextjs-cloudflare build`, bundled by wrangler
import openNext from "./.open-next/worker.js";
import { deliveryDownload } from "./lib/proofs/delivery-serve";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: made by `opennextjs-cloudflare build`
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

const site = {
  async fetch(request: Request, env: CloudflareEnv, ctx: unknown) {
    return (await deliveryDownload(request, env)) ?? openNext.fetch(request, env, ctx);
  },
};
export default site;
