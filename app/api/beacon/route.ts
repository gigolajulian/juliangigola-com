import { getCloudflareContext } from "@opennextjs/cloudflare";
import { parseBeacon } from "@/lib/beacon";

/* ── beacon ───────────────────────────────────────────────────────
 * Where `click-beacon.tsx` sends a page view's clicks and scroll depth.
 * Written to Analytics Engine (`BEACON`), which costs nothing to write and
 * keeps three months; /admin's SEO tab reads it back. Always 204, whatever
 * arrives, so a bad beacon tells a script nothing.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const done = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > 8_000) return done();
  let b;
  try {
    b = parseBeacon(JSON.parse(text));
  } catch {
    return done();
  }
  const { env } = await getCloudflareContext({ async: true });
  if (!b || !env.BEACON) return done();

  if (b.v) env.BEACON.writeDataPoint({ indexes: [b.p], blobs: [b.p, "view", "", b.dev], doubles: [0, 0, b.d] });
  for (const [x, y, label] of b.c) {
    env.BEACON.writeDataPoint({ indexes: [b.p], blobs: [b.p, "click", label, b.dev], doubles: [x, y, b.d] });
  }
  return done();
}
