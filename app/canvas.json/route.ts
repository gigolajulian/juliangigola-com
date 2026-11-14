import { PROJECTS } from "@/lib/work";

/* Every frame of every project for the canvas view
   (components/v3/canvas.tsx). A file of its own, fetched when the canvas
   opens, so /portfolio does not carry frames it may never show. */
export const dynamic = "force-static";

/** slug -> [src, height / width, alt, colour][] in the project's own order. */
export function GET() {
  const out: Record<string, [string, number, string, string][]> = {};
  for (const p of PROJECTS)
    out[p.slug] = p.images.map((f) => [f.src, +(f.height / f.width).toFixed(3), (f.alt ?? p.name).trim(), f.color]);
  return Response.json(out);
}
