"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/work-types";

/* ── the scrub tile ───────────────────────────────────────────────
 * One featured project as a grid cell, and moving across it scrubs through
 * that project's actual sequence.
 *
 * The interaction has a job rather than being motion for its own sake: a
 * single cover tells you a project exists, and scrubbing tells you whether
 * the whole set is any good — which is the question an art director is
 * actually asking. It is direct manipulation, so nothing moves unless the
 * visitor moves it, and there is no autoplay to sit through.
 *
 * Loading is the constraint that shapes it. These cells are half the viewport
 * wide and most of it tall, so eagerly loading every frame of six projects
 * would cost tens of megabytes. Instead the cover sits underneath as a
 * permanent base layer and exactly one scrub frame is requested — the one
 * being looked at. Scrubbing costs one image per frame you actually visit,
 * the base never blanks, and a visitor who does not interact pays nothing
 * beyond the cover.
 * ─────────────────────────────────────────────────────────────── */

/**
 * Frames a tile will scrub through. Capped because the useful signal is "what
 * is the range of this set", which eight frames answer as well as thirty, and
 * because it sets a ceiling on what a determined scrub can download.
 */
const MAX_SCRUB = 8;

export function WorkBand({
  project,
  index,
  /** The cells above the fold on most screens. */
  priority = false,
}: {
  project: Project;
  index: number;
  priority?: boolean;
}) {
  const frames = React.useMemo(() => project.images.slice(0, MAX_SCRUB), [project.images]);

  const [active, setActive] = React.useState(0);
  const [scrubbing, setScrubbing] = React.useState(false);

  const client = project.credits.find((c) => /client|artist|model/i.test(c.role));

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    // Touch gets the cover and a plain tap through to the project. Scrubbing
    // with a finger would fight the page scroll, and a "hover" on touch is
    // just a tap that has not decided what it is yet.
    if (e.pointerType === "touch" || frames.length < 2) return;

    const box = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - box.left) / box.width;
    const next = Math.min(frames.length - 1, Math.max(0, Math.floor(ratio * frames.length)));

    setScrubbing(true);
    setActive(next);
  };

  const reset = () => {
    setScrubbing(false);
    setActive(0);
  };

  // Keyboard parity: the tile is a link, so once it is focused the arrow keys
  // should walk the sequence the same way the pointer does.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (frames.length < 2) return;
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    setScrubbing(true);
    setActive((i) => (i + delta + frames.length) % frames.length);
  };

  const frame = frames[active] ?? project.cover;
  const showScrub = scrubbing && active > 0;

  return (
    <article className="bg-background">
      <Link
        href={`/work/${project.slug}`}
        onPointerMove={onPointerMove}
        onPointerLeave={reset}
        onBlur={reset}
        onKeyDown={onKeyDown}
        aria-label={`${project.name} — ${project.images.length} frames`}
        // 4:5, the ratio the work is shot and delivered in.
        //
        // This was sized by viewport height — `62vh`, `68vh` above `lg` —
        // which made the cell's shape an accident of the browser window. At
        // 1440x900 that is a 720x612 landscape box, so every portrait frame
        // was centre-cropped by `object-cover` and roughly a third of each
        // photograph never appeared on the homepage.
        //
        // Fixing the ratio to the frame's own means the crop is nil where the
        // cover is 4:5 and slight where it is taller, instead of severe
        // everywhere.
        className="group relative block aspect-[4/5] w-full overflow-hidden"
        style={{ backgroundColor: project.cover.color }}
      >
        {/* Base layer: always loaded, never removed. It is what keeps the
            cell from flashing empty the first time a scrub frame is fetched. */}
        <Image
          src={project.cover.src}
          alt={project.cover.alt || project.name}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
          priority={priority}
          className="object-cover"
        />

        {/* Scrub layer: one frame, the one under the pointer. Keyed on `src`
            so React swaps the element rather than mutating it, which lets the
            browser keep the decoded previous frame on screen until the next
            one is ready. */}
        {showScrub ? (
          <Image
            key={frame.src}
            src={frame.src}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        ) : null}

        {/* The scrim is bottom-weighted only. A flat overlay across the cell
            would dim the photograph everywhere to make type legible in one
            corner. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/50 to-transparent"
        />

        <p className="label absolute left-6 top-6 tabular-nums text-muted-foreground sm:left-8 sm:top-8">
          {String(index + 1).padStart(2, "0")}
        </p>

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-6 sm:p-8">
          <h3 className="font-display max-w-[16ch] text-3xl uppercase leading-[0.95] tracking-[0.01em] sm:text-4xl lg:text-5xl">
            {project.name}
          </h3>

          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            {client ? <p className="label text-muted-foreground">{client.name}</p> : null}
            <p className="label text-muted-foreground">
              {project.categories[0]?.name ?? "Project"}
            </p>
            <p className="label ml-auto tabular-nums text-muted-foreground">
              {String(active + 1).padStart(2, "0")} / {String(frames.length).padStart(2, "0")}
            </p>
          </div>

          {/* The scrub position, as a row of ticks. It doubles as the
              affordance — it is what tells you the cell is scrubbable before
              you have moved across it. Hidden where there is no pointer to
              scrub with. */}
          {frames.length > 1 ? (
            <div aria-hidden className="hidden w-full gap-1 hoverable:flex">
              {frames.map((f, i) => (
                <span
                  key={f.src}
                  className={cn(
                    "h-px flex-1 transition-colors duration-150",
                    i === active && scrubbing ? "bg-foreground" : "bg-foreground/25",
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
