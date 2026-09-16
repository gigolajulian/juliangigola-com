"use client";

import * as React from "react";
import { ViewTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { BandTile } from "@/lib/work";

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
 * Loading is the constraint that shapes it. These cells are a third of the
 * viewport wide and most of it tall, so eagerly loading every frame of six
 * projects would cost tens of megabytes. Instead the cover sits underneath
 * as a permanent base layer and the three scrub frames are requested on the
 * first move across the tile — all three, so the crossfade between them has
 * both pictures to hand. A visitor who does not interact pays nothing
 * beyond the cover.
 * ─────────────────────────────────────────────────────────────── */

/** The same query `hoverable:` compiles to in `globals.css`. */
const HOVERABLE = "(hover: hover) and (pointer: fine)";
const subscribeHoverable = (onChange: () => void) => {
  const mq = window.matchMedia(HOVERABLE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

export function WorkBand({
  project,
  index,
  /** The cells above the fold on most screens. */
  priority = false,
}: {
  /** Trimmed on the server to the cover, three frames and the plate's words
      — which three, and why, is with `bandTile` in `lib/work.ts`. */
  project: BandTile;
  index: number;
  priority?: boolean;
}) {
  const frames = project.frames;

  const [active, setActive] = React.useState(0);
  const [scrubbing, setScrubbing] = React.useState(false);

  /* The three frames are mounted from the start wherever there is a pointer
     to scrub with, not on the first move. Mounted on first move, the fade
     had nothing to fade to: the image was still downloading, so the cover
     sat there for the 300ms and the frame popped in afterwards without a
     transition — a cut on exactly the first pass, which is the one a
     visitor judges. Mounted at rest, `loading="lazy"` fetches them as the
     tile scrolls near, and every crossfade has a decoded picture on both
     sides.

     Gated on the pointer rather than always-on because a phone never
     scrubs, and three extra frames on seven tiles at full width is a few
     megabytes it would download for nothing. */
  const touched = React.useSyncExternalStore(
    subscribeHoverable,
    () => window.matchMedia(HOVERABLE).matches,
    () => false,
  );

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    // Touch gets the cover and a plain tap through to the project. Scrubbing
    // with a finger would fight the page scroll, and a "hover" on touch is
    // just a tap that has not decided what it is yet.
    if (e.pointerType === "touch" || frames.length === 0) return;

    const box = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - box.left) / box.width;
    const next = Math.min(
      frames.length - 1,
      Math.max(0, Math.floor(ratio * frames.length)),
    );

    setScrubbing(true);
    setActive(next);
  };

  // Back to the cover. The frames stay mounted and fade out under it — see
  // `touched` — so leaving is the same dissolve as arriving, not a cut.
  const reset = () => {
    setScrubbing(false);
    setActive(0);
  };

  // Keyboard parity: the tile is a link, so once it is focused the arrow keys
  // should walk the sequence the same way the pointer does.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (frames.length === 0) return;
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    // The first press lands on the first frame rather than skipping it.
    setActive(
      (i) => (scrubbing ? i + delta + frames.length : 0) % frames.length,
    );
    setScrubbing(true);
  };

  return (
    <Link
      data-ring="View project"
      style={
        {
          backgroundColor: project.cover.color,
          "--i": index,
        } as React.CSSProperties
      }
      prefetch={false}
      href={`/work/${project.slug}`}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      onBlur={reset}
      onKeyDown={onKeyDown}
      aria-label={`${project.name}, ${project.total} frames`}
      /* One cell of the homepage's grid: three of these to a screen, so
         each is about 4:5 on a laptop — the ratio the work is shot and
         delivered in, which is why three and not four. It fills whatever
         the grid gives it and the photograph covers that box; stacked on a
         phone the grid is one column, so there the ratio sets the height.

         It used to be sized by viewport height (`62vh`), which made the
         shape an accident of the window: at 1440x900 that was a landscape
         box, and every portrait frame lost a third of itself to the
         crop. */
      className="group strip-cell relative block h-full w-full overflow-hidden hoverable:cursor-none max-sm:aspect-[4/5]"
    >
      {/* Base layer: always loaded, never removed. It is what keeps the
            cell from flashing empty the first time a scrub frame is fetched.

            Named as one stack, so what travels is what is on screen: clicking
            the tile does not swap this page for that one, the picture lifts
            out of its cell and settles into the first frame of the project —
            same `name` on both ends, see `gallery.tsx`. Coming back, it
            returns. `share` with `default="none"` so it morphs on that pair
            and does nothing on every other navigation.

            With only the cover named, the trip opened on a cut: on a pointer
            the cell is showing a scrub frame at the moment of the click, and
            the morph set off with the cover from underneath it. Now the
            cover and the three frames are one element, and whatever is
            visible when it is pressed is what lifts out of the cell — and
            dissolves into the project's first frame on the way, which is the
            cover again. */}
      <ViewTransition
        name={`cover-${project.slug}`}
        share="morph"
        default="none"
      >
        <div className="absolute inset-0">
          <Image
            src={project.cover.src}
            alt={project.cover.alt || project.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            priority={priority}
            // The blur-up under it while it loads, and — below the fold,
            // where it is not the largest paint — a fade in when it lands
            // rather than a pop. See `photo-fade.tsx`.
            placeholder={project.cover.blur ? "blur" : "empty"}
            blurDataURL={project.cover.blur}
            data-fade={priority ? undefined : ""}
            className="object-cover"
          />

          {/* The scrub frames, stacked over the cover and dissolved between.

                All three are mounted and only their opacity changes, which is
                what makes the transition a crossfade rather than a swap: the
                frame going out is still there while the one coming in fades up
                over it, and the cover is under both. This used to mount one
                keyed image at a time, which was a hard cut on every step —
                Julian asked for it to be smoother. */}
          {touched
            ? frames.map((f, i) => (
                <Image
                  key={f.src}
                  src={f.src}
                  alt=""
                  fill
                  loading="lazy"
                  sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                  // Two photographs crossfading show both for a moment; a
                  // couple of pixels of blur on whichever is mid-fade makes
                  // them read as one picture resolving — the same trick the
                  // cover's `dissolve` plays, at a fraction of the size.
                  className={cn(
                    "object-cover transition-[opacity,filter] duration-200 ease-[var(--ease-out-strong)] motion-reduce:transition-none",
                    scrubbing && i === active
                      ? "opacity-100 blur-none"
                      : "opacity-0 blur-[2px]",
                  )}
                />
              ))
            : null}
        </div>
      </ViewTransition>

      {/* A plate under the type, not a wash over the picture.
       *
       * This was a gradient two-thirds of the cell tall, fading from the
       * ground to transparent — so making four lines of type legible cost
       * most of the photograph, and every frame was shown through a
       * darkening that got heavier exactly where the subject usually is.
       *
       * The same material as the bar at the top of every page: the ground
       * at 70%, a heavy blur behind it, closed with a hairline. It is the
       * height of its own contents rather than a fixed fraction of the
       * cell, so it covers what it needs to and no more — and being the
       * site's one established translucent surface, it reads as chrome
       * rather than as something wrong with the image.
       */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 border-t border-border/60 glass-surface bg-background/70 p-3 sm:gap-2 sm:p-4">
        <div className="flex items-baseline gap-3 sm:gap-4">
          <span className="label shrink-0 tabular-nums text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          {/* Moved off the photograph and into the plate. On its own in the
                top corner it needed either a second plate or a scrim of its
                own to stay legible over a bright frame. */}
          {/* Sized for a tile in a grid of nine rather than for a cell the
                height of the screen. All nine sit on one screen now, so a
                tile is about 260 by 195 on a laptop: at `text-2xl` with a
                20px surround the plate was taking half of the photograph
                it was labelling. */}
          <h3 className="font-display min-w-0 truncate text-lg uppercase leading-none tracking-[0] sm:text-xl">
            {project.name}
          </h3>
          {/* There was a frame counter here, reading 03 / 12 while the
              pointer scrubbed. Invisible at rest it still held its width,
              and at nine tiles to a screen that width was the end of every
              name: WIRED MAGAZINE came out WIRED MAG... The ticks under
              the name say the same thing and say it without taking a
              letter. */}
        </div>

        <div className="hidden flex-wrap items-baseline gap-x-4 gap-y-1.5 max-sm:flex">
          {/* The credits are a phone thing now. Stacked, a tile is the
              width of the screen and has room for them; in the nine-up
              grid a tile is about 260 wide and the plate was taking half
              the photograph to print two lines that are on the project's
              own page and on the work index anyway. */}
          {project.client ? (
            <p className="label hidden text-muted-foreground max-sm:block">
              {project.client}
            </p>
          ) : null}
          {/* The discipline reads from the left, with the client, and the
                frame count is what gets pushed away.

                It was the other way round: `ml-auto` on the discipline, to
                stop it sitting against the client name and reading as one
                string. That works while there is a client, and a project
                without one — SAGO, most of the music work — was left with a
                discipline stranded on the right of an otherwise empty row,
                under a title starting on the left. Two things aligned to
                nothing in particular.

                So the words stay together on the left, where the eye already
                is, and the counter takes the free space. `ml-auto` on it
                rather than `justify-between` on the row: the first automatic
                margin in a flex row takes all of the space, so with no client
                the discipline still starts at the left edge instead of
                splitting the difference. */}
          <p className="label hidden text-muted-foreground max-sm:block">
            {project.discipline}
          </p>
        </div>

        {/* The scrub position, as a row of ticks. It doubles as the
              affordance — it is what tells you the cell is scrubbable before
              you have moved across it. Hidden where there is no pointer to
              scrub with. */}
        {frames.length > 0 ? (
          <div aria-hidden className="hidden w-full gap-1 hoverable:flex">
            {frames.map((f, i) => (
              <span
                key={f.src}
                className={cn(
                  "h-px flex-1 transition-colors duration-150",
                  i === active && scrubbing
                    ? "bg-foreground"
                    : "bg-foreground/25",
                )}
              />
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
