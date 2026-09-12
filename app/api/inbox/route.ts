import { getCloudflareContext } from "@opennextjs/cloudflare";
import { summary, type Enquiry, type Summary } from "@/lib/inbox";

/* ── reading the inbox ────────────────────────────────────────────
 * The one endpoint /admin's Inbox tab talks to. Lists enquiries, opens one,
 * marks it read, deletes it.
 *
 * Everything else in /admin is authorised by a GitHub token: the browser
 * holds it, GitHub checks it, and nothing on this site has an opinion. That
 * cannot work here, because the thing being protected is on this site — so
 * this route is the one place that does need a secret of its own.
 *
 * `INBOX_KEY`, set as a Worker secret and pasted into /admin once, exactly
 * like the GitHub token beside it. Compared in constant time, and the route
 * refuses everything when it is unset: an enquiry carries somebody's name,
 * their email and what they want, and the failure to get wrong is the one
 * where that is readable by whoever asks. Cloudflare Access in front of
 * /admin is still worth having, but it is not what stands between the public
 * and this data.
 *
 * Not cached, anywhere, ever. `no-store` on every response and no
 * revalidation: this is somebody else's personal data and a shared cache is
 * the wrong place for it.
 * ─────────────────────────────────────────────────────────────── */

/** Never prerender, never cache: the answer depends on a header. */
export const dynamic = "force-dynamic";

const NO_STORE = {
  "cache-control": "no-store, no-cache, must-revalidate",
  "content-type": "application/json",
} as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: NO_STORE });

/**
 * Whether the request carries the right key.
 *
 * Constant-time, so the comparison cannot be used to learn the key one
 * character at a time. Both sides are hashed first, which fixes the length —
 * otherwise the loop below would return early on a shorter guess and the
 * key's own length would leak.
 *
 * Written out rather than calling the runtime's `timingSafeEqual`: this is
 * thirty-two fixed iterations of XOR, it is the same guarantee, and it runs
 * in a test under Node without a Workers shim.
 */
async function authorised(request: Request, expected?: string) {
  if (!expected) return false;
  const given = request.headers.get("x-inbox-key");
  if (!given) return false;

  const digest = async (s: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    );
  const [a, b] = await Promise.all([digest(given), digest(expected)]);

  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** The binding and the secret, or `null` when this build has neither. */
async function wired() {
  const { env } = await getCloudflareContext({ async: true });
  return env.INBOX ? { inbox: env.INBOX, key: env.INBOX_KEY } : null;
}

async function guard(request: Request) {
  const rig = await wired();
  if (!rig) {
    return {
      error: json(
        {
          error:
            "This build has no inbox attached. Deploy with the INBOX namespace bound.",
        },
        503,
      ),
    };
  }
  if (!rig.key) {
    return {
      error: json(
        {
          error:
            "The inbox has no key set, so it is refusing to open. Run: wrangler secret put INBOX_KEY",
        },
        503,
      ),
    };
  }
  if (!(await authorised(request, rig.key))) {
    // Deliberately identical whether the key is wrong or missing.
    return { error: json({ error: "Not authorised." }, 401) };
  }
  return { inbox: rig.inbox };
}

/**
 * GET — the list, newest first.
 *
 * One `list` call and no reads: the summary each row shows travels in KV's
 * metadata (see `lib/inbox.ts`). `?id=` fetches one message's body, which is
 * the only time the value itself is needed.
 */
export async function GET(request: Request) {
  const gate = await guard(request);
  if (gate.error) return gate.error;

  const url = new URL(request.url);
  const wanted = url.searchParams.get("key");

  if (wanted) {
    if (!wanted.startsWith("msg:")) return json({ error: "Unknown." }, 400);
    const body = await gate.inbox.get(wanted);
    if (body === null) return json({ error: "Gone." }, 404);
    return json({ enquiry: JSON.parse(body) as Enquiry });
  }

  const listed = await gate.inbox.list<Summary>({ prefix: "msg:", limit: 400 });
  // Keys sort oldest first because the timestamp leads them; the inbox reads
  // the other way round.
  const rows = listed.keys
    .map((k: { name: string; metadata?: Summary }) => ({
      key: k.name,
      ...k.metadata,
    }))
    .reverse();

  return json({ rows, complete: listed.list_complete });
}

/** PATCH — mark one read or unread. The only thing a row's state can be. */
export async function PATCH(request: Request) {
  const gate = await guard(request);
  if (gate.error) return gate.error;

  const { key, read } = (await request.json()) as {
    key?: string;
    read?: boolean;
  };
  if (!key?.startsWith("msg:") || typeof read !== "boolean")
    return json({ error: "Unknown." }, 400);

  const body = await gate.inbox.get(key);
  if (body === null) return json({ error: "Gone." }, 404);

  const next: Enquiry = { ...(JSON.parse(body) as Enquiry), read };
  // Written back with its metadata, because a put without it drops what the
  // list reads — the row would go blank while the message stayed perfectly
  // intact, which is a confusing way to lose an enquiry.
  await gate.inbox.put(key, JSON.stringify(next), { metadata: summary(next) });
  return json({ ok: true });
}

/**
 * DELETE — remove one, for good.
 *
 * No bin and no undo, unlike a project in /admin. A project is work that took
 * a day to make and the files are ours; an enquiry is a message that has been
 * read and answered, and keeping somebody's name and email after it has been
 * dealt with is the wrong default. Answered then deleted is the intended
 * shape of this inbox.
 */
export async function DELETE(request: Request) {
  const gate = await guard(request);
  if (gate.error) return gate.error;

  const { key } = (await request.json()) as { key?: string };
  if (!key?.startsWith("msg:")) return json({ error: "Unknown." }, 400);

  await gate.inbox.delete(key);
  return json({ ok: true });
}
