import type { Enquiry } from "@/lib/inbox";

/* ── leads into Notion ────────────────────────────────────────────
 * Every enquiry and Cal.com booking also lands as a row on the Business
 * Hub "Bookings" database, where the Pipeline board shows it. A copy of
 * the INBOX row, never the record: a Notion outage must not lose an
 * enquiry, so this never throws and does nothing while NOTION_TOKEN is unset.
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

// ponytail: a Cal.com retry after a write that succeeded makes a second row,
// same as the INBOX; query on Cal UID first if duplicates ever show up.
export async function toNotion(token: string | undefined, lead: Lead): Promise<void> {
  if (!token) return;
  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ parent: { database_id: DATABASE }, properties: leadProperties(lead) }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) console.error("notion lead", res.status, (await res.text()).slice(0, 300));
  } catch (e) {
    console.error("notion lead", e);
  }
}
