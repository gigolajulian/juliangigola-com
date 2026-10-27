import type { Frame } from "@/lib/work-types";

/** Where the contact sheet's last row ends short: the sheet packs as CSS
    `grid-auto-flow: dense` does in three columns (a horizontal takes two
    cells), so the free cells at the end of its last row are known here. */
export function tailHole(frames: Frame[]) {
  const rows: boolean[][] = [];
  for (const f of frames) {
    const n = f.width > f.height ? 2 : 1;
    for (let r = 0; ; r++) {
      const row = (rows[r] ??= [false, false, false]);
      const c = [0, 1, 2].find((c) => c + n <= 3 && row.slice(c, c + n).every((x) => !x));
      if (c !== undefined) { row.fill(true, c, c + n); break; }
    }
  }
  const last = rows[rows.length - 1];
  const free = last ? last.filter((x) => !x).length : 0;
  return free ? { row: rows.length, col: 4 - free, span: free } : null;
}
