"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Discipline } from "@/lib/work";

/* ── the cover ────────────────────────────────────────────────────
 * A masthead grid that cycles through the four things he actually does.
 *
 * "Photographer & creative director" is a job title; editorial, campaigns,
 * portraits and music are the four things somebody might be here to
 * commission. So the discipline is set large and switches, and the picture
 * switches with it — which says the range in the first few seconds in a way
 * one static cover cannot.
 *
 * This is not the carousel it could easily have become:
 *
 *   - The type leads and the image follows it. The switch is informational —
 *     it names a discipline and shows work from it — rather than a slideshow
 *     of pictures for their own sake.
 *   - Nothing moves. The change is a crossfade, no sliding, no zooming.
 *   - It is a control, not a decoration. The four disciplines are a real
 *     index: hovering one previews it, clicking one goes to that work. The
 *     cycle is what happens while nobody is using it, and it stops for good
 *     the moment somebody does.
 *   - It respects `prefers-reduced-motion` by not cycling at all.
 *
 * Nothing is cropped. The frames run 0.71 to 0.80 in aspect and the column
 * cannot match all of them, so the picture is `object-contain`ed rather than
 * `cover`ed — the whole photograph is always on screen.
 *
 * What that leaves is a band of empty column, and the band is filled with
 * that frame's own dominant colour. So instead of letterbox bars it reads as
 * a print on a mount pulled from the picture, which is how a photograph gets
 * hung. The colour crossfades with the frame, so switching discipline changes
 * the mount too.
 * ─────────────────────────────────────────────────────────────── */

/** Long enough to read the word and look at the picture before it moves on. */
const DWELL_MS = 4200;

