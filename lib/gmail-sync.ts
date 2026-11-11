import { gcal } from "./booking/gcal";
import { sealer } from "./lead-crypto";
import { type Change } from "./leads";
import { canonLeads, readLead, recordLead, type LeadStore } from "./lead-store";

/* ── hello@'s Gmail on the lead timeline ─────────────────────────
 * Julian (2026-11-04): "your own Gmail replies on the timeline". Every ten
 * minutes the booking Worker's cron pings `app/api/leads/gmail`, which reads
 * what changed in hello@'s mailbox since last time (Gmail history, read-only
 * scope on the same `GCAL_OAUTH` token) and folds each mail into the lead it
 * is with: his sent mail as "replied", theirs as "wrote". Only people who are
 * already leads; the rest of his mail is never stored. The cursor is the
 * one plain value kept, a Gmail history id.
 * ─────────────────────────────────────────────────────────────── */

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
export const CURSOR = "gmail:history";
/** Messages read per run: the Worker's subrequest cap. The cursor resumes the rest next run. */
const BUDGET = 25;
const SKIP = ["SPAM", "TRASH", "DRAFT", "CHAT"];

export type Msg = { id: string; labelIds?: string[]; internalDate?: string; payload?: { headers?: { name: string; value: string }[] } };
type History = { history?: { id: string; messagesAdded?: { message: Msg }[] }[]; historyId?: string; nextPageToken?: string };

const ADDRESS = /[\w.+'-]+@[\w-]+(?:\.[\w-]+)+/g;
/** Addresses in a header, lowercased, minus his own domain (hello@, book@, the site's notifications). */
const people = (h: string) => [...h.matchAll(ADDRESS)].map((m) => m[0].toLowerCase()).filter((a) => !a.endsWith("@juliangigola.com"));

/** What one Gmail message means for leads: who it was with, and the event. */
export function mailChanges(m: Msg): { email: string; c: Change }[] {
  const labels = m.labelIds ?? [];
  if (labels.some((l) => SKIP.includes(l))) return [];
  const h = (n: string) => m.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? "";
  const event = { at: new Date(Number(m.internalDate)).toISOString(), ref: m.id, note: h("subject").slice(0, 120) || undefined };
  if (labels.includes("SENT")) return people(`${h("to")},${h("cc")}`).map((email) => ({ email, c: { event: { ...event, kind: "replied" as const } } }));
  const [email] = people(h("from"));
  const name = h("from").replace(/<[^>]*>/, "").replace(/"/g, "").trim();
  return email ? [{ email, c: { event: { ...event, kind: "wrote" as const }, ...(name && !name.includes("@") ? { name } : {}) } }] : [];
}

/** Reads what is new in hello@'s mailbox and folds it into leads. Returns how many lead events it handed over (a repeat folds in as a no-op). */
export async function syncGmail(env: LeadStore & { GCAL_OAUTH?: string }): Promise<number> {
  const kv = env.INBOX;
  const s = await sealer(env.LEADS_KEY);
  if (!kv || !s) return 0;
  await canonLeads(kv, s);
  const restart = async () => {
    const { historyId } = await gcal<{ historyId: string }>(env.GCAL_OAUTH, `${GMAIL}/profile`);
    await kv.put(CURSOR, historyId);
    return 0;
  };
  const start = await kv.get(CURSOR);
  // First run, nothing to read from: start from now. Mail before the sync is not backfilled.
  if (!start) return restart();

  let folded = 0;
  let read = 0;
  let cursor = start;
  let page: string | undefined;
  do {
    let h: History;
    try {
      h = await gcal<History>(env.GCAL_OAUTH, `${GMAIL}/history?startHistoryId=${start}&historyTypes=messageAdded${page ? `&pageToken=${page}` : ""}`);
    } catch (e) {
      // A cursor older than Gmail keeps (about a week): start again from now.
      if ((e as { status?: number }).status === 404) return restart();
      throw e;
    }
    for (const r of h.history ?? []) {
      const added = (r.messagesAdded ?? []).map((a) => a.message).filter((m) => !m.labelIds?.some((l) => SKIP.includes(l)));
      if (read + added.length > BUDGET && read > 0) {
        await kv.put(CURSOR, cursor);
        return folded;
      }
      for (const { id } of added) {
        read++;
        const m = await gcal<Msg>(env.GCAL_OAUTH, `${GMAIL}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject`);
        for (const { email, c } of mailChanges(m)) {
          // One lead that will not open must not stop the sync: the cursor would never move past it.
          try {
            // Only people already on the desk: a newsletter is not a lead.
            if (!(await readLead(kv, s, await s.id(email)))) continue;
            if (await recordLead(env, email, c)) folded++;
          } catch (e) {
            console.error("gmail sync lead", String(e));
          }
        }
      }
      cursor = r.id;
    }
    page = h.nextPageToken;
    if (!page && h.historyId) cursor = h.historyId;
  } while (page);
  await kv.put(CURSOR, cursor);
  return folded;
}
