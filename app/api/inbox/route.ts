import { getCloudflareContext } from "@opennextjs/cloudflare";
import { authorised, bearer, canPush } from "@/lib/vouch";
import { SAFE_IMAGE, summary, type Enquiry, type Summary } from "@/lib/inbox";
import { backfillLead, fold, readLead, STAGES, trashDaysLeft, writeLead, type InboxRow, type Lead, type LeadSummary, type Stage } from "@/lib/leads";
import { sealer } from "@/lib/lead-crypto";
import { notify, subscribe, unsubscribe } from "@/lib/lead-push";
import { publicKey } from "@/lib/web-push";
import { notionStage } from "@/lib/notion-lead";
import { cleanTemplates, csv, manualLead, merge, stats, type NewLead } from "@/lib/lead-crm";

/** Where his reply templates live: not personal data, so plain JSON. */
const TEMPLATES_KEY = "leads:templates";

/** Every lead, opened in full: for the numbers and the export, never the list. */
async function everyLead(inbox: NonNullable<CloudflareEnv["INBOX"]>, seal: NonNullable<Awaited<ReturnType<typeof sealer>>>) {
  const out: Lead[] = [];
  let after: string | undefined;
  for (;;) {
    const listed = await inbox.list({ prefix: "lead:", cursor: after });
    for (const k of listed.keys) {
      const l = await readLead(inbox, seal, k.name.slice(5));
      if (l) out.push(l);
    }
    if (listed.list_complete) break;
    after = listed.cursor;
  }
  return out;
}

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
  "x-robots-tag": "noindex, nofollow",
} as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: NO_STORE });

/**
 * The request body, or null when it is not JSON.
 *
 * `request.json()` throws on a malformed body, and an exception out of a
 * route handler is a 500 — the Worker's generic error page, for a request
 * that was simply wrong. Anything past the key check is the admin panel and
 * sends well-formed JSON, but a route that can be made to throw is a route
 * that can be made to log, and a 400 says what happened.
 */
