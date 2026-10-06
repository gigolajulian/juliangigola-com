import { WORK_CATEGORIES, projectsIn } from "@/lib/work";

/* The photographs the inquiry form's picker offers (`reference-picks.tsx`),
   by discipline. A file of its own, fetched when the picker opens, so the
   homepage does not carry nine hundred frames it may never show. */
export const dynamic = "force-static";

export function GET() {
  const groups = WORK_CATEGORIES.map((c) => ({
    name: c.name,
    frames: projectsIn(c.slug).flatMap((p) =>
      p.images.map((f) => [f.src, f.width, f.height, p.name] as const),
    ),
  })).filter((g) => g.frames.length);
  return Response.json(groups);
}
