/* ── the sliders' submit ──────────────────────────────────────────
 * Julian: tune the name's effect on the `?tune` sliders (`warp-tuner.tsx`)
 * and hit submit, rather than copying the values out by hand. The panel
 * posts here and the values land in `.next/tune.json`, one entry per
 * panel, where they are read back into the code.
 *
 * The dev server only. Everywhere else this answers 404 before it reads
 * anything, and it writes one file under `.next`, which is not committed.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development")
    return new Response(null, { status: 404 });

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    values?: unknown;
  } | null;
  if (
    !body ||
    typeof body.title !== "string" ||
    !body.values ||
    typeof body.values !== "object"
  )
    return new Response(null, { status: 400 });

  const { readFile, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const file = join(process.cwd(), ".next", "tune.json");
  const kept = JSON.parse(await readFile(file, "utf8").catch(() => "{}"));
  kept[body.title] = { values: body.values, at: new Date().toISOString() };
  await writeFile(file, JSON.stringify(kept, null, 2));
  return new Response(null, { status: 204 });
}
