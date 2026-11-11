// One-time: the Notion Business Hub's Bookings and Clients CRM rows into the
// lead desk as quiet past leads (`lib/leads/notion-import.ts`).
//
//   node scripts/import-notion.mjs <export folder>          dry run: counts only
//   node scripts/import-notion.mjs <export folder> --go     writes
//
// <export folder>: the unzipped Notion export (IMPORT/notion-archive/). Reads
// the `_all.csv` of each database, skips test rows, groups rows by person
// (email, else Instagram, else phone) and posts them to /api/inbox on the live
// site with the INBOX_KEY Worker secret, read from your environment
// (`$env:INBOX_KEY`), never printed. The desk refuses gh's OAuth token. Only fields
// the lead lacks are filled; a second run adds nothing. Prints counts only.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const [dir, flag] = process.argv.slice(2);
if (!dir) throw new Error("Usage: node scripts/import-notion.mjs <export folder> [--go]");
const SITE = process.env.SITE_URL || "https://juliangigola.com";

const files = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : [join(d, f)]));
const table = (name) => {
  const f = files(dir).find((p) => p.replace(/\\/g, "/").split("/").pop().startsWith(name + " ") && p.endsWith("_all.csv"));
  if (!f) throw new Error(`No ${name} _all.csv in ${dir}`);
  return csv(readFileSync(f, "utf8").replace(/^﻿/, ""));
};

/** A relation cell in a Notion export reads "Name (Name%20<page id>.md)": keep the name only. */
export const unlink = (v) => v.replace(/\s*\([^()]*%20[0-9a-f]{32}\.md\)/g, "").trim();

/** RFC 4180: quoted fields, doubled quotes, newlines inside quotes. */
export function csv(text) {
  const rows = [[]];
  let cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") rows.at(-1).push(cell), (cell = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      rows.at(-1).push(cell), (cell = ""), rows.push([]);
    } else cell += c;
  }
  rows.at(-1).push(cell);
  const [head, ...body] = rows.filter((r) => r.some((v) => v !== ""));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, unlink((r[i] ?? "").trim())])));
}

// Same rule as `identity` in lib/leads/lead-crm.ts.
const who = (email, ig, phone) => {
  const e = email?.toLowerCase();
  if (e?.includes("@") && !e.startsWith("@")) return e;
  const i = ig?.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "").toLowerCase();
  if (i && /^[a-z0-9._]{1,30}$/.test(i)) return `ig:@${i}`;
  const t = phone?.replace(/[^\d+]/g, "");
  return t && t.replace(/\D/g, "").length >= 7 ? `tel:${t}` : null;
};
const STAGE = { Complete: "Delivered", Lost: "Lost", "Call booked": "Call booked", "Call done": "Call booked", Replied: "Replied", Editing: "Shot", Quoted: "Quoted" };
const test = (r) => Object.values(r).some((v) => /\btest\b/i.test(v));
const money = (v) => Number(String(v).replace(/[$,]/g, "")) || undefined;
const when = (...v) => v.find((d) => d && !isNaN(Date.parse(d))) ?? "2026-11-11";

const people = new Map();
const person = (id) => people.get(id) ?? (people.set(id, { email: id, rows: [], notes: [] }), people.get(id));
const fill = (p, k, v) => v && !p[k] && (p[k] = v);
let tests = 0, nobody = 0;

for (const r of table("Bookings")) {
  if (test(r)) { tests++; continue; }
  const id = who(r["Contact Email"], r.Instagram, r["Contact Phone"]);
  if (!id) { nobody++; continue; }
  const p = person(id);
  const at = when(r["Last Contact"], r["Shoot Date"]);
  p.rows.push({ ref: r["Booking ID"] || r["Cal UID"] || r["Project Name"], at, note: `Notion booking: ${r["Project Name"]}${r["Shoot Date"] ? `, shoot ${r["Shoot Date"]}` : ""}${r.Status ? ` (${r.Status})` : ""}` });
  fill(p, "name", r["Contact Name"] || r.Client);
  fill(p, "phone", r["Contact Phone"]);
  fill(p, "ig", r.Instagram);
  fill(p, "source", r.Source);
  fill(p, "kind", r["Shoot Type"]);
  fill(p, "quote", money(r["Session Fee"]));
  if (r.Contract === "Signed") p.contract = "Signed";
  // The stage of their latest booking.
  if (STAGE[r.Status] && (!p.stageAt || at > p.stageAt)) (p.stage = STAGE[r.Status]), (p.stageAt = at);
  const text = [r.Notes, r["Next Step"] && `Next step: ${r["Next Step"]}`, r.Message && `Message: ${r.Message}`].filter(Boolean).join("\n");
  if (text) p.notes.push(`${r["Project Name"]}: ${text}`);
}
for (const r of table("Clients CRM")) {
  if (test(r)) { tests++; continue; }
  const id = who(r.Email, r.Instagram, r.Phone);
  if (!id) { nobody++; continue; }
  const p = person(id);
  p.rows.push({ ref: r["Client ID"] || r["Client Name"], at: when(r["First Contact"]), note: `Notion client: ${r["Client Name"]}${r.Status ? ` (${r.Status})` : ""}` });
  fill(p, "name", r["Client Name"]);
  fill(p, "phone", r.Phone);
  fill(p, "ig", r.Instagram);
  fill(p, "source", r.Source);
  fill(p, "kind", r["Shoot Type"]);
  if (r.Notes) p.notes.push(`Client notes: ${r.Notes}`);
}
const body = [...people.values()].map(({ notes, stageAt, ...p }) => ({ ...p, ...(notes.length ? { notes: `From Notion (2026-11-11):\n${notes.join("\n\n")}` } : {}) }));
console.log(`Read: ${body.length} people, ${body.reduce((n, p) => n + p.rows.length, 0)} rows, ${tests} test rows skipped, ${nobody} rows with no email, Instagram or phone.`);

const key = process.env.INBOX_KEY;
if (!key) throw new Error("Set INBOX_KEY in this shell first (the Worker secret). Nothing was sent.");
const res = await fetch(`${SITE}/api/inbox`, {
  method: "POST",
  headers: { "x-inbox-key": key, "content-type": "application/json" },
  body: JSON.stringify({ importNotion: body, dry: flag !== "--go" }),
});
console.log(res.status, JSON.stringify(await res.json()));
