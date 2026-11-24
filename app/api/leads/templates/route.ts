import { cleanTemplates } from "@/lib/leads/lead-crm";
import { gate } from "@/lib/admin/gate";
import { bodyOf, json } from "@/lib/http";
import { parseOr } from "@/lib/json";

/* His reply templates: GET them (or the defaults), PUT `{ templates }` to save them whole. Not personal
   data, so plain JSON. Behind the /admin gate. */

export const dynamic = "force-dynamic";

const TEMPLATES_KEY = "leads:templates";

export async function GET(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;
  return json({ templates: cleanTemplates(parseOr(await g.kv.get(TEMPLATES_KEY), undefined)) });
}

export async function PUT(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;
  const given = await bodyOf(request);
  if (!given) return json({ error: "Not JSON." }, 400);
  const templates = cleanTemplates(given.templates);
  await g.kv.put(TEMPLATES_KEY, JSON.stringify(templates));
  return json({ templates });
}
