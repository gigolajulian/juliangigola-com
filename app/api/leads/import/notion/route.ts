import { importNotion } from "@/lib/leads/sync/notion-import";
import { sealedGate } from "@/lib/leads/desk-route";
import { bodyOf, json } from "@/lib/http";
import { errorText } from "@/lib/utils";

/* POST `{ people, dry? }`: past Notion rows as quiet leads (`lib/leads/sync/notion-import.ts`,
   `scripts/import-notion.mjs`). Dry, it only counts; only an explicit `dry: false` writes. Behind the /admin gate. */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const g = await sealedGate(request);
  if (g.error) return g.error;
  const given = await bodyOf(request);
  const seal = g.s;
  try {
    return json(await importNotion(g.kv, seal, given?.people, given?.dry !== false));
  } catch (e) {
    return json({ error: errorText(e) }, 400);
  }
}
