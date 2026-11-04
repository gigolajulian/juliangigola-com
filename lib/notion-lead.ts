import type { Enquiry } from "@/lib/inbox";
import type { Stage } from "@/lib/leads";

/* ── leads into Notion ────────────────────────────────────────────
 * Every enquiry and Cal.com booking also lands as a row on the Business
 * Hub "Bookings" database, where the Pipeline board shows it. A copy of
 * the INBOX row, never the record: a Notion outage must not lose an
 * enquiry, so this never throws and does nothing while NOTION_TOKEN is unset.
 * One row per person (by Contact Email), and a stage moved on the lead desk
 * moves that row's Status too.
 * ─────────────────────────────────────────────────────────────── */

const DATABASE = "66054052b3724788a2d21c66c1a7562d";

/** Form types and Cal.com slugs to the board's Shoot Type options. */
const SHOOT: Record<string, string> = {
  editorial: "Editorial",
  campaign: "Brand",
  music: "Music",
  coverart: "Music",
  presskit: "Music",
  portrait: "Portrait",
  session: "Portrait",
  portraits: "Portrait",
  headshots: "Headshots",
  graduation: "Graduation",
  digitals: "Studio Digitals",
  event: "Event",
  other: "Other",
};

export type Lead = {
  stored: Enquiry;
  status: "Inquiry" | "Call booked" | "Confirmed";
  /** Website form type or Cal.com event slug. */
  kind?: string;
  calUid?: string;
  shootDate?: string;
};

const text = (s: string) => ({ rich_text: [{ text: { content: s.slice(0, 2000) } }] });

export function leadProperties({ stored, status, kind, calUid, shootDate }: Lead) {
  const shoot = kind ? SHOOT[kind] : undefined;
  const message = [stored.detail, stored.message].filter(Boolean).join("\n\n");
  return {
    "Project Name": { title: [{ text: { content: [stored.name, shoot].filter(Boolean).join(" · ") } }] },
    "Contact Name": text(stored.name),
    ...(stored.email ? { "Contact Email": { email: stored.email } } : {}),
    Source: { select: { name: "Website" } },
    Status: { select: { name: status } },
    ...(shoot ? { "Shoot Type": { select: { name: shoot } } } : {}),
    ...(message ? { Message: text(message) } : {}),
    "Last Contact": { date: { start: stored.at } },
    ...(shootDate ? { "Shoot Date": { date: { start: shootDate } } } : {}),
    ...(stored.deposit ? { "Deposit Paid": { checkbox: true } } : {}),
    ...(calUid ? { "Cal UID": text(calUid) } : {}),
  };
}

const API = "https://api.notion.com/v1";
const notion = (token: string, path: string, method: string, body: unknown) =>
  fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4000),
  });

/** Finished projects keep their row as it was; a past client starts a new one. */
const CLOSED = ["Delivered", "Complete", "Lost"];

/** The newest open Bookings row for this address, or null when there is none. */
export async function findRow(token: string, email: string): Promise<string | null> {
  const res = await notion(token, `/databases/${DATABASE}/query`, "POST", {
    filter: {
      and: [
        { property: "Contact Email", email: { equals: email } },
        ...CLOSED.map((name) => ({ property: "Status", select: { does_not_equal: name } })),
      ],
    },
    sorts: [{ timestamp: "created_time", direction: "descending" }],
    page_size: 1,
  });
  if (!res.ok) throw new Error(`notion query ${res.status}`);
  return ((await res.json()) as { results: { id: string }[] }).results[0]?.id ?? null;
}

/**
 * One open row per person: the same address again updates its open row
 * instead of adding another (Julian: "Reuse open rows only"). An inquiry never pulls a row back to
 * Inquiry, and the title and Source stay as first set. When the lookup
 * fails it adds a row, so nothing is lost. Returns the row's page id.
 */
export async function toNotion(token: string | undefined, lead: Lead): Promise<string | undefined> {
  if (!token) return;
  try {
    const props: Record<string, unknown> = leadProperties(lead);
    const email = lead.stored.email;
    const id = email ? await findRow(token, email).catch((e) => (console.error("notion lead", e), null)) : null;
    let res: Response;
    if (id) {
      delete props["Project Name"];
      delete props.Source;
      if (lead.status === "Inquiry") delete props.Status;
      res = await notion(token, `/pages/${id}`, "PATCH", { properties: props });
    } else {
      res = await notion(token, "/pages", "POST", { parent: { database_id: DATABASE }, properties: props });
    }
    if (!res.ok) return void console.error("notion lead", res.status, (await res.text()).slice(0, 300));
    return id ?? ((await res.json()) as { id: string }).id;
  } catch (e) {
    console.error("notion lead", e);
  }
}

/** The board has no "Shot"; after the shoot the row is in Editing. */
const STATUS: Partial<Record<Stage, string>> = { Shot: "Editing" };

/**
 * A stage Julian set on the desk, mirrored to the person's Bookings row.
 * `page` is the row the lead already knows, else it is looked up by
 * address. Never throws. Returns the page id when the row was updated.
 */
export async function notionStage(token: string | undefined, email: string, stage: Stage, page?: string): Promise<string | undefined> {
  if (!token) return;
  try {
    const id = page ?? (await findRow(token, email));
    // shortcut: a lead with no row is left alone; create one here if old leads ever need it.
    if (!id) return;
    const res = await notion(token, `/pages/${id}`, "PATCH", { properties: { Status: { select: { name: STATUS[stage] ?? stage } } } });
    if (!res.ok) return void console.error("notion stage", res.status, (await res.text()).slice(0, 300));
    return id;
  } catch (e) {
    console.error("notion stage", e);
  }
}
