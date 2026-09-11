import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * How `next build`'s output is turned into a Cloudflare Worker.
 *
 * Deliberately bare. The adapter's defaults cover everything this site does —
 * prerendered pages as static assets, the contact form's Server Action as a
 * Worker invocation, and the redirects out of `next.config.ts`.
 *
 * Two things are NOT configured here on purpose:
 *
 *   - No incremental cache. Every page is prerendered at build time
 *     (`generateStaticParams` covers both dynamic routes) and nothing
 *     revalidates, so there is no ISR to persist. Adding a KV or R2 cache
 *     would be infrastructure for a feature the site does not use.
 *   - No image binding. Images do not go through Next's optimizer at all;
 *     `next.config.ts` hands them to a custom loader that rewrites them onto
 *     Cloudflare Image Transformations. See `image-loader.ts`.
 */
export default defineCloudflareConfig();
