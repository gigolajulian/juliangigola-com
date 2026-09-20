"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { Frame } from "@/lib/work-types";
import { useWorkQuery } from "@/lib/work-view";

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

export function WorkList({ rows }: { rows: ListRow[] }) {
  const query = useWorkQuery();
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = words.length ? rows.filter((r) => matches(r, words)) : rows;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
              <Link
                href={row.href}
                prefetch={false}
                data-ring="View project"
                className="group flex items-center gap-5 border-b border-border py-3 press hoverable:hover:bg-card"
              >
                <span
                  className="relative block w-16 shrink-0 overflow-hidden sm:w-20"
                  style={{
                    backgroundColor: row.cover.color,
                    aspectRatio: "4 / 5",
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
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
