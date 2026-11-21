import { getCloudflareContext } from "@opennextjs/cloudflare";
import { refuseAdmin } from "@/lib/vouch";
import { SAFE_IMAGE, summary, type Enquiry, type Summary } from "@/lib/inbox";
import { backfillLead, trashDaysLeft, type InboxRow, type Lead, type LeadSummary, type Stage } from "@/lib/leads/leads";
import { buryLead, everyLead, findLead, readLead, writeLead } from "@/lib/leads/lead-store";
import { clientsCsv } from "@/lib/leads/sheet-sync";
import { importNotion } from "@/lib/leads/notion-import";
import { eventsCsv, readLog, readMaster } from "@/lib/leads/activity-log";
import { sealer } from "@/lib/leads/lead-crypto";
import { notify, subscribe, unsubscribe } from "@/lib/leads/lead-push";
import { publicKey } from "@/lib/leads/web-push";
import { importStripe } from "@/lib/leads/stripe-import";
import { STRIPE_UNSET } from "@/lib/stripe";
import { cleanTemplates, manualLead, stats, type NewLead } from "@/lib/leads/lead-crm";
import { cleanFrom, FROM_KEY, invoiceNo, invoicesTaken, PHOTO_KEY, type InvoiceFrom } from "@/lib/leads/invoice";
import { bodyOf, json, NO_STORE } from "@/lib/http";
import { parseOr } from "@/lib/json";
import { patchLead } from "@/lib/leads/lead-patch";
import { secretJson } from "@/lib/secrets";

/** Where his reply templates live: not personal data, so plain JSON. */
const TEMPLATES_KEY = "leads:templates";

/** What a lead read or write answers on a Worker without LEADS_KEY. */
const noSeal = () => json({ error: "Leads need LEADS_KEY on the Worker." }, 503);

/** Every key under a prefix, page after page: one KV list stops at 1000. */
async function* everyKey<M>(inbox: NonNullable<CloudflareEnv["INBOX"]>, prefix: string) {
  let cursor: string | undefined;
  for (;;) {
    const listed = await inbox.list<M>({ prefix, cursor });
    yield* listed.keys;
    if (listed.list_complete) return;
    cursor = listed.cursor;
  }
}

/* ── reading the inbox ────────────────────────────────────────────
 * The endpoint behind /admin's Inbox tab and the Leads desk. The mode is
 * picked by the query string (GET) or the body (the rest):
 * - GET: enquiries, leads, the activity log, stats, templates, invoices,
 *   CSVs, the VAPID public key.
 * - PATCH: push subscribe and test, the invoice From and photo, a lead,
 *   templates, an enquiry read or unread.
 * - DELETE: an enquiry, or the emptied lead trash.
 * - POST: a new lead, the Notion and Stripe imports, the inbox backfill.
 *
 * Opens with the /admin credentials in `lib/vouch.ts`: the `INBOX_KEY`
 * header, compared in constant time, or a GitHub token that can push. Its
 * own guard keeps a separate message for a token GitHub refused. With
 * neither set, it refuses everything: an enquiry carries somebody's name,
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

/**
 * A lead deleted for good (Empty trash, or 30 days in it) leaves `gone:<id>`
 * behind, so "Import from Inbox" does not bring it back from the person's
 * old rows. The id is the HMAC, never the address. A new message still
 * starts a fresh lead.
 */

/** The binding and the secret, or `null` when this build has neither. */
async function wired() {
  const { env } = await getCloudflareContext({ async: true });
  return env.INBOX ? { inbox: env.INBOX, seal: sealer(env.LEADS_KEY), notion: env.NOTION_TOKEN, vapid: env.VAPID_KEY, env } : null;
}

