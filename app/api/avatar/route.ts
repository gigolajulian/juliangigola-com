import { bearer, canPush } from "@/lib/vouch";

/* ── fetching a collaborator's face, once ─────────────────────────
 * /admin asks this for a handle and gets back a small JPEG, which it then
 * commits to the repository as `public/people/<handle>.jpg`. From then on
 * the picture is the site's own file and nothing here runs again.
 *
 * Why the site cannot simply link the picture: Instagram serves profile
 * photographs from a CDN address that is signed and expires within days.
 * A page holding one would print broken circles by the end of the week.
 *
 * Why this is a route and not a fetch in the browser: Instagram sends no
 * CORS headers, so /admin cannot read the page itself.
 *
 * Why a link-preview user agent: logged out, Instagram answers a browser
 * with an empty JavaScript shell and answers a link preview with the page's
 * meta tags — which is how the handle pasted into any chat app draws a
 * thumbnail. That is the only free way to the picture: the old Basic
 * Display API was retired at the end of 2024, the Graph API answers only
 * for accounts that have authorised an app, and the avatar services that
 * used to do this now charge for Instagram.
 *
 * It is a fetch Instagram has not invited, so it is kept to the smallest
 * version of itself: one request, made by Julian, for one person, once.
 * The live site never calls this. If Instagram stops answering, or refuses
 * a datacentre address, the panel says so and Julian picks a file instead.
 *
 * Behind the same gate as the inbox: a GitHub token that can push to the
 * repository. Without it this is an open proxy for fetching arbitrary
 * Instagram pages through Julian's domain.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json",
    },
  });

/** Instagram's own alphabet, the same rule `lib/added.ts` holds a handle to. */
const HANDLE = /^[a-z0-9_][a-z0-9._]{0,29}$/;

/** What a chat app sends, and what Instagram answers with meta tags. */
const CRAWLER = "facebookexternalhit/1.1";

/** A profile photograph is a few kB. Anything larger is not one. */
const MOST = 400 * 1024;

export async function POST(request: Request) {
  const token = bearer(request);
  if (!token || !(await canPush(token)))
    return json({ error: "Not authorised." }, 401);

  let handle = "";
  try {
    const body = (await request.json()) as { handle?: unknown };
    handle = typeof body.handle === "string" ? body.handle.toLowerCase() : "";
  } catch {
    return json({ error: "Expected JSON." }, 400);
  }
  // The handle goes into a URL. Nothing but Instagram's own alphabet gets
  // there, so a pasted path or address cannot point this at another host.
  if (!HANDLE.test(handle)) return json({ error: "Not a handle." }, 400);

  try {
    const page = await fetch(`https://www.instagram.com/${handle}/`, {
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": CRAWLER, accept: "text/html" },
    });
    if (!page.ok) {
      await page.body?.cancel();
      return json({ error: "Instagram did not answer." }, 502);
    }
    const html = await page.text();
    const found = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1];
    if (!found) return json({ error: "No picture on that profile." }, 404);

    const src = found.replaceAll("&amp;", "&");
    // The picture comes from Instagram's own CDN or it does not come.
    const host = new URL(src).hostname;
    if (!/(^|\.)cdninstagram\.com$|(^|\.)fbcdn\.net$/.test(host))
      return json({ error: "That picture is not Instagram's." }, 502);

    const shot = await fetch(src, {
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": CRAWLER },
    });
    const type = shot.headers.get("content-type") ?? "";
    if (!shot.ok || !type.startsWith("image/")) {
      await shot.body?.cancel();
      return json({ error: "The picture would not download." }, 502);
    }
    const bytes = new Uint8Array(await shot.arrayBuffer());
    if (!bytes.length || bytes.length > MOST)
      return json({ error: "That is not a profile picture." }, 502);

    /* Handed back as a data URL, because what /admin does with it is commit
       it to the repository through GitHub's API, which takes base64 — the
       same road every frame uploaded in the panel already travels. */
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return json({
      src: `data:${type};base64,${btoa(binary)}`,
      bytes: bytes.length,
      type,
    });
  } catch {
    // A timeout, a refusal, a shape that has changed: all the same answer.
    // The panel offers the file picker and the day carries on.
    return json({ error: "Could not reach Instagram." }, 502);
  }
}
