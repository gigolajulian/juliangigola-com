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

/* The width a tile is drawn at, which is what picks the file (`band-grid` in
   `globals.css`). Measured against production: a tile is 4:5 against half
   of the height left after 20rem of bar and marks, three to a row on an
   upright screen, one on a phone. It said 20vw, which on a 2x laptop asked
   for 680px and got the 1280 file for a 574px tile, four times the pixels
   to decode as the band slid past, and every decode held a frame back. */
const BAND_SIZES =
  "(max-width: 40rem) 100vw, (max-aspect-ratio: 4/5) calc((100vw - 4rem) / 3), max(10rem, calc((100vh - 20rem) * 0.4))";

/** A name's width in ems, set in the display face on one line. */
const nameEm = (name: string) =>
  [...name].reduce((w, c) => w + (c === " " ? 0.3 : 0.72), 0);

export function WorkBand({
  project,
  index,
}: {
  /** Trimmed on the server to the cover, three frames and the plate's words
      — which three, and why, is with `bandTile` in `lib/work.ts`. */
  project: BandTile;
  index: number;
}) {
  const frames = project.frames;

  const [active, setActive] = React.useState(0);
  const [scrubbing, setScrubbing] = React.useState(false);
  /* Julian: the homepage loads the covers and nothing else. The frames a
     tile scrubs through are asked for when the pointer arrives on that
     tile, so a visit that never touches one costs a cover apiece and the
     three frames of six tiles are never fetched at all. They were mounted
     at rest before, which bought a crossfade that never cut on the first
     pass; the first step across a cold tile may cut now, and the rest of
     the pass is a dissolve as before. Per tile, so hovering one does not
     fetch the other five. */
  const [near, setNear] = React.useState(false);

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

  /* Where the pointer was, to tell a move from a tile moving under it.
     A swipe carries the cells past a cursor that is sitting still, and
     the browser re-aims its hover at whatever arrives: the tile under the
     cursor was scrubbing to a new frame on every animation frame of the
     swipe, which is React work in the middle of the one gesture that has
     to stay smooth. A pointer that has not moved is not scrubbing. */
  const was = React.useRef<{ x: number; y: number } | null>(null);

  /* Near means on screen, not under the pointer.
     Asking for the frames when the pointer arrived meant the first pass
     across a tile had nothing to dissolve to: the cover held for the
     length of the fade and the frame appeared at the end of it, a cut on
     exactly the pass a visitor judges. The tile asks as it comes into the
     window instead, a window's margin ahead, so the crossfade always has
     a decoded picture on both sides. Still nothing on a phone, where
     `touched` is false and no finger ever scrubs. */
  const tile = React.useRef<HTMLAnchorElement>(null);
  React.useEffect(() => {
    const el = tile.current;
    if (!el || !touched) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNear(true);
        io.disconnect();
      },
      { rootMargin: "0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [touched]);

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    // Touch gets the cover and a plain tap through to the project. Scrubbing
    // with a finger would fight the page scroll, and a "hover" on touch is
    // just a tap that has not decided what it is yet.
    if (e.pointerType === "touch" || (frames.length === 0 && !project.reel)) return;
    const still = was.current?.x === e.clientX && was.current?.y === e.clientY;
    was.current = { x: e.clientX, y: e.clientY };
    if (still) return;
    setNear(true);

    const box = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - box.left) / box.width;
    // The reel's one tick is lit while it plays.
    const next = Math.max(
      0,
      Math.min(frames.length - 1, Math.floor(ratio * frames.length)),
    );

    setScrubbing(true);
    setActive(next);
  };

  // Back to the cover. The frames stay mounted and fade out under it — see
  // `touched` — so leaving is the same dissolve as arriving, not a cut.
  const reset = () => {
    was.current = null;
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
    setNear(true);
    // The first press lands on the first frame rather than skipping it.
    setActive(
      (i) => (scrubbing ? i + delta + frames.length : 0) % frames.length,
    );
    setScrubbing(true);
  };

  return (
    <Link
      ref={tile}
      /* Julian: rethink the way into the portfolio. The tile is the way:
         it opens the portfolio on its discipline, and says so. */
      data-ring="Open"
      style={
        {
          backgroundColor: project.cover.color,
          "--i": index,
        } as React.CSSProperties
      }
      prefetch={false}
      href={project.href ?? `/portfolio/${project.slug}`}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      onBlur={reset}
      onKeyDown={onKeyDown}
      /* One cell of the homepage's grid: three of these to a screen, so
         each is about 4:5 on a laptop — the ratio the work is shot and
         delivered in, which is why three and not four. It fills whatever
         the grid gives it and the photograph covers that box; stacked on a
         phone the grid is one column, so there the ratio sets the height.

         It used to be sized by viewport height (`62vh`), which made the
         shape an accident of the window: at 1440x900 that was a landscape
         box, and every portrait frame lost a third of itself to the
         crop. */
      className="group strip-cell press relative block h-full w-full overflow-hidden max-sm:aspect-[4/5] active:scale-[0.995]"
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
        {/* Clipped here, for the morph, and again at the tile with the
            plate inside it: Julian saw the plate slip against the picture
            as the screens slid and settled, the two clipped and drawn
            apart. One clip round both and they move as one. The hairline
            the tile's clip once cut into the plate's blur was a fractional
            join, and the rows are whole pixels now (`band-grid`). */}
        <div className="photo-corner absolute inset-0 overflow-hidden">
          <Image
            src={project.cover.src}
            alt={project.cover.alt || project.name}
            fill
            sizes={BAND_SIZES}
            /* Lazy even above the fold: React's server renderer preloads
               every non-lazy image, and three tiles preloaded beside the
               hero were competing with it on a phone, where they are
               below it. A lazy image in view is still fetched as soon as
               the page is laid out. */
            loading="lazy"
            // A fade in when it lands rather than a pop, over the tile's
            // colour (`photo-fade.tsx`). No blur-up: it was the picture's
            // own background, so it faded with it and was never seen, and
            // it cost an SVG document with a 20px blur a tile.
            data-fade=""
            className="object-cover"
          />

          {/* The scrub frames, stacked over the cover and dissolved between.

                All three are mounted and only their opacity changes, which is
                what makes the transition a crossfade rather than a swap: the
                frame going out is still there while the one coming in fades up
                over it, and the cover is under both. This used to mount one
                keyed image at a time, which was a hard cut on every step —
                Julian asked for it to be smoother. */}
          {touched && near
            ? frames.map((f, i) => (
                <Image
                  key={f.src}
                  src={f.src}
                  alt=""
                  fill
                  // The pointer is on the tile: they are wanted now, not
                  // when something else decides they are near.
                  loading="eager"
                  sizes={BAND_SIZES}
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

          {/* The reel under the pointer (Motion), cropped to the tile from
              the middle of the 16:9 film. Mounted only while hovered, so
              nothing of Vimeo's loads until then. */}
          {touched && scrubbing && project.reel ? (
            <iframe
              src={project.reel}
              title=""
              aria-hidden
              tabIndex={-1}
              allow="autoplay; encrypted-media"
              className="pointer-events-none absolute left-1/2 top-1/2 aspect-video h-full max-w-none -translate-x-1/2 -translate-y-1/2 border-0 animate-in fade-in duration-500"
            />
          ) : null}
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
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 glass-surface bg-background/70 p-3 [container-type:inline-size] sm:gap-2 sm:p-4">
        <div className="flex items-baseline gap-3 sm:gap-4">
          {/* Not on a phone, where two tiles share a row and the name needs
              the whole plate to stay readable (BRAND CAMPAIGNS came to 7px on
              an iPhone SE). */}
          <span className="label shrink-0 tabular-nums text-muted-foreground max-sm:hidden">
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
          {/* The link's name is the plate's own words, so voice control
              can say what is printed; the frame count is for ears only. */}
          {/* One line, whatever the tile (Julian: I WANNA BE A HUMAN on two
              lines should not happen on smaller screens). The type comes
              down as far as the whole name needs to fit beside its number
              (2rem, with its gap; `cqw` is the plate inside its padding).
              No floor: Julian, one line everywhere, however small the tile
              (a 1024 by 640 window's are 100px, and the longest name comes
              down to about 3px there). `--name-em` is the name's width in
              ems, measured off Inter Tight 900: a letter is at most 0.72, a
              space 0.3. */}
          <h3 className="font-display min-w-0 whitespace-nowrap text-[min(1.125rem,calc(100cqw/var(--name-em)))] uppercase leading-[0.95] tracking-[0] sm:text-[min(1.25rem,calc((100cqw-2rem)/var(--name-em)))]"
            style={{ "--name-em": nameEm(project.name) } as React.CSSProperties}
          >
            {project.name}
            <span className="sr-only">, {project.total} frames</span>
          </h3>
          {/* There was a frame counter here, reading 03 / 12 while the
              pointer scrubbed. Invisible at rest it still held its width,
              and at nine tiles to a screen that width was the end of every
              name: WIRED MAGAZINE came out WIRED MAG... The ticks under
              the name say the same thing and say it without taking a
              letter. */}
        </div>

        {/* Julian: photo / design / video, on each tile, at every size,
            and on a phone too, where two tiles share a row now and the
            client line that used to be here has no room. */}
        {project.medium ? (
          <p className="label mt-1.5 flex justify-between gap-3 text-muted-foreground">
            <span className="sm:whitespace-nowrap">{project.medium}</span>
            {/* Where the tile goes, brighter and the arrow on under a
                pointer. */}
            <span
              className={`whitespace-nowrap transition-colors duration-200 group-hover:text-foreground${project.medium.length > 8 ? " tile-go-long" : ""}`}
            >
              {/* The words go where the plate is too narrow for them
                  beside its medium, and the arrow stays (`.tile-more` in
                  `globals.css`). */}
              <span
                className={`tile-more${project.medium.length > 8 ? " tile-more-long" : ""}`}
              >
                View more{" "}
              </span>
              <span
                aria-hidden
                className="inline-block transition-transform duration-300 group-hover:translate-x-1"
              >
                &rarr;
              </span>
            </span>
          </p>
        ) : null}

        {/* The scrub position, as a row of ticks. It doubles as the
              affordance — it is what tells you the cell is scrubbable before
              you have moved across it. Hidden where there is no pointer to
              scrub with. The reel gets one, lit while it plays (Julian: the
              same line under Motion as the others). */}
        {frames.length > 0 || project.reel ? (
          <div aria-hidden className="hidden w-full gap-1 hoverable:flex">
            {(project.reel ? [project.reel] : frames.map((f) => f.src)).map((key, i) => (
              <span
                key={key}
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
