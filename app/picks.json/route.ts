import { WORK_CATEGORIES, projectsIn } from "@/lib/work";
import LOOKS from "@/lib/picker-looks.json";

/* The photographs the inquiry form's picker offers (`reference-picks.tsx`),
   by discipline. A file of its own, fetched when the picker opens, so the
   homepage does not carry frames it may never show. */
export const dynamic = "force-static";

/* Covers only, one a project, and no two looks side by side: the
   portfolio's order, but each next cover is whichever of the next
   few in line sits furthest in colour from the last two. */
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

/* The picker by look rather than discipline. Each photograph's look was
   sorted by its light and colour and then corrected by eye
   (`lib/picker-looks.json`); a photograph added since lands in "More"
   until it is given one. Events and Cover art are kinds of work rather
   than looks, and are kept whole. */
const ORDER = ["Chroma", "Night", "White studio", "Grey studio", "Daylight", "Events", "Cover art", "More"];

export function GET() {
  const seen = new Set<string>();
  const byLook = new Map<string, { src: string; width: number; height: number; name: string; color?: string }[]>();
  for (const c of WORK_CATEGORIES) {
    const projects = projectsIn(c.slug);
    // A gallery (Event coverage, Automotive, Places, Cover Art) is one
    // project: its frames are the work, so they stay.
    const frames =
      projects.length === 1
        ? projects[0].images.map((f) => ({ ...f, name: projects[0].name }))
        : projects.map((p) => ({ ...p.cover, name: p.name }));
    for (const f of frames) {
      if (seen.has(f.src)) continue;
      seen.add(f.src);
      const look = (LOOKS as Record<string, string>)[f.src] ?? "More";
      if (!byLook.has(look)) byLook.set(look, []);
      byLook.get(look)!.push(f);
    }
  }
  const groups = ORDER.filter((n) => byLook.has(n)).map((name) => ({
    name,
    frames: varied(byLook.get(name)!).map((f) => [f.src, f.width, f.height, f.name] as const),
  }));
  return Response.json(groups);
}