async function parsed(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * A lead deleted for good (Empty trash, or 30 days in it) leaves `gone:<id>`
 * behind, so "Import from Inbox" does not bring it back from the person's
 * old rows. The id is the HMAC, never the address. A new message still
 * starts a fresh lead.
 */
const bury = (inbox: NonNullable<CloudflareEnv["INBOX"]>, key: string) =>
  Promise.all([inbox.delete(key), inbox.put(`gone:${key.slice(5)}`, "")]);

/** The binding and the secret, or `null` when this build has neither. */
async function wired() {
  const { env } = await getCloudflareContext({ async: true });
  return env.INBOX ? { inbox: env.INBOX, key: env.INBOX_KEY, seal: sealer(env.LEADS_KEY), notion: env.NOTION_TOKEN, vapid: env.VAPID_KEY } : null;
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
  // Either credential opens it: the inbox key, or a GitHub token that can
  // push to the repository. The messages differ so a wrong one can be told
  // from a missing one — but never which characters were wrong.
  if (rig.key && (await authorised(request, rig.key)))
    return { inbox: rig.inbox, seal: rig.seal, notion: rig.notion, vapid: rig.vapid };

  const token = bearer(request);
  if (token) {
    if (await canPush(token)) return { inbox: rig.inbox, seal: rig.seal, notion: rig.notion, vapid: rig.vapid };
    return {
      error: json(
        { error: "GitHub did not accept that token for this repository." },
        401,
      ),
    };
  }
  return { error: json({ error: "Not authorized." }, 401) };
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

  // One of the images an enquiry arrived with (`app/contact/actions.ts`).
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
    return json({ key: publicKey(JSON.parse(gate.vapid) as JsonWebKey) });
  }

  // His reply templates, or the defaults.
  if (url.searchParams.has("templates")) {
    const saved = await gate.inbox.get(TEMPLATES_KEY);
    return json({ templates: cleanTemplates(saved ? JSON.parse(saved) : undefined) });
  }
  // The numbers, and every lead as CSV (`lib/lead-crm.ts`).
  if (url.searchParams.has("stats") || url.searchParams.has("csv")) {
    const seal = await gate.seal;
    if (!seal) return json({ error: "Leads need LEADS_KEY on the Worker." }, 503);
    const all = await everyLead(gate.inbox, seal);
    if (url.searchParams.has("stats")) return json({ stats: stats(all, Date.now()) });
    return new Response(csv(all), {
      headers: { ...NO_STORE, "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"` },
    });
  }

  // The lead desk (`components/admin-leads.tsx`): one record per person.
  // Sealed with LEADS_KEY (`lib/lead-crypto.ts`), opened here and only here.
  if (wanted?.startsWith("lead:") || url.searchParams.has("leads")) {
    const seal = await gate.seal;
    if (!seal) return json({ error: "Leads need LEADS_KEY on the Worker." }, 503);
    if (wanted) {
      const lead = await readLead(gate.inbox, seal, wanted.slice(5));
      return lead ? json({ lead }) : json({ error: "Gone." }, 404);
    }
    const leads: LeadSummary[] = [];
    let after: string | undefined;
    for (;;) {
      const listed = await gate.inbox.list<{ s?: string }>({ prefix: "lead:", cursor: after });
      for (const k of listed.keys as { name: string; metadata?: { s?: string } }[]) {
        if (!k.metadata?.s) continue;
        const one = await seal.open<LeadSummary>(k.metadata.s);
        // Trash empties itself: 30 days after it went in, the lead goes for good.
        // The list is the only reader, so it is the one place that checks.
        if (one.trashedAt && trashDaysLeft(one.trashedAt, Date.now()) <= 0) {
          await bury(gate.inbox, k.name);
          continue;
        }
        leads.push({ ...one, id: k.name.slice(5) });
      }
      if (listed.list_complete) break;
      after = listed.cursor;
    }
    return json({ leads: leads.sort((a, b) => b.lastAt.localeCompare(a.lastAt)) });
  }

  if (wanted) {
    if (!wanted.startsWith("msg:")) return json({ error: "Unknown." }, 400);
    const body = await gate.inbox.get(wanted);
    if (body === null) return json({ error: "Gone." }, 404);
    return json({ enquiry: JSON.parse(body) as Enquiry });
  }

  // Keys sort oldest first because the timestamp leads them, so a single
  // page of 400 kept the oldest and dropped the newest: read every page,
  // then the inbox reads the other way round.
  const keys: { name: string; metadata?: Summary }[] = [];
  let cursor: string | undefined;
  for (;;) {
    const listed = await gate.inbox.list<Summary>({ prefix: "msg:", cursor });
    keys.push(...listed.keys);
    if (listed.list_complete) break;
    cursor = listed.cursor;
  }
  const rows = keys.map((k) => ({ key: k.name, ...k.metadata })).reverse();

  return json({ rows, complete: true });
}

/** PATCH — mark one read or unread. The only thing a row's state can be. */
export async function PATCH(request: Request) {
  const gate = await guard(request);
  if (gate.error) return gate.error;

  const given = await parsed(request);
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
  if (typeof given.key === "string" && given.key.startsWith("lead:")) return patchLead(gate.inbox, await gate.seal, given, gate.notion);
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

  const given = await parsed(request);
  if (!given) return json({ error: "Not JSON." }, 400);
  const { key, emptyTrash } = given as { key?: string; emptyTrash?: boolean };
  // The lead desk's "Empty trash": every lead in the trash, deleted for good.
  // Their Inbox rows stay; the Inbox has its own trash.
  if (emptyTrash === true) {
    const seal = await gate.seal;
    if (!seal) return json({ error: "Leads need LEADS_KEY on the Worker." }, 503);
    const gone: string[] = [];
    let after: string | undefined;
    for (;;) {
      const listed = await gate.inbox.list<{ s?: string }>({ prefix: "lead:", cursor: after });
      for (const k of listed.keys as { name: string; metadata?: { s?: string } }[]) {
        if (k.metadata?.s && (await seal.open<LeadSummary>(k.metadata.s)).trashedAt) gone.push(k.name);
      }
      if (listed.list_complete) break;
      after = listed.cursor;
    }
    await Promise.all(gone.map((k) => bury(gate.inbox, k)));
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
  const given = await parsed(request);
  // A lead he adds by hand: a DM, a text, a referral.
  if (given?.add && typeof given.add === "object") {
    const seal = await gate.seal;
    if (!seal) return json({ error: "Leads need LEADS_KEY on the Worker." }, 503);
    const lead = manualLead(given.add as NewLead, new Date().toISOString());
    if ("error" in lead) return json(lead, 400);
    const id = await seal.id(lead.email);
    if (await readLead(gate.inbox, seal, id)) return json({ error: "That person is already a lead.", id }, 409);
    await Promise.all((await seal.ids(lead.email)).map((i) => gate.inbox.delete(`gone:${i}`)));
    await writeLead(gate.inbox, seal, id, lead);
    return json({ lead, id });
  }
  if (given?.backfill !== true) return json({ error: "Unknown." }, 400);
  const seal = await gate.seal;
  if (!seal) return json({ error: "Leads need LEADS_KEY on the Worker." }, 503);

  const people = new Map<string, InboxRow[]>();
  let cursor: string | undefined;
  for (;;) {
    const listed = await gate.inbox.list<Summary>({ prefix: "msg:", cursor });
    for (const k of listed.keys) {
      const m = k.metadata;
      const email = m?.email?.trim().toLowerCase();
      if (!m || !email?.includes("@")) continue;
      people.set(email, [...(people.get(email) ?? []), { key: k.name, at: m.at, type: m.type, name: m.name, email, read: m.read, detail: m.detail }]);
    }
    if (listed.list_complete) break;
    cursor = listed.cursor;
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
    if (given.dry !== true) await writeLead(gate.inbox, seal, id, after);
  }
  return json({ dry: given.dry === true, people: people.size, added, updated, stages });
}

/**
 * A lead changed by hand: its stage, a snooze (an ISO time, or "" to wake
 * it), opened (`seen`) or marked unread (`seen: false`). Stage and snooze go through `fold`, so they land
 * on the timeline like everything else.
 */
async function patchLead(inbox: NonNullable<CloudflareEnv["INBOX"]>, seal: Awaited<ReturnType<typeof sealer>>, given: Record<string, unknown>, notion?: string) {
  if (!seal) return json({ error: "Leads need LEADS_KEY on the Worker." }, 503);
  const { key, stage, snoozeUntil, seen, archive, trash } = given as { key: string; stage?: string; snoozeUntil?: string; seen?: boolean; archive?: boolean; trash?: boolean };
  const { notes, remind, details, quote, lostReason, mergeFrom } = given as {
    notes?: string;
    remind?: { at?: string; text?: string } | null;
    details?: { name?: string; phone?: string; ig?: string; company?: string; source?: string; kind?: string };
    quote?: number | null;
    lostReason?: string;
    mergeFrom?: string;
  };
  if (remind && (typeof remind.at !== "string" || isNaN(Date.parse(remind.at)))) return json({ error: "Bad time." }, 400);
  if (quote !== undefined && quote !== null && !(typeof quote === "number" && quote >= 0 && quote < 1e7)) return json({ error: "Bad amount." }, 400);
  if (stage !== undefined && !(STAGES as readonly string[]).includes(stage)) return json({ error: "Unknown stage." }, 400);
  if (snoozeUntil !== undefined && snoozeUntil !== "" && isNaN(Date.parse(snoozeUntil))) return json({ error: "Bad time." }, 400);
  const id = key.slice(5);
  let lead = await readLead(inbox, seal, id);
  if (!lead) return json({ error: "Gone." }, 404);
  const at = new Date().toISOString();
  if (stage) {
    lead = fold(lead, lead.email, { event: { at, kind: "stage", note: stage }, stage: stage as Stage });
    // Mirrored to the Notion board; a Notion failure never blocks the desk.
    const page = await notionStage(notion, lead.email, stage as Stage, lead.notion);
    if (page) lead.notion = page;
  }
  if (snoozeUntil !== undefined) lead = fold(lead, lead.email, { event: { at, kind: "snooze", note: snoozeUntil || "woken" }, snoozeUntil });
  if (typeof archive === "boolean") lead = fold(lead, lead.email, { event: { at, kind: "archive", note: archive ? "in" : "out" }, on: archive });
  if (typeof trash === "boolean") lead = fold(lead, lead.email, { event: { at, kind: "trash", note: trash ? "in" : "out" }, on: trash });
  // Opened (true), or marked unread again by hand (false).
  if (typeof seen === "boolean") lead = { ...lead, unread: !seen };
  // His own words and numbers (`lib/lead-crm.ts`).
  const cut = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined);
  if (typeof notes === "string") lead = { ...lead, notes: cut(notes, 5000) };
  if (remind !== undefined) {
    const r = remind ? { at: new Date(remind.at!).toISOString(), text: cut(remind.text, 200) ?? "" } : undefined;
    lead = { ...lead, remind: r, events: [...lead.events, { at, kind: "remind" as const, note: r ? r.at : "" }].slice(-50) };
  }
  if (details) {
    const d = {
      name: cut(details.name, 80) ?? lead.name,
      phone: cut(details.phone, 40),
      ig: cut(details.ig, 31)?.replace(/^@?/, "@"),
      company: cut(details.company, 80),
      source: cut(details.source, 40),
      kind: cut(details.kind, 40)?.toLowerCase() ?? lead.kind,
    };
    lead = { ...lead, ...d, events: [...lead.events, { at, kind: "edit" as const }].slice(-50) };
  }
  if (quote !== undefined) lead = { ...lead, quote: quote ?? undefined, events: [...lead.events, { at, kind: "quote" as const, note: quote === null ? "" : String(quote) }].slice(-50) };
  if (typeof lostReason === "string") lead = { ...lead, lostReason: cut(lostReason, 80) };
  // Another record of the same person folded into this one; the other goes for good.
  if (typeof mergeFrom === "string" && mergeFrom.startsWith("lead:") && mergeFrom !== key) {
    const other = await readLead(inbox, seal, mergeFrom.slice(5));
    if (!other) return json({ error: "Gone." }, 404);
    lead = merge(lead, other, at);
    await bury(inbox, mergeFrom);
  }
  for (const k of Object.keys(lead) as (keyof Lead)[]) if (lead[k] === undefined) delete lead[k];
  await writeLead(inbox, seal, id, lead);
  return json({ lead });
}
