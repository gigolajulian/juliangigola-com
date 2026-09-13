import type { Metadata } from "next";
import { Reveal } from "@/components/reveal";
import Image from "next/image";
import { PRESS, FEATURED, coverOf } from "@/lib/work";
import { ClientMarks } from "@/components/client-marks";

/* ── studio ───────────────────────────────────────────────────────
 * The old site split this across /about (real, and decent) and /rates
 * (never written — it still shipped the Format demo's biography, about a
 * New-Zealand-born photographer in New York represented by an agency that is
 * not his). One page, his own words only.
 * ─────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Studio",
  description:
    "Julian Gigola is a Bay Area creative director and photographer working in editorial, commercial, and artist imagery. Published in WIRED.",
  alternates: { canonical: "/studio" },
};

export default function StudioPage() {
  const portrait = FEATURED[0] ? coverOf(FEATURED[0]) : null;

  return (
    <div className="pb-24 pt-28 sm:pt-36">
      <div className="mx-auto max-w-[100rem] px-6 sm:px-10">
        <h1 className="max-w-[20ch] title">
          Bay Area creative director and photographer.
        </h1>

        {/* No `stagger` here. The four sections are stacked down a long
            column and cross the fold minutes apart in reading time, so they
            already arrive one at a time — a stepped delay would only add lag
            to something that is never seen simultaneously. */}
        <div className="mt-16 grid gap-16 lg:mt-24 lg:grid-cols-[1fr_0.8fr] lg:gap-24">
          <div className="max-w-prose">
            <Reveal variant="calm">
              <section>
                <h2 className="label text-muted-foreground">Biography</h2>
                {/* Rewritten from copy that said nothing a hundred other
                    photographers could not have said: "blends creativity with
                    a keen eye for detail", "explore the world through a unique
                    lens", "resonate and leave a lasting impression". Every
                    sentence was an adjective doing a noun's work, and a reader
                    finished it knowing no more than the page title had already
                    told them.

                    What replaces it is the specifics — who he shoots for,
                    where, alone, and what that is like to hire. The one real
                    thing in the old version was "as one person behind the
                    lens", which was buried in the Vision paragraph; it is the
                    most useful fact on the page for an art director costing a
                    job, so it leads now. */}
                <div className="mt-6 flex flex-col gap-5 text-base leading-relaxed">
                  <p>
                    I&rsquo;m Julian. I photograph people &mdash; for
                    magazines, for brands, and for artists who need a cover
                    that looks like the record sounds.
                  </p>
                  <p>
                    I work out of the Bay Area, and I work alone. I light it, I
                    shoot it, I cut it. That keeps a job small enough to move
                    quickly and close enough that nothing gets lost between
                    people, which is usually where a shoot goes wrong. When a
                    day needs more hands, I bring them and tell you who they
                    are.
                  </p>
                  <p>
                    Editorial is where I started &mdash; WIRED ran a set
                    &mdash; and campaigns are most of it now. In between there
                    is a lot of studio: portraits, press kits, two dozen record
                    sleeves, and a growing stack of film.
                  </p>
                  <p>
                    If you are here for a session rather than a commission,
                    it&rsquo;s the same camera and the same attention. Just a
                    shorter day.
                  </p>
                </div>
              </section>
            </Reveal>

            <Reveal variant="calm">
              <section className="mt-16">
                <h2 className="label text-muted-foreground">
                  How I see it
                </h2>
                {/* "Vision" over "captivating visual stories that go beyond
                    the surface" was the emptiest thing on the site: a heading
                    that promises a point of view above a paragraph that has
                    none. A point of view is a sentence somebody could
                    disagree with, so this one says something that other
                    photographers would argue with. */}
                <div className="mt-6 flex flex-col gap-5 text-base leading-relaxed">
                  <p>
                    Most pictures fail because everyone was performing &mdash;
                    the subject for the camera, the camera for the trend. I
                    would rather spend the first twenty minutes getting past
                    that than the last twenty fixing it in a retouch.
                  </p>
                  <p>
                    So: fewer lights than you would expect, more patience than
                    the schedule suggests, and people left recognisable rather
                    than styled into someone else. A photograph that still
                    holds up when the look it was shot in has passed is the
                    only kind worth paying for twice.
                  </p>
                </div>
              </section>
            </Reveal>

            <Reveal variant="calm">
              <section className="mt-16">
                <h2 className="label text-muted-foreground">
                  Selected clients &amp; press
                </h2>
                <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
                  A few of the people who have trusted me with the work. Each
                  one goes to what we made.
                </p>
                {/* A wall rather than a list of rows. Client logos are read as
                    a set — the eye is counting names it recognises, not
                    reading them in order — and a stack of full-width rows with
                    "View →" on each made five clients look like a menu of
                    five destinations. */}
                <ClientMarks
                  clients={PRESS}
                  layout="grid"
                  className="mt-10 border-y border-border py-12"
                />
              </section>
            </Reveal>

            <Reveal variant="calm">
              <section className="mt-16">
                <h2 className="label text-muted-foreground">
                  How a commission runs
                </h2>
                <ol className="mt-6 flex flex-col gap-6">
                  {[
                    {
                      step: "Brief",
                      body: "References, usage, deliverables, and dates. A deck is welcome but not required.",
                    },
                    {
                      step: "Treatment",
                      body: "A lighting and location approach, a shot list, and a quote covering crew and licensing.",
                    },
                    {
                      step: "Shoot",
                      body: "Studio or location, Bay Area or travelling. Art direction on request.",
                    },
                    {
                      step: "Delivery",
                      body: "Selects for approval, then final retouched files in the crops and colour spaces you need.",
                    },
                  ].map((phase, i) => (
                    <li key={phase.step} className="flex gap-6">
                      <span className="label shrink-0 pt-1 text-muted-foreground tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3 className="text-sm font-medium">{phase.step}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {phase.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </Reveal>
          </div>

          {portrait ? (
            <div className="lg:sticky lg:top-28 lg:self-start">
              <div
                className="relative overflow-hidden"
                style={{
                  backgroundColor: portrait.color,
                  aspectRatio: `${portrait.width} / ${portrait.height}`,
                }}
              >
                <Image
                  src={portrait.src}
                  alt={portrait.alt || "Frame from a recent commission"}
                  width={portrait.width}
                  height={portrait.height}
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="label mt-4 text-muted-foreground">
                {FEATURED[0]?.name} &middot; recent
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