export function Hero({ disciplines }: { disciplines: Discipline[] }) {
  const [active, setActive] = React.useState(0);
  // Once someone points at the index themselves, the cycle has done its job
  // and further movement would be fighting them for control.
  const [taken, setTaken] = React.useState(false);

  React.useEffect(() => {
    if (taken || disciplines.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(
      () => setActive((i) => (i + 1) % disciplines.length),
      DWELL_MS,
    );
    return () => window.clearInterval(id);
  }, [taken, disciplines.length]);

  const take = (i: number) => {
    setTaken(true);
    setActive(i);
  };

  /** Finds which row an event came from and switches to it. */
  const takeFromEvent = (e: React.SyntheticEvent) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-discipline]");
    if (!row) return;
    const i = Number(row.dataset.discipline);
    if (Number.isInteger(i)) take(i);
  };

  const current = disciplines[active];
  if (!current) return null;

  return (
    <section className="border-b border-border">
      <div className="grid lg:min-h-[90dvh] lg:grid-cols-12">
        {/* The photograph leads on a phone — it is the hook — but it is held
            to half the screen so the name and both ways in stay visible
            without scrolling. */}
        <div
          className="relative order-first h-[52dvh] transition-colors duration-700 ease-[var(--ease-out-strong)] motion-reduce:transition-none lg:order-last lg:col-span-6 lg:h-auto"
          style={{ backgroundColor: current.frame.color }}
        >
          {/* All four frames are mounted and crossfaded rather than swapped,
              so a switch never waits on a network request and never shows a
              gap. Only the first is `priority`; the rest load at normal
              priority behind it, which they have four seconds to do. */}
          {disciplines.map((discipline, i) => (
            <Image
              key={discipline.slug}
              src={discipline.frame.src}
              alt={
                i === active
                  ? discipline.frame.alt || `${discipline.name} work by Julian Gigola`
                  : ""
              }
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              priority={i === 0}
              aria-hidden={i === active ? undefined : true}
              className={cn(
                // `contain`, not `cover` — the whole frame, never a crop.
                "object-contain transition-opacity duration-700 ease-[var(--ease-out-strong)]",
                "motion-reduce:transition-none",
                i === active ? "opacity-100" : "opacity-0",
              )}
            />
          ))}

          <Link
            href={`/work/${current.project.slug}`}
            // Credits the frame on screen, so the cover is attributable
            // rather than anonymous decoration — and gives someone who likes
            // it somewhere to go straight away.
            className="label absolute bottom-4 right-4 z-10 bg-background/70 px-3 py-2 text-muted-foreground backdrop-blur-sm transition-colors duration-200 hoverable:hover:text-foreground sm:bottom-6 sm:right-6"
          >
            {current.project.name} &rarr;
          </Link>
        </div>

        <div className="flex flex-col lg:col-span-6 lg:border-r lg:border-border">
          {/* One: the standing details, as a running head. The tall top
              padding on desktop clears the fixed header so the nav never
              crowds the rule. */}
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-border px-6 pb-5 pt-10 sm:px-10 lg:pt-28">
            <p className="label text-muted-foreground">Photographer &amp; creative director</p>
            {/* `ml-auto` rather than `justify-between`, so when the column is
                too narrow for both — which it is at exactly the `lg`
                breakpoint — this drops to its own line and stays flush right
                instead of the left label wrapping under a stranded item. */}
            <p className="label ml-auto shrink-0 text-muted-foreground">Bay Area</p>
          </div>

          {/* Two: the masthead, set once. The header's wordmark holds back on
              this route until this has scrolled away — printing the name
              twice, forty pixels apart, is what made an earlier version of
              this page look amateur. */}
          <h1 className="px-6 pt-8 sm:px-10 sm:pt-10">
            <span className="display block">Julian Gigola</span>

            {/* The switching half. Deliberately not a live region: it would
                announce a new discipline every four seconds, which is noise
                rather than information. Nothing is lost by hiding it — all
                four disciplines are listed as real links immediately below,
                which is the accessible version of the same content. */}
            <span
              aria-hidden
              className="font-display mt-2 block text-3xl uppercase leading-none tracking-[0.02em] text-muted-foreground sm:mt-3 sm:text-4xl"
            >
              {current.name}
            </span>
          </h1>

          {/* Three: the index. This is the switcher's control and the site's
              discipline navigation at the same time — hover previews, click
              goes there. Numbering is what keeps it an index rather than a
              row of buttons. */}
          {/* One delegated handler on the list rather than an
              `onPointerEnter` per row.
              `pointerenter` does not bubble — React synthesises it from
              `pointerover`, and that synthesis did not fire reliably here
              either on the `Link` (which consumes pointer events of its own
              for prefetching) or on the row. `pointerover` and `focusin` do
              bubble, so a single listener on the list is both simpler and
              actually dependable. The row index rides on a data attribute
              instead of being captured in four closures. */}
          <nav aria-label="Disciplines" className="mt-8 border-t border-border sm:mt-10">
            <ul onPointerOver={takeFromEvent} onFocus={takeFromEvent}>
              {disciplines.map((discipline, i) => (
                <li
                  key={discipline.slug}
                  className="border-b border-border"
                  data-discipline={i}
                >
                  <Link
                    href="/work"
                    aria-current={i === active ? "true" : undefined}
                    className={cn(
                      "group flex items-baseline gap-4 px-6 py-4 transition-colors duration-300 sm:px-10",
                      i === active ? "bg-card" : "hoverable:hover:bg-card",
                    )}
                  >
                    <span className="label shrink-0 tabular-nums text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "font-display text-xl uppercase leading-none tracking-[0.02em] transition-colors duration-300 sm:text-2xl",
                        i === active ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {discipline.name}
                    </span>
                    <span className="label ml-auto shrink-0 tabular-nums text-muted-foreground">
                      {discipline.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Four: the two ways in, pinned to the foot of the column so the
              type block is anchored at both ends against the full height of
              the picture rather than drifting in the middle. */}
          <div className="mt-auto flex flex-wrap items-center gap-3 px-6 py-8 sm:px-10 sm:py-10">
            <Link
              href="/work"
              className="label border border-foreground bg-foreground px-6 py-4 text-background transition-[opacity,transform] duration-150 ease-out hoverable:hover:opacity-90 active:scale-[0.98]"
            >
              See the work
            </Link>
            <Link
              href="/sessions"
              className="label border border-border px-6 py-4 transition-[background-color,transform] duration-150 ease-out hoverable:hover:bg-card active:scale-[0.98]"
            >
              Book a session
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