async function guard(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  // Who is asking first: what this build is missing is for /admin only.
  // The admin gate (`isAdmin`): the inbox key, or a GitHub token that can push.
  const denied = await refuseAdmin(request, env.INBOX_KEY);
  if (denied) return { error: denied };
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
  return { inbox: rig.inbox, seal: rig.seal, notion: rig.notion, vapid: rig.vapid, env: rig.env };
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

  // One of the images an enquiry arrived with (`lib/leads/enquiry-action.ts`).
  if (wanted?.startsWith("ref:msg:")) {
    const got = await gate.inbox.getWithMetadata<{ type?: string }>(wanted, "arrayBuffer");
    if (got.value === null) return json({ error: "Gone." }, 404);
    // Anything stored before the check, or not a plain picture, goes out
    // as a download that cannot run (`SAFE_IMAGE`, lib/inbox.ts).
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

  // The key a device subscribes to pushes with. Public by nature, still gated.
  if (url.searchParams.has("vapid")) {
    if (!gate.vapid) return json({ error: "Push needs VAPID_KEY on the Worker." }, 503);
    return json({ key: publicKey(secretJson<JsonWebKey>(gate.vapid, "VAPID_KEY")) });
  }

  // His reply templates, or the defaults.
  if (url.searchParams.has("templates")) {
    const saved = await gate.inbox.get(TEMPLATES_KEY);
    return json({ templates: cleanTemplates(parseOr(saved, undefined)) });
  }
  // His details for invoices, and the number the next one on a date would get.
  if (url.searchParams.has("invoiceFrom") || url.searchParams.has("invoiceNo")) {
    const seal = await gate.seal;
    if (!seal) return noSeal();
    const raw = await gate.inbox.get(FROM_KEY);
    const from = raw ? cleanFrom(await seal.open<InvoiceFrom>(raw)) : null;
    const date = url.searchParams.get("invoiceNo") ?? "";
    return json({ from, ...(/^\d{4}-\d{2}-\d{2}$/.test(date) ? { no: invoiceNo(date, await invoicesTaken(gate.inbox, date)) } : {}) });
  }
  // A design B invoice's photo, sealed like the lead it belongs to.
  if (url.searchParams.has("invoicePhoto")) {
    const seal = await gate.seal;
    if (!seal) return noSeal();
    const key = url.searchParams.get("invoicePhoto") ?? "";
    const raw = PHOTO_KEY.test(key) ? await gate.inbox.get(key) : null;
    return raw ? json({ photo: await seal.open<string>(raw) }) : json({ error: "Photo not found." }, 404);
  }
  // Every invoice on every lead, newest first, for Money > Invoices and Today's overdue list. Trashed leads are left out.
  // shortcut: one KV get per lead; an invoice index if the desk ever holds thousands of leads.
  if (url.searchParams.has("invoices")) {
    const seal = await gate.seal;
    if (!seal) return noSeal();
    const invoices = (await everyLead(gate.inbox, seal))
      .filter((l) => !l.trashedAt)
      .flatMap((l) => (l.invoices ?? []).map((i) => ({ ...i, lead: l.id, name: l.name })))
      .sort((a, b) => b.at.localeCompare(a.at));
    return json({ invoices });
  }
  // One client's whole activity log (`lib/leads/activity-log.ts`).
  if (url.searchParams.has("log")) {
    const seal = await gate.seal;
    if (!seal) return noSeal();
    return json({ log: await readLog(gate.inbox, seal, (url.searchParams.get("log") ?? "").replace(/^lead:/, "")) });
  }
  // The numbers, every lead as CSV (`lib/leads/lead-crm.ts`), or every event as CSV (`?csv=events`).
  if (url.searchParams.has("stats") || url.searchParams.has("csv")) {
    const seal = await gate.seal;
    if (!seal) return noSeal();
    const day = new Date().toISOString().slice(0, 10);
    const file = (body: string, name: string) => new Response(body, { headers: { ...NO_STORE, "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}-${day}.csv"` } });
    if (url.searchParams.get("csv") === "events") return file(eventsCsv(await readMaster(gate.inbox, seal)), "activity");
    const master = await readMaster(gate.inbox, seal);
    if (url.searchParams.has("stats")) return json({ stats: stats(await everyLead(gate.inbox, seal), Date.now(), master) });
    return file(await clientsCsv(gate.inbox, seal, master), "leads");
  }

  // The lead desk (`components/leads/desk.tsx`): one record per person.
  // Sealed with LEADS_KEY (`lib/leads/lead-crypto.ts`), opened here and only here.
  if (wanted?.startsWith("lead:") || url.searchParams.has("leads")) {
    const seal = await gate.seal;
    if (!seal) return noSeal();
    if (wanted) {
      const lead = await readLead(gate.inbox, seal, wanted.slice(5));
      return lead ? json({ lead }) : json({ error: "Gone." }, 404);
    }
    const leads: LeadSummary[] = [];
    for await (const k of everyKey<{ s?: string }>(gate.inbox, "lead:")) {
      if (!k.metadata?.s) continue;
      const one = await seal.open<LeadSummary>(k.metadata.s);
      // Trash empties itself: 30 days after it went in, the lead goes for good.
      // The list is the only reader, so it is the one place that checks.
      if (one.trashedAt && trashDaysLeft(one.trashedAt, Date.now()) <= 0) {
        await buryLead(gate.inbox, k.name, seal);
        continue;
      }
      leads.push({ ...one, id: k.name.slice(5) });
    }
    return json({ leads: leads.sort((a, b) => b.lastAt.localeCompare(a.lastAt)) });
  }

  if (wanted) {
    if (!wanted.startsWith("msg:")) return json({ error: "Unknown." }, 400);
    const body = await gate.inbox.get(wanted);
    if (body === null) return json({ error: "Gone." }, 404);
    const enquiry = parseOr<Enquiry | null>(body, null);
    if (!enquiry) return json({ error: "Unreadable." }, 500);
    return json({ enquiry });
  }

  // Keys sort oldest first because the timestamp leads them, so a single
  // page of 400 kept the oldest and dropped the newest: read every page,
  // then the inbox reads the other way round.
  const keys: { name: string; metadata?: Summary }[] = [];
  for await (const k of everyKey<Summary>(gate.inbox, "msg:")) keys.push(k);
  const rows = keys.map((k) => ({ key: k.name, ...k.metadata })).reverse();

  return json({ rows });
}

/** PATCH: the desk's writes, told apart by the body's shape and taken in this order, so the first match wins:
    `push` (a device subscribing or, with `off`, unsubscribing), `test: true` (a test notification),
    `invoiceFrom` (the invoice's from block), `invoicePhoto` (a design B photo), `key: "lead:..."` (a lead's
    patch, `patchLead`), `templates` (the reply templates), then `key: "msg:..."` with `read` (an enquiry
    read or unread). Anything else is a 400. */
export async function PATCH(request: Request) {
  const gate = await guard(request);
  if (gate.error) return gate.error;

  const given = await bodyOf(request);
  if (!given) return json({ error: "Not JSON." }, 400);
  // The desk's notification switch: a device subscribing, or turning off.
  if (given.push !== undefined) {
    const sub = given.push as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    if (typeof sub?.endpoint !== "string" || !sub.endpoint.startsWith("https://")) return json({ error: "Bad subscription." }, 400);
    if (given.off === true) await unsubscribe(gate.inbox, sub.endpoint);
    else if (typeof sub.keys?.p256dh === "string" && typeof sub.keys.auth === "string")
      await subscribe(gate.inbox, { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
    else return json({ error: "Bad subscription." }, 400);
    return json({ ok: true });
  }
  // The desk's "Send a test": one ping to every device that turned these on.
  if (given.test === true) {
    if (!gate.vapid) return json({ error: "Push needs VAPID_KEY on the Worker." }, 503);
    const devices = (await gate.inbox.list({ prefix: "push:" })).keys.length;
    const send = () => notify(gate.inbox, gate.vapid!, { title: "Test notification", body: "Leads can reach this device.", url: "/admin/leads" });
    // 10 seconds later, so he can lock the phone: iOS shows no banner while the app is open.
    const { ctx } = (await getCloudflareContext({ async: true })) as { ctx?: { waitUntil(p: Promise<unknown>): void } };
    if (devices && ctx?.waitUntil) ctx.waitUntil(new Promise((r) => setTimeout(r, 10_000)).then(send));
    else if (devices) await send();
    return json({ devices });
  }
  if (given.invoiceFrom !== undefined) {
    const seal = await gate.seal;
    if (!seal) return noSeal();
    const from = cleanFrom(given.invoiceFrom);
    await gate.inbox.put(FROM_KEY, await seal.seal(from));
    return json({ from });
  }
  // A design B photo, already framed down by the desk: stored under its own hash, so the same photo is kept once.
  if (typeof given.invoicePhoto === "string") {
    const seal = await gate.seal;
    if (!seal) return noSeal();
    const photo = given.invoicePhoto;
    if (!photo.startsWith("data:image/jpeg;base64,") || photo.length > 4_000_000) return json({ error: "The photo must be a JPEG under 3 MB." }, 400);
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(photo)));
    const key = `invoice-photo:${[...hash.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
    if (!(await gate.inbox.get(key))) await gate.inbox.put(key, await seal.seal(photo));
    return json({ key });
  }
  if (typeof given.key === "string" && given.key.startsWith("lead:")) {
    const seal = await gate.seal;
    return seal ? patchLead(gate.inbox, seal, given, gate.notion) : noSeal();
  }
  // His reply templates, saved whole.
  if (given.templates !== undefined) {
    const templates = cleanTemplates(given.templates);
    await gate.inbox.put(TEMPLATES_KEY, JSON.stringify(templates));
    return json({ templates });
  }
  const { key, read } = given as { key?: string; read?: boolean };
  if (!key?.startsWith("msg:") || typeof read !== "boolean")
    return json({ error: "Unknown." }, 400);

  const body = await gate.inbox.get(key);
  if (body === null) return json({ error: "Gone." }, 404);
  const was = parseOr<Enquiry | null>(body, null);
  // Unreadable stays as it is: a put of `{ read }` alone would wipe the enquiry.
  if (!was) return json({ error: "Unreadable." }, 500);

  const next: Enquiry = { ...was, read };
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

  const given = await bodyOf(request);
  if (!given) return json({ error: "Not JSON." }, 400);
  const { key, emptyTrash } = given as { key?: string; emptyTrash?: boolean };
  // The lead desk's "Empty trash": every lead in the trash, deleted for good.
  // Their Inbox rows stay; the Inbox has its own trash.
  if (emptyTrash === true) {
    const seal = await gate.seal;
    if (!seal) return noSeal();
    const gone: string[] = [];
    for await (const k of everyKey<{ s?: string }>(gate.inbox, "lead:")) {
      if (k.metadata?.s && (await seal.open<LeadSummary>(k.metadata.s)).trashedAt) gone.push(k.name);
    }
    await Promise.all(gone.map((k) => buryLead(gate.inbox, k, seal)));
    return json({ ok: true, deleted: gone.length });
  }
  if (!key?.startsWith("msg:")) return json({ error: "Unknown." }, 400);

  await gate.inbox.delete(key);
  // And the images it arrived with.
  const refs = await gate.inbox.list({ prefix: `ref:${key}:` });
  await Promise.all(refs.keys.map((k: { name: string }) => gate.inbox.delete(k.name)));
  return json({ ok: true });
}

/**
 * POST {backfill: true, dry?: true}: the Inbox's `msg:` rows folded into
 * leads (`backfillLead`). Dry, it only counts: how many people, how many
 * new, and the stage each would end on. Rows stay, nothing is mailed,
 * Notion is not touched. A second run finds nothing to add.
 */
export async function POST(request: Request) {
  const gate = await guard(request);
  if (gate.error) return gate.error;
  const given = await bodyOf(request);
  // One rule for every import: only an explicit `dry: false` writes.
  const dry = given?.dry !== false;
  // A lead he adds by hand: a DM, a text, a referral.
  if (given?.add && typeof given.add === "object") {
    const seal = await gate.seal;
    if (!seal) return noSeal();
    const lead = manualLead(given.add as NewLead, new Date().toISOString());
    if ("error" in lead) return json(lead, 400);
    const id = await seal.id(lead.email);
    if (await readLead(gate.inbox, seal, id)) return json({ error: "That person is already a lead.", id }, 409);
    const on = lead.email.includes("@") ? await findLead(gate.inbox, seal, lead.email) : null;
    if (on?.lead) return json({ error: `That address is on ${on.lead.name}'s lead.`, id: on.id }, 409);
    await Promise.all((await seal.ids(lead.email)).map((i) => gate.inbox.delete(`gone:${i}`)));
    await writeLead(gate.inbox, seal, id, lead, null);
    return json({ lead, id });
  }
  // Past Notion rows as quiet leads (`lib/leads/notion-import.ts`, `scripts/import-notion.mjs`). Dry, it only counts.
  if (given && "importNotion" in given) {
    const seal = await gate.seal;
    if (!seal) return noSeal();
    try {
      return json(await importNotion(gate.inbox, seal, given.importNotion, dry));
    } catch (e) {
      return json({ error: String(e instanceof Error ? e.message : e) }, 400);
    }
  }
  // Past Stripe payments and refunds onto the log (`lib/leads/stripe-import.ts`). Dry, it only counts.
  if (given?.importStripe === true) {
    if (!gate.env.STRIPE_SECRET_KEY) return json({ error: STRIPE_UNSET }, 503);
    try {
      return json(await importStripe(gate.env, gate.env.STRIPE_SECRET_KEY, dry));
    } catch (e) {
      return json({ error: String(e instanceof Error ? e.message : e) }, 502);
    }
  }
  if (given?.backfill !== true) return json({ error: "Unknown." }, 400);
  const seal = await gate.seal;
  if (!seal) return noSeal();

  const people = new Map<string, InboxRow[]>();
  for await (const k of everyKey<Summary>(gate.inbox, "msg:")) {
    const m = k.metadata;
    const email = m?.email?.trim().toLowerCase();
    if (!m || !email?.includes("@")) continue;
    people.set(email, [...(people.get(email) ?? []), { key: k.name, at: m.at, type: m.type, name: m.name, email, read: m.read, detail: m.detail }]);
  }

  const stages: Partial<Record<Stage, number>> = {};
  let added = 0;
  let updated = 0;
  for (const [email, rows] of people) {
    const id = await seal.id(email);
    const gone = await Promise.all((await seal.ids(email)).map((i) => gate.inbox.get(`gone:${i}`)));
    if (gone.some((g: string | null) => g !== null)) continue;
    const before = await readLead(gate.inbox, seal, id);
    const after: Lead | null = backfillLead(before, email, rows);
    if (!after) continue;
    if (before) updated++;
    else {
      added++;
      stages[after.stage] = (stages[after.stage] ?? 0) + 1;
    }
    if (!dry) await writeLead(gate.inbox, seal, id, after);
  }
  return json({ dry, people: people.size, added, updated, stages });
}
