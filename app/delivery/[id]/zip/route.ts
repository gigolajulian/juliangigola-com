import { attachment, openDelivery } from "@/lib/proofs/delivery";
import { finalKey, shotOrder } from "@/lib/proofs/proof";
import { uniqueNames, zipLayout } from "@/lib/zip";

/* Download all: every final in one stored zip, streamed from R2 with its exact length. Sizes and CRCs were
   recorded at upload, so the Worker only pipes bytes. A file that changed since is a broken download, never a wrong one. */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await openDelivery(id);
  if (!g) return new Response("Not found", { status: 404 });
  if (!(await g.env.DOWNLOAD_LIMIT.limit({ key: request.headers.get("cf-connecting-ip") ?? "unknown" })).success) return new Response("Too many downloads. Wait a minute.", { status: 429, headers: { "retry-after": "60" } });
  const finals = shotOrder(g.p.finals ?? []);
  const names = uniqueNames(finals.map((f) => f.file));
  const z = zipLayout(finals.map((f, i) => ({ name: names[i], size: f.bytes, crc: f.crc })));
  const out = new FixedLengthStream(z.total);
  const pump = async () => {
    for (const [i, f] of finals.entries()) {
      const w = out.writable.getWriter();
      await w.write(z.locals[i]);
      w.releaseLock();
      const o = await g.env.PROOFS.get(finalKey(g.p.token, f.id));
      if (!o || o.size !== f.bytes) throw new Error(`final ${f.id} missing or changed`);
      await o.body.pipeTo(out.writable, { preventClose: true });
    }
    const w = out.writable.getWriter();
    await w.write(z.tail);
    await w.close();
  };
  pump().catch((e) => {
    console.error("delivery zip", g.p.token, String(e));
    out.writable.abort(e).catch(() => undefined);
  });
  const day = id.slice(0, 8);
  return new Response(out.readable, {
    headers: { "content-type": "application/zip", "content-disposition": attachment(`Julian Gigola ${day.slice(0, 2)}-${day.slice(2, 4)}-${day.slice(4)}.zip`), "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" },
  });
}
