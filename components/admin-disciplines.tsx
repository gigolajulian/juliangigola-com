"use client";

import * as React from "react";
import Image from "next/image";
import type { AdminProject } from "@/components/admin-projects";
import { cn } from "@/lib/utils";

/* ── the disciplines ──────────────────────────────────────────────
 * Each branch of the site, its work in order, and the photograph that stands
 * for it.
 *
 * The editor had one flat list of seventy-three projects with a text filter
 * over it. That answers "where is VALGUR" and nothing else — not what
 * Editorial opens with, not which six projects are Press shots, not what order
 * a visitor meets them in. Those are the editorial decisions, and none of them
 * were reachable: the running order came from the harvest and the discipline
 * covers were hand-written in `lib/work.ts`, so changing either meant a commit
 * by somebody who could edit code.
 *
 * So the disciplines are the unit of work here. Open one and you get its
 * projects as the visitor will meet them, draggable, with the cover that
 * represents the whole branch sitting above them.
 * ─────────────────────────────────────────────────────────────── */

export type DisciplineGroup = {
  slug: string;
  name: string;
  /** "Work" or "Sessions" — the two halves of the nav. */
  group: string;
  /** The frame it shows today, picked here or derived from its lead project. */
  cover?: string;
};

export function AdminDisciplines({
  disciplines,
  projects,
  hidden,
  order,
  onOrder,
  covers,
  onCover,
  opened,
  onOpened,
}: {
  disciplines: DisciplineGroup[];
  /** Every project, in the running order the draft currently has. */
  projects: AdminProject[];
  hidden: Set<string>;
  /** The running order, by slug. See `lib/added.ts`. */
  order: string[];
  onOrder: (next: string[]) => void;
  covers: Record<string, string>;
  onCover: (categorySlug: string, src: string | null) => void;
  /** Which discipline is expanded, if any. Owned by the editor. */
  opened: string | null;
  onOpened: (slug: string | null) => void;
}) {
  /** Which discipline's cover picker is open. One at a time. */
  const [picking, setPicking] = React.useState<string | null>(null);

  const inDiscipline = React.useMemo(() => {
    const map = new Map<string, AdminProject[]>();
    for (const p of projects) {
      const list = map.get(p.categorySlug);
      if (list) list.push(p);
      else map.set(p.categorySlug, [p]);
    }
    return map;
  }, [projects]);

  /**
   * Moves a project so it lands where it was dropped.
   *
   * The order is one list for the whole site, but this view shows a slice of
   * it — the six projects filed under Press shots, say, with sixty-seven
   * others interleaved between them globally. So a drop cannot be applied to
   * the slice: "put VALGUR above CYBER1A" has to become a position in the
   * full list.
   *
   * Which is why this writes the whole order rather than adding to a partial
   * one. `lib/added.ts` accepts either, and a partial list is the nicer thing
   * to read when nothing has been dragged — but expressing "X before Y, and
   * leave everything else" as a partial list stops being unambiguous the
   * moment two drags overlap. One explicit array is worth the extra lines in
   * the file.
   */
  const reorder = (from: string, to: string) => {
    if (from === to) return;
    // From the projects as currently displayed, which is the draft's order —
    // not from `order`, which may name only some of them.
    const full = projects.map((p) => p.slug);
    const at = full.indexOf(from);
    const onto = full.indexOf(to);
    if (at === -1 || onto === -1) return;

    full.splice(at, 1);
    // `indexOf` again after the removal: taking the dragged project out shifts
    // everything after it, so the index read before the splice is one too high
    // for any forward move.
    full.splice(full.indexOf(to) + (onto > at ? 1 : 0), 0, from);
    onOrder(full);
  };

  return (
    <div className="mt-10 flex flex-col gap-10">
      {["Work", "Sessions"].map((group) => {
        const rows = disciplines.filter((d) => d.group === group);
        if (!rows.length) return null;

        return (
          <section key={group} className="flex flex-col gap-3">
            <p className="label border-b border-border pb-2 text-muted-foreground">
              {group}
            </p>

            {rows.map((d) => {
              const all = inDiscipline.get(d.slug) ?? [];
              const live = all.filter((p) => !hidden.has(p.slug));
              const isOpen = opened === d.slug;
              const cover = covers[d.slug];
              // What the site is showing: a pick if there is one, otherwise
              // whatever `categoryFrame` derived for it.
              const shown = cover ?? d.cover;

              return (
                <div key={d.slug} className="border border-border">
                  {/* Two controls in one row, not one.
                   *
                   * The row used to be a single button that opened the
                   * discipline, with the cover inside it as decoration —
                   * which put the one thing you might want to change behind
                   * two clicks and a hunt, while showing you the picture the
                   * whole time. So the picture is its own control now: click
                   * the cover to change the cover, which is the only thing
                   * anyone was ever going to try.
                   *
                   * It cannot be a button inside a button, so the row is a
                   * flex container holding two — the thumbnail, and
                   * everything else. */}
                  <div
                    className={cn(
                      "flex items-stretch gap-4 px-4 py-3 transition-colors duration-200",
                      isOpen ? "bg-card" : "hoverable:hover:bg-card",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        // Expand as well as open the picker: the picker draws
                        // inside the panel, so opening one without the other
                        // would look like nothing happened.
                        onOpened(d.slug);
                        setPicking(d.slug);
                      }}
                      title={`Change the ${d.name} cover`}
                      className="group relative block h-14 w-11 shrink-0 overflow-hidden bg-card press"
                    >
                      {shown ? (
                        <Image
                          src={shown}
                          alt=""
                          fill
                          sizes="44px"
                          loading="lazy"
                          className="object-cover"
                        />
                      ) : null}
                      {/* Says so on hover rather than carrying a permanent
                          badge over a photograph this small. */}
                      <span className="label absolute inset-0 flex items-center justify-center bg-background/70 text-center text-[0.5rem] leading-tight opacity-0 transition-opacity duration-150 hoverable:group-hover:opacity-100">
                        Change
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpened(isOpen ? null : d.slug)}
                      aria-expanded={isOpen}
                      className="flex min-w-0 flex-1 items-center gap-4 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="font-display block truncate text-lg uppercase tracking-[0.02em]">
                          {d.name}
                        </span>
                        <span className="label block text-muted-foreground">
                          {live.length}{" "}
                          {live.length === 1 ? "project" : "projects"}
                          {all.length !== live.length
                            ? ` · ${all.length - live.length} hidden`
                            : ""}
                          {cover ? " · cover picked" : " · cover derived"}
                        </span>
                      </span>

                      <span className="label shrink-0 text-muted-foreground">
                        {isOpen ? "Close" : "Open"}
                      </span>
                    </button>
                  </div>

                  {isOpen ? (
                    <div className="border-t border-border bg-card/40 p-4">
                      {all.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nothing filed here yet. File a shoot under{" "}
                          {d.name.toLowerCase()} in Projects and it will appear.
                        </p>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="label text-muted-foreground">
                              {cover
                                ? "Cover picked by hand"
                                : "Cover derived from the first project"}
                            </p>
                            <span className="flex gap-2">
                              {cover ? (
                                <button
                                  type="button"
                                  onClick={() => onCover(d.slug, null)}
                                  className={button}
                                >
                                  Back to derived
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() =>
                                  setPicking(picking === d.slug ? null : d.slug)
                                }
                                className={button}
                              >
                                {picking === d.slug
                                  ? "Done choosing"
                                  : "Change cover"}
                              </button>
                            </span>
                          </div>

                          {picking === d.slug ? (
                            <CoverChoices
                              projects={all}
                              chosen={shown}
                              onPick={(src) => {
                                onCover(d.slug, src);
                                setPicking(null);
                              }}
                            />
                          ) : null}

                          <p className="label mt-5 text-muted-foreground">
                            Drag to reorder. The order is the whole site&rsquo;s
                            — a project moved here moves on /work too.
                          </p>

                          <Ordering
                            projects={all}
                            hidden={hidden}
                            onReorder={reorder}
                          />
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

/**
 * The projects of one discipline, in order, draggable.
 *
 * Same mechanics as the frame grid in `admin-frames.tsx`: the dropped index
 * comes back out of `dataTransfer` rather than React state, because `dragging`
 * is set during `dragstart` and a drop arriving before that render has
 * committed would find it null and silently do nothing. No arrows here though
 * — unlike a gallery, this list has a keyboard path already, in the number
 * beside each row.
 */
function Ordering({
  projects,
  hidden,
  onReorder,
}: {
  projects: AdminProject[];
  hidden: Set<string>;
  onReorder: (from: string, to: string) => void;
}) {
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<string | null>(null);

  return (
    <ol className="mt-3 flex flex-col">
      {projects.map((p, i) => (
        <li
          key={p.slug}
          draggable
          onDragStart={(e) => {
            setDragging(p.slug);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", p.slug);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (over !== p.slug) setOver(p.slug);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const from = e.dataTransfer.getData("text/plain");
            if (from) onReorder(from, p.slug);
            setDragging(null);
            setOver(null);
          }}
          onDragEnd={() => {
            setDragging(null);
            setOver(null);
          }}
          className={cn(
            "flex cursor-grab items-center gap-3 border-b border-border py-2 transition-opacity duration-150 active:cursor-grabbing",
            dragging === p.slug && "opacity-30",
            over === p.slug &&
              dragging !== null &&
              dragging !== p.slug &&
              "outline outline-2 outline-offset-2 outline-foreground",
            hidden.has(p.slug) && "opacity-50",
          )}
        >
          <span className="label w-6 shrink-0 tabular-nums text-muted-foreground">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span
            className="relative block h-12 w-10 shrink-0 overflow-hidden"
            style={{ backgroundColor: p.cover.color }}
          >
            <Image
              src={p.cover.src}
              alt=""
              fill
              sizes="40px"
              loading="lazy"
              draggable={false}
              className="object-cover"
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{p.name}</span>
            <span className="label block truncate text-muted-foreground">
              {p.images.length} {p.images.length === 1 ? "frame" : "frames"}
              {hidden.has(p.slug) ? " · hidden" : ""}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Every frame in the discipline, to choose one from.
 *
 * All of them rather than just the covers, because the frame that represents a
 * whole branch of the site is not necessarily the one that opens a project —
 * the cover column is tall and narrow, so a portrait frame from deep in a
 * gallery is often the right pick, and `COVER_OVERRIDES` in `lib/work.ts` did
 * exactly that by hand for three of the disciplines.
 *
 * Lazily loaded: Editorial is eighteen projects and runs to a couple of
 * hundred frames, and none of them are needed until this is open.
 */
function CoverChoices({
  projects,
  chosen,
  onPick,
}: {
  projects: AdminProject[];
  chosen?: string;
  onPick: (src: string) => void;
}) {
  // Three disciplines are covered by a hand-made file in `/hero/` rather than
  // by a frame from a gallery, so the current cover is not among the choices
  // and nothing here can be marked as it. Saying so beats a grid where the
  // highlight is mysteriously missing.
  const elsewhere =
    chosen !== undefined && !projects.some((p) => p.images.includes(chosen));

  return (
    <div className="mt-4 max-h-80 overflow-y-auto border border-border p-3">
      {elsewhere ? (
        <p className="label mb-3 text-muted-foreground">
          Showing <code className="text-foreground">{chosen}</code>, which is
          not one of these — picking any frame below replaces it.
        </p>
      ) : null}

      {projects.map((p) => (
        <div key={p.slug} className="mb-4 last:mb-0">
          <p className="label mb-2 text-muted-foreground">{p.name}</p>
          <ul className="grid grid-cols-5 gap-2 sm:grid-cols-8">
            {p.images.map((src) => (
              <li key={src}>
                <button
                  type="button"
                  onClick={() => onPick(src)}
                  title={src}
                  aria-current={src === chosen ? "true" : undefined}
                  className={cn(
                    "relative block aspect-[4/5] w-full overflow-hidden bg-card press",
                    src === chosen && "outline outline-2 outline-foreground",
                  )}
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="96px"
                    loading="lazy"
                    className="object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

const button =
  "label border border-border px-3 py-2 press hoverable:hover:bg-card";
