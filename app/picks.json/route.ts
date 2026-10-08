import { WORK_CATEGORIES, projectsIn } from "@/lib/work";

/* The photographs the inquiry form's picker offers (`reference-picks.tsx`),
   by discipline. A file of its own, fetched when the picker opens, so the
   homepage does not carry frames it may never show. */
export const dynamic = "force-static";

/* Covers only, one a project (Julian, 2026-10-07), and no two looks
   side by side: the portfolio's order, but each next cover is whichever
   of the next few in line sits furthest in colour from the last two. */
const rgb = (hex = "#808080") => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const far = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function varied<T extends { color?: string }>(items: T[], ahead = 6): T[] {
  const left = [...items];
  const out: T[] = [];
  while (left.length) {
    const recent = out.slice(-2).map((x) => rgb(x.color));
    let best = 0;
    let score = -1;
    left.slice(0, ahead).forEach((c, i) => {
      const s = recent.length ? Math.min(...recent.map((r) => far(rgb(c.color), r))) : 0;
      if (s > score) [best, score] = [i, s];
    });
    out.push(left.splice(best, 1)[0]);
  }
  return out;
}

export function GET() {
  const groups = WORK_CATEGORIES.map((c) => {
    const projects = projectsIn(c.slug);
    // A gallery (Event coverage, Automotive, Places, Cover Art) is one
    // project: its frames are the work, so they stay.
    const frames =
      projects.length === 1
        ? projects[0].images.map((f) => ({ ...f, name: projects[0].name }))
        : projects.map((p) => ({ ...p.cover, name: p.name }));
    return {
      name: c.name,
      frames: varied(frames).map((f) => [f.src, f.width, f.height, f.name] as const),
    };
  }).filter((g) => g.frames.length);
  return Response.json(groups);
}
