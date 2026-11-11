/* ── the Google Sheet: a one-way copy of the lead desk ──────────────
 * Julian (2026-11-11): Notion retired; the site keeps a Sheet on hello@'s
 * Drive for viewing and backup. KV stays the record, nothing is read back.
 * Two tabs, rewritten whole from the desk's own CSVs: Clients (the ?csv
 * export) and Activity (?csv=events). The booking Worker's ten-minute cron
 * calls `POST /api/leads/sheet`; it copies when the log changed
 * (`SHEET_DIRTY`, set by `lib/leads/activity-log.ts`) or a day has passed.
 * The site makes the spreadsheet itself on the first run, so hello@'s
 * GCAL_OAUTH needs only the `drive.file` scope (`scripts/gsc-auth.mjs cal`).
 * ─────────────────────────────────────────────────────────────── */
import type { Sealer } from "./lead-crypto";
import { gcalToken } from "@/lib/booking/gcal";
import { eventsCsv, paidTotal, readMaster, SHEET_DIRTY, type MasterEntry } from "./activity-log";
import { csv } from "./lead-crm";
import { everyLead } from "./lead-store";
import type { Lead } from "./leads";

type KV = Pick<NonNullable<CloudflareEnv["INBOX"]>, "get" | "put" | "list" | "delete">;
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
export const SHEET_ID = "sheet:id";
export const SHEET_AT = "sheet:at";
const DAY = 864e5;
const TABS = [
  { sheetId: 1, title: "Clients" },
  { sheetId: 2, title: "Activity" },
];

/** The Clients CSV, with what each client paid from one pass over the master log. */
export async function clientsCsv(kv: KV, s: Sealer, master?: MasterEntry[]): Promise<string> {
  const all = await everyLead(kv, s);
  const byLead = new Map<string, Lead["events"]>();
  for (const m of master ?? (await readMaster(kv, s))) byLead.set(m.lead, [...(byLead.get(m.lead) ?? []), m.event]);
  const paid: Record<string, number> = {};
  for (const l of all) if (l.id) paid[l.email] = paidTotal(byLead.get(l.id) ?? []);
  return csv(all, paid);
}

/** Copies the desk to the Sheet when something changed or a day passed. Throws Google's status, never a token. */
export async function syncSheet(kv: KV, s: Sealer, oauth: string | undefined, now = Date.now()): Promise<"clean" | "synced"> {
  const [dirty, at] = await Promise.all([kv.get(SHEET_DIRTY), kv.get(SHEET_AT)]);
  if (!dirty && Number(at) > now - DAY) return "clean";
  // Cleared first: a lead written while this runs marks it again for the next run.
  if (dirty) await kv.delete(SHEET_DIRTY);
  try {
    const headers = { authorization: `Bearer ${await gcalToken(oauth)}`, "content-type": "application/json" };
    let id = await kv.get(SHEET_ID);
    if (!id) {
      const made = await fetch(SHEETS, {
        method: "POST",
        headers,
        body: JSON.stringify({ properties: { title: "JG Leads (juliangigola.com, read only)" }, sheets: TABS.map((properties) => ({ properties })) }),
      });
      id = ((await made.json().catch(() => ({}))) as { spreadsheetId?: string }).spreadsheetId ?? null;
      if (!made.ok || !id) throw new Error(`Sheets create ${made.status}`);
      await kv.put(SHEET_ID, id);
    }
    const master = await readMaster(kv, s);
    const data = [await clientsCsv(kv, s, master), eventsCsv(master)];
    const res = await fetch(`${SHEETS}/${id}:batchUpdate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        // Cleared, then pasted: a shorter list leaves no stale rows behind.
        requests: TABS.flatMap(({ sheetId }, i) => [
          { updateCells: { range: { sheetId }, fields: "userEnteredValue" } },
          { pasteData: { coordinate: { sheetId, rowIndex: 0, columnIndex: 0 }, data: data[i], type: "PASTE_NORMAL", delimiter: "," } },
        ]),
      }),
    });
    // Deleted from Drive: the next run makes a new one.
    if (res.status === 404) await kv.delete(SHEET_ID);
    if (!res.ok) throw new Error(`Sheets ${res.status}`);
    await kv.put(SHEET_AT, String(now));
    return "synced";
  } catch (e) {
    await kv.put(SHEET_DIRTY, "1");
    throw e;
  }
}
