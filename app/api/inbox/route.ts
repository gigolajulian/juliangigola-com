import { SAFE_IMAGE, summary, type Enquiry, type Summary } from "@/lib/leads/enquiry";
import { gate } from "@/lib/leads/desk-route";
import { everyKey } from "@/lib/kv";
import { bodyOf, json, NO_STORE } from "@/lib/http";
import { parseOr } from "@/lib/json";

/* ── the inbox ───────────────────────────────────────────────────
 * The enquiries behind /admin's Inbox tab and a lead's first message:
 * - GET: the list, `?key=msg:...` one message, `?key=ref:msg:...` an image it came with.
 * - PATCH `{ key, read }`: a message read or unread.
 * - DELETE `{ key }`: a message and its images, for good.
 * The leads themselves are under /api/leads. Behind the /admin gate (`gate`, `lib/leads/desk-route.ts`).
 *
 * Not cached, anywhere, ever. `no-store` on every response and no
 * revalidation: this is somebody else's personal data and a shared cache is
 * the wrong place for it.
 * ─────────────────────────────────────────────────────────────── */

/** Never prerender, never cache: the answer depends on a header. */
export const dynamic = "force-dynamic";

/**
 * GET: the list, newest first.
 *
 * One `list` call and no reads: the summary each row shows travels in KV's
 * metadata (see `lib/leads/enquiry.ts`). `?key=` fetches one message's body, which is
 * the only time the value itself is needed.
 */
export async function GET(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;

  const wanted = new URL(request.url).searchParams.get("key");

  // One of the images an enquiry arrived with (`lib/leads/enquiry-action.ts`).
  if (wanted?.startsWith("ref:msg:")) {
    const got = await g.kv.getWithMetadata<{ type?: string }>(wanted, "arrayBuffer");
    if (got.value === null) return json({ error: "Gone." }, 404);
    // Anything stored before the check, or not a plain picture, goes out
    // as a download that cannot run (`SAFE_IMAGE`, lib/leads/enquiry.ts).
    const type = got.metadata?.type ?? "image/jpeg";
    const safe = SAFE_IMAGE.test(type);
    return new Response(got.value, {
      headers: {
        ...NO_STORE,
        "content-type": safe ? type : "application/octet-stream",
        "x-content-type-options": "nosniff",
        ...(safe ? {} : { "content-disposition": "attachment" }),
      },
    });
  }

  if (wanted) {
    if (!wanted.startsWith("msg:")) return json({ error: "Unknown." }, 400);
    const body = await g.kv.get(wanted);
    if (body === null) return json({ error: "Gone." }, 404);
    const enquiry = parseOr<Enquiry | null>(body, null);
    if (!enquiry) return json({ error: "Unreadable." }, 500);
    return json({ enquiry });
  }

  // Keys sort oldest first because the timestamp leads them, so a single
  // page of 400 kept the oldest and dropped the newest: read every page,
  // then the inbox reads the other way round.
  const keys: { name: string; metadata?: Summary }[] = [];
  for await (const k of everyKey<Summary>(g.kv, "msg:")) keys.push(k);
  const rows = keys.map((k) => ({ key: k.name, ...k.metadata })).reverse();

  return json({ rows });
}

/** PATCH `{ key: "msg:...", read }`: an enquiry read or unread. */
export async function PATCH(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;

  const given = await bodyOf(request);
  if (!given) return json({ error: "Not JSON." }, 400);
  const key = typeof given.key === "string" ? given.key : "";
  const read = given.read;
  if (!key.startsWith("msg:") || typeof read !== "boolean")
    return json({ error: "Unknown." }, 400);

  const body = await g.kv.get(key);
  if (body === null) return json({ error: "Gone." }, 404);
  const was = parseOr<Enquiry | null>(body, null);
  // Unreadable stays as it is: a put of `{ read }` alone would wipe the enquiry.
  if (!was) return json({ error: "Unreadable." }, 500);

  const next: Enquiry = { ...was, read };
  // Written back with its metadata, because a put without it drops what the
  // list reads: the row would go blank while the message stayed perfectly
  // intact, which is a confusing way to lose an enquiry.
  await g.kv.put(key, JSON.stringify(next), { metadata: summary(next) });
  return json({ ok: true });
}

/**
 * DELETE: remove one, for good.
 *
 * No bin and no undo, unlike a project in /admin. A project is work that took
 * a day to make and the files are ours; an enquiry is a message that has been
 * read and answered, and keeping somebody's name and email after it has been
 * dealt with is the wrong default. Answered then deleted is the intended
 * shape of this inbox.
 */
export async function DELETE(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;

  const given = await bodyOf(request);
  if (!given) return json({ error: "Not JSON." }, 400);
  const key = typeof given.key === "string" ? given.key : "";
  if (!key.startsWith("msg:")) return json({ error: "Unknown." }, 400);

  await g.kv.delete(key);
  // And the images it arrived with.
  const refs = await g.kv.list({ prefix: `ref:${key}:` });
  await Promise.all(refs.keys.map((k: { name: string }) => g.kv.delete(k.name)));
  return json({ ok: true });
}
