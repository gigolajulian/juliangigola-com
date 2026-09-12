/**
 * Worker secrets, which `wrangler types` cannot know about.
 *
 * A secret is set with `wrangler secret put` and deliberately does not appear
 * in `wrangler.jsonc` — so the generated `cloudflare-env.d.ts` has no way to
 * see it. Declared here by hand, merged into the same interface.
 *
 * Optional, every one of them: the type has to admit that a secret may not be
 * set, because that is exactly the case the code has to handle. `INBOX_KEY`
 * unset means /admin's Inbox refuses to open rather than serving somebody's
 * enquiries to whoever asks.
 */
interface CloudflareEnv {
  /**
   * Opens the inbox. Set with:
   *
   *   wrangler secret put INBOX_KEY
   *
   * Any long random string. Pasted into /admin once, kept in that browser's
   * `localStorage` beside the GitHub token, and sent as `x-inbox-key`.
   */
  INBOX_KEY?: string;
}
