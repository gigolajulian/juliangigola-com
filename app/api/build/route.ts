/* ── which commit is live ──────────────────────────────────────────
 * The build stamp: the commit this deploy was built from, baked in at
 * build time (`BUILD_SHA` in next.config.ts). `scripts/live-check.mjs`
 * compares it with main after a deploy, so a deploy that didn't land, or
 * an older build that overwrote a newer one, shows up. No secrets: the
 * repo is public.
 * ─────────────────────────────────────────────────────────────── */

import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  return json({ sha: process.env.BUILD_SHA ?? "local" });
}
