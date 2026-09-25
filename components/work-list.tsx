"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { Frame } from "@/lib/work-types";
import { useWorkQuery } from "@/lib/work-view";
import { Lightbox, useLightbox } from "@/components/lightbox";
import { VideoViewer } from "@/components/video-viewer";
import type { Video } from "@/lib/videos";

/* ── the work as a list ───────────────────────────────────────────
 * The third way through: one line per project, the cover down the left,
 * the name and who it was for beside it. A strip is a sequence and a rack
 * is a wall; this is the index at the back of the book, and it is the only
 * one of the three that answers "is the Diesel campaign on here" without
 * a journey.
 *
 * Which is why the search box writes into this view rather than filtering
 * the other two: an answer somewhere off the right-hand edge of a ribbon
 * is not an answer. Typing puts the list up, emptying the box puts back
 * whatever was showing before (`lib/work-view.ts`).
 *
 * It scrolls downwards, alone among the views. A list of seventy names is
 * a column; laying it sideways to match the strip would put the reading
 * direction at right angles to the words.
 * ─────────────────────────────────────────────────────────────── */

export type ListRow = {
  slug: string;
  /** A film rather than a project: its id in `videos`, which a press
      plays in the viewer. Julian: clicking a line in the list opens the
      same thing under the same title as the grid and the strip do. */
  film?: string;
  /** A photograph rather than a project: its place in `frames`, which a
      press opens in the viewer instead of following `href`. */
  n?: number;
  name: string;
  href: string;
  /** Which discipline it files under, as the chip row names it. */
  discipline: string;
  /** Who it was for, or who is in it. */
  credit: string;
  frames?: number;
  cover: Frame;
  /** Name, discipline, credits and handles, folded, for the search. */
  find: string;
};

/** Every word typed has to be in the row somewhere, in any order. */
const matches = (row: ListRow, words: string[]) =>
  words.every((w) => row.find.includes(w));

export function WorkList({
  rows,
  frames,
  videos,
}: {
  rows: ListRow[];
  /** Every film a row can play, as the page's own strip offers them, so
      the viewer opens on the film that was clicked and steps through the
      rest of them from there. */
  videos?: Video[];
  /** Every photograph a row can open, in the order the rows carry. The
      disciplines Julian shoots straight onto the page — Event coverage,
      Automotive, Places — have no project pages behind them, so their
      lines open the viewer where a project's line opens a page. */
  frames?: Frame[];
}) {
  const query = useWorkQuery();
  const lightbox = useLightbox(frames ?? []);
  const [film, setFilm] = React.useState<Video | null>(null);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = words.length ? rows.filter((r) => matches(r, words)) : rows;

  return (
    <div className="work-list min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-[100rem] px-6 pb-16 pt-4 sm:px-10">
        {/* What the search found, said once, above the answer. Silent with
            an empty box: a list of everything does not need a count at the
            top of it, the chip row already carries one. */}
        {words.length ? (
          <p aria-live="polite" className="label pb-3 text-muted-foreground">
            {shown.length === 0
              ? `Nothing here matches ${query.trim()}`
              : `${shown.length} ${shown.length === 1 ? "project" : "projects"} matching ${query.trim()}`}
          </p>
        ) : null}

        <ul className="flex flex-col">
          {shown.map((row) => (
            <li key={row.slug}>
              <Row
                row={row}
                onOpen={lightbox.show}
                onPlay={(id) =>
                  setFilm(videos?.find((v) => v.id === id) ?? null)
                }
              >
                <span
                  className="relative block w-16 shrink-0 overflow-hidden sm:w-20"
                  style={{
                    backgroundColor: row.cover.color,
                    /* The shape it was shot at, not an upright crop of it.
                       Julian, on the films: a horizontal thumbnail stays
                       horizontal. The column keeps one width so the names
                       still run down a single edge; it is the height that
                       gives, which is the way round that leaves the list
                       scannable. */
                    aspectRatio: `${row.cover.width} / ${row.cover.height}`,
                  }}
                >
                  <Image
                    src={row.cover.src}
                    alt=""
                    fill
                    sizes="80px"
                    loading="lazy"
                    placeholder={row.cover.blur ? "blur" : "empty"}
                    blurDataURL={row.cover.blur}
                    draggable={false}
                    className="object-cover"
                  />
                </span>

                {/* The name at the size a title is set on this site, and
                    one line of it: a column of names is scanned down the
                    left edge, and a name that wraps breaks that edge. */}
                <span className="min-w-0 flex-1">
                  <span className="font-display block truncate text-lg uppercase leading-none tracking-[0] sm:text-2xl">
                    {row.name}
                  </span>
                  <span className="label mt-1.5 block truncate text-muted-foreground">
                    {row.credit}
                    {row.frames ? (
                      <>
                        <span aria-hidden> · </span>
                        {row.frames} frames
                      </>
                    ) : null}
                  </span>
                </span>

                <span className="label hidden shrink-0 text-muted-foreground sm:block">
                  {row.discipline}
                </span>
              </Row>
            </li>
          ))}
        </ul>
      </div>

      {frames?.length ? (
        <Lightbox frames={frames} name="The work" {...lightbox} />
      ) : null}
      {videos?.length ? (
        <VideoViewer videos={videos} current={film} onChange={setFilm} />
      ) : null}
    </div>
  );
}

/** A line: a page to go to, or a photograph to open. */
const LINE =
  "group flex w-full items-center gap-5 border-b-[0.5px] border-border/40 py-3 text-left press hoverable:hover:border-border hoverable:hover:bg-card";

function Row({
  row,
  onOpen,
  onPlay,
  children,
}: {
  row: ListRow;
  onOpen: (n: number) => void;
  onPlay: (id: string) => void;
  children: React.ReactNode;
}) {
  if (row.film) {
    const id = row.film;
    return (
      <button
        type="button"
        onClick={() => onPlay(id)}
        data-ring="Play"
        className={LINE}
      >
        {children}
      </button>
    );
  }
  if (row.n === undefined) {
    return (
      <Link
        href={row.href}
        prefetch={false}
        data-ring="View project"
        className={LINE}
      >
        {children}
      </Link>
    );
  }
  const n = row.n;
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      data-ring="Open"
      className={LINE}
    >
      {children}
    </button>
  );
}
