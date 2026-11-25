import { PHOTO_KEY } from "@/lib/leads/invoice";
import { gate, noSeal, sealedGate } from "@/lib/admin/gate";
import { bodyOf, json } from "@/lib/http";
import { sha256Hex } from "@/lib/token";

/* A design B invoice's photo, sealed like the lead it belongs to: GET `?key=`, POST `{ photo }` (already
   framed down by the desk), stored under its own hash so the same photo is kept once. Behind the /admin gate. */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await sealedGate(request);
  if (g.error) return g.error;
  const seal = g.s;
  const key = new URL(request.url).searchParams.get("key") ?? "";
  const raw = PHOTO_KEY.test(key) ? await g.kv.get(key) : null;
  return raw ? json({ photo: await seal.open<string>(raw) }) : json({ error: "Photo not found." }, 404);
}

export async function POST(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;
  const given = await bodyOf(request);
  if (!given) return json({ error: "Not JSON." }, 400);
  const seal = g.s;
  if (!seal) return noSeal();
  const photo = given.photo;
  if (typeof photo !== "string" || !photo.startsWith("data:image/jpeg;base64,") || photo.length > 4_000_000)
    return json({ error: "The photo must be a JPEG under 3 MB." }, 400);
  const key = `invoice-photo:${(await sha256Hex(photo)).slice(0, 32)}`;
  if (!(await g.kv.get(key))) await g.kv.put(key, await seal.seal(photo));
  return json({ key });
}
