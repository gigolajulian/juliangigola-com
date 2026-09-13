import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

/**
 * How `next build`'s output is turned into a Cloudflare Worker.
 *
 * ── the cache, and why it was wrong to leave it out ───────────────
 * This used to say: "No incremental cache. Every page is prerendered at build
 * time and nothing revalidates, so there is no ISR to persist. Adding a KV or
 * R2 cache would be infrastructure for a feature the site does not use."
 *
 * Every clause of that is true and the conclusion was still wrong, because an
 * incremental cache is not only where revalidated pages are *written*. It is
 * also where prerendered pages are *read from*. With none configured, the
 * Worker assembled every HTML response from scratch — measured on the live
 * site, every page carried `x-nextjs-cache: MISS`, on every request, for
 * pages that had not changed since the build.
 *
 * That is what the Workers Free plan's 10ms of CPU per request was being
 * spent on, and why the site was answering ~2% of visits with error 1102:
 * 4.27k Worker invocations in a day, 88 of them killed, and a CPU time P90 of
 * 219ms against a 10ms ceiling.
 *
 * `staticAssetsIncrementalCache` is the answer and its own docstring says so:
 * "It should only be used for applications that do NOT want revalidation and
 * ONLY want to serve prerendered data." That is this site exactly. Prerendered
 * pages are read straight from the ASSETS binding — which is served off
 * Cloudflare's edge, free and unmetered, and never invokes anything.
 *
 * `enableCacheInterception` is the other half: it answers a cacheable request
 * before Next's routing and rendering pipeline runs, rather than after. Safe
 * here because the site does not use PPR — the one case the adapter says to
 * keep it off for.
 *
 * Neither costs anything and neither needs a dashboard. Whether it is *enough*
 * to keep a free Worker under 10ms is a question only the deployed error count
 * can answer.
 *
 * ── still not configured, still on purpose ───────────────────────
 *   - No R2 or KV cache. Those exist for revalidation, which this site has
 *     none of: nothing is `revalidate`d and no page is built on demand.
 *   - No image binding. Images do not go through Next's optimizer at all;
 *     `next.config.ts` hands them to a custom loader that rewrites them onto
 *     Cloudflare Image Transformations. See `image-loader.ts`.
 */
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
