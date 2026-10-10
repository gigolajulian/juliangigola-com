import * as React from "react";
import { leftOf, RELAID } from "./shared";

/** How wide a column of the wall wants to be, as a share of the shelf's
    height, and the width past which a single frame has to share its
    column rather than stand there as a billboard. */
const WALL_WANT = 0.46;
const WALL_CAP = 0.95;

/** The rack (the grid view) pairs its cells by shape. */
export function useRackPairs({
  scroller: scrollerRef,
  grid,
  sheet,
  shown,
}: {
  scroller: React.RefObject<HTMLDivElement | null>;
  grid: boolean;
  sheet: boolean;
  shown: React.ReactNode;
}) {
  /* ── the rack pairs like with like ────────────────────────────
   * A column of the rack is two cells one above the other and is as wide
   * as the wider of them, so a portrait sitting above a landscape is
   * printed in a column half as wide again as itself and the rest of that
   * column is paper. Measured on production at 1600: Event coverage put a
   * portrait with a landscape in 5 of its 13 columns, Automotive in 4 of
   * 11, Places in 5 of 12, and inside one of those columns the narrower
   * frame is left in a hole about 45% as wide as itself. Julian: the
   * upright ones can stand next to each other so there is no empty space.
   *
   * So the cells are re-ordered, not resized: nothing is cropped and no
   * frame changes shape. Each cell is paired with the next one of its own
   * orientation, and `order` puts the two of them in the same column.
   * Greedy and in sequence, so a run stays close to the order it was
   * given rather than being sorted into all the uprights and then all the
   * wide ones.
   *
   * The words that open a discipline span both rows and take a whole
   * column of their own; they are left exactly where they are, and the
   * pairing starts again after each of them, because that is where the
   * grid starts a fresh column anyway.
   *
   * Read from the DOM and not from the children, because `--ar` is set by
   * the cell on the element it renders and a parent holding the React
   * element cannot see it. One pass on the way into the rack, one
   * `getComputedStyle` per cell; the strip view clears what it wrote.
   */
  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    // The sheet runs in rows, in the strip's own order.
    if (!grid || sheet) {
      for (const k of kids) {
        k.style.order = "";
        delete k.dataset.alone;
      }
      return;
    }
    /* A cell that is not a picture spans both rows - see `.strip-grid` in
       `globals.css` - so it is a column on its own and an anchor here.
       `data-tick` and not the tag: the card that leads on to the next
       discipline is a link like a cover is, and pairing it with a frame
       moved it out of the end of the sequence and left it stranded in the
       middle of the rack. The ruler counts what belongs to the sequence
       and marks it; everything else stays where it was put. */
    const picture = (k: HTMLElement) =>
      (k.tagName === "A" || k.tagName === "BUTTON") &&
      k.dataset.tick !== undefined;
    const upright = (k: HTMLElement) =>
      (parseFloat(getComputedStyle(k).getPropertyValue("--ar")) || 0.8) < 1;

    const taken = new Array(kids.length).fill(false);
    let at = 0;
    for (let i = 0; i < kids.length; i++) {
      if (taken[i]) continue;
      taken[i] = true;
      kids[i].style.order = String(at++);
      if (!picture(kids[i])) continue;
      /* Its partner: the next free cell standing the same way up, and
         not past the words that begin the next discipline. The same way
         up and not the nearest shape: pairing each cell with the closest
         `--ar` within reach was measured worse on two galleries of three,
         because a good local match spends the partner a later cell needed
         more. 7.1% of the rack left empty across the three this way,
         9.9% that way. */
      const want = upright(kids[i]);
      let alone = true;
      for (let j = i + 1; j < kids.length; j++) {
        if (!picture(kids[j])) break;
        if (taken[j] || upright(kids[j]) !== want) continue;
        taken[j] = true;
        kids[j].style.order = String(at++);
        alone = false;
        break;
      }
      /* No partner: the row under it may be a hole, and the chapter
         behind showed through it (`[data-alone]` in globals.css). */
      if (alone) kids[i].dataset.alone = "";
      else delete kids[i].dataset.alone;
    }
    /* On `shown`, not `children`: the held-back sections (`defer`)
       arrive without the parent rendering again, and a cover written
       no `order` sorts as nought, to the front of the rack. Coming
       through the door into the grid, Artist Presskit and Portraits
       stood where Editorial belonged. */
  }, [scrollerRef, grid, sheet, shown]);
}

