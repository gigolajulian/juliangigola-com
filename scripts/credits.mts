/* Normalizes credits into content/projects.json (`credits`, per slug): roles to lib/credits.ts, Instagram
   handles into `instagram`, and a real name wherever the same handle is named on another project.
   `npx tsx scripts/credits.mts` writes; handles still without a name are listed. */
import { readFileSync, writeFileSync } from "node:fs";
import { ALL_PROJECTS } from "../lib/work";
import { isHandle, isOwn, rolesFor } from "../lib/credits";
import type { Credit } from "../lib/work-types";

const file = "content/projects.json";
const raw = readFileSync(file, "utf8");
const j = JSON.parse(raw);
const clean = (n: string) => n.replace(/​/g, "").trim();
/* Real names for handles nobody has named yet: content/credit-names.json, { "handle": "Full Name" }. */
const named = new Map<string, string>(Object.entries(JSON.parse(readFileSync("content/credit-names.json", "utf8")) as Record<string, string>).filter(([, n]) => n));
for (const p of ALL_PROJECTS) for (const c of p.credits) {
  const m = clean(c.name).match(/^(.+?)\s*\(@([^)]+)\)$/);
  if (m) named.set(m[2], m[1]);
  else if (c.instagram && !isHandle(clean(c.name)) && !isOwn(c)) named.set(c.instagram, clean(c.name));
}
const bare = (c: Credit): Credit => (c.instagram ? { role: c.role, name: c.name, instagram: c.instagram } : { role: c.role, name: c.name }); // the site adds handle and avatar on load
const unnamed = new Set<string>();
for (const p of ALL_PROJECTS) {
  const out: Credit[] = [];
  for (const c of p.credits) {
    if (isOwn(c)) { out.push(...rolesFor(c.role).map((role) => ({ ...bare(c), role }))); continue; }
    let name = clean(c.name), ig = c.instagram;
    const m = name.match(/^(.+?)\s*\(@([^)]+)\)$/);
    if (m) [name, ig] = [m[1], m[2]];
    else if (isHandle(name)) { ig = name.replace(/^@/, ""); name = named.get(ig) ?? ig; if (!named.has(ig)) unnamed.add(ig); }
    for (const role of rolesFor(c.role)) out.push(ig ? { role, name, instagram: ig } : { role, name });
  }
  if (JSON.stringify(out) !== JSON.stringify(p.credits.map(bare))) j.credits[p.slug] = out;
}
writeFileSync(file, JSON.stringify(j, null, raw.match(/^\{\n( +)/)?.[1].length ?? 2) + "\n");
console.log("handles still without a real name:", [...unnamed].sort().join(", "));