/** A gallery in the rack is hung as a wall of equal columns. */
export function useWall({
  scroller: scrollerRef,
  grid,
  live,
  wide,
  count,
  wallId,
}: {
  scroller: React.RefObject<HTMLDivElement | null>;
  grid: boolean;
  live: boolean;
  wide: boolean;
  count: number;
  wallId: string;
}) {
  /* ── the wall ─────────────────────────────────────────────────
   * A discipline that is one gallery is a set of photographs of every
   * shape. The rack gives every cell the same height and takes its width
   * from the shape, so a column is as wide as the widest frame in it and
   * the narrower ones leave a ragged strip of ground beside them - the
   * gap reads as sixteen pixels in one place and ninety in the next.
   *
   * Here the column comes first: its width is chosen so that the frames
   * stacked in it come out the same width and fill the shelf exactly.
   *
   *   W = (shelf - the gaps between them) / sum(1 / ratio)
   *
   * Every gap is then the same, every photograph keeps the shape it was
   * shot at, and nothing is cropped. Only where the shelf is one gallery:
   * a run of covers is a run of covers and stays exactly as it is, which
   * is what Julian asked for.
   *
   * Written into a stylesheet of its own rather than onto the cells: the
   * cells belong to React, and a re-render puts back what it knows about.
   * ─────────────────────────────────────────────────────────────── */
  React.useLayoutEffect(() => {
    const el = scrollerRef.current;
    // Not on a phone: the sheet there runs down the page (`globals.css`).
    if (!el || !grid || !live || !wide) return;
    const sheet = document.createElement("style");
    document.head.append(sheet);
    el.dataset.wall = wallId;

    const paint = () => {
      const kids = Array.from(el.children) as HTMLElement[];
      const cs = getComputedStyle(el);
      const gap = parseFloat(cs.columnGap) || 16;
      const room =
        el.clientHeight -
        parseFloat(cs.paddingTop) -
        parseFloat(cs.paddingBottom);
      /* Each run of a gallery's frames is a wall of its own. A cover is a
         link and never part of one, so a run of covers stays exactly as
         it is; on All work the galleries among them are walled one by one.
         Julian saw the ragged holes in Event coverage there, where the
         wall used to stand down for the whole shelf. */
      const runs: HTMLElement[][] = [];
      for (let i = 0; i < kids.length; i++) {
        if (kids[i].tagName !== "BUTTON") continue;
        if (i > 0 && kids[i - 1].tagName === "BUTTON")
          runs[runs.length - 1].push(kids[i]);
        else runs.push([kids[i]]);
      }
      if (!runs.length || room < 80) {
        sheet.textContent = "";
        el.dispatchEvent(new Event(RELAID));
        return;
      }

      const at = `[data-wall="${wallId}"]`;
      const rules = [
        `${at}{position:relative!important;}`,
        `${at}>button{position:absolute!important;margin:0!important;aspect-ratio:auto!important;}`,
      ];
      const top0 = parseFloat(cs.paddingTop) || 0;
      for (const frames of runs) {
        const ars = frames.map(
          (f) =>
            parseFloat(getComputedStyle(f).getPropertyValue("--ar")) || 0.8,
        );
        /* Walk the run, taking at each step the number of frames whose
           shared width lands nearest the one the wall wants. */
        const cols: { at: number; k: number; w: number }[] = [];
        for (let i = 0; i < ars.length;) {
          let best = { k: 1, w: 0, score: Infinity };
          for (let k = 1; k <= 3 && i + k <= ars.length; k++) {
            const inv = ars.slice(i, i + k).reduce((sum, a) => sum + 1 / a, 0);
            const w = (room - (k - 1) * gap) / inv;
            const score =
              Math.abs(w / room - WALL_WANT) + (w / room > WALL_CAP ? 100 : 0);
            if (score < best.score) best = { k, w, score };
          }
          cols.push({ at: i, k: best.k, w: best.w });
          i += best.k;
        }

        /* The words that open the run stay where they are and keep their
           own width; the wall starts after them. Where they stand depends
           on the walls before this one, so what is written so far goes in
           first and is measured: one layout a gallery, and only when the
           shelf changes size. */
        const first = kids.indexOf(frames[0]);
        const head = first > 0 ? kids[first - 1] : null;
        sheet.textContent = rules.join(String.fromCharCode(10));
        const left0 = head
          ? leftOf(head) + head.offsetWidth + gap
          : parseFloat(cs.paddingLeft) || 0;

        let x = left0;
        for (const col of cols) {
          let y = top0;
          for (let n = 0; n < col.k; n++) {
            const h = col.w / ars[col.at + n];
            rules.push(
              `${at}>:nth-child(${kids.indexOf(frames[col.at + n]) + 1}){` +
                `left:${x.toFixed(2)}px!important;top:${y.toFixed(2)}px!important;` +
                `width:${col.w.toFixed(2)}px!important;height:${h.toFixed(2)}px!important;}`,
            );
            y += h + gap;
          }
          x += col.w + gap;
        }
        /* Out of the flow, the frames take no room, so the words that open
           the run carry the wall's length on their own margin and whatever
           follows lands after it. */
        if (head) {
          rules.push(
            `${at}>:nth-child(${first}){margin-right:${(x - left0).toFixed(2)}px!important;}`,
          );
        }
      }
      sheet.textContent = rules.join(String.fromCharCode(10));
      el.dispatchEvent(new Event(RELAID));
    };

    paint();
    const watch = new ResizeObserver(paint);
    watch.observe(el);
    return () => {
      watch.disconnect();
      sheet.remove();
      delete el.dataset.wall;
    };
  }, [scrollerRef, grid, live, wide, count, wallId]);
}
