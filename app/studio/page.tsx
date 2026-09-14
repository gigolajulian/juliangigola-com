import type { Metadata } from "next";
import { Reveal } from "@/components/reveal";
import { PRESS_STUDIO, FEATURED, coverOf } from "@/lib/work";
import { ClientMarks } from "@/components/client-marks";
import { StudioReel } from "@/components/studio-reel";

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
  /* Six of the shoots that lead the homepage, in the same order, each one
     linking into itself. A portrait frame where the project has one: the
     reel's box is portrait, so a landscape opener would be cropped to a
     band of its own middle. */
  const shoots = FEATURED.slice(0, 6).map((project) => {
    const frame =
      project.images.find((f) => f.height > f.width) ?? coverOf(project);
    return {
      href: `/work/${project.slug}`,
      name: project.name,
      src: frame.src,
      alt: frame.alt || `Frame from ${project.name}`,
      color: frame.color,
    };
  });

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
                <p className="mt-6 text-base leading-relaxed">
                  Bay Area based creative director and photographer,
                  specializing in editorial, commercial, and artist imagery. My
                  work blends creativity with a keen eye for detail, focusing on
                  everything from studio portraits to location shoots.
                  Photography allows me to explore the world through a unique
                  lens and I&rsquo;m dedicated to bringing out the beauty in
                  every subject I work with. Whether it&rsquo;s a personal
                  project or a collaboration, I strive to create images that
                  resonate and leave a lasting impression.
                </p>
              </section>
            </Reveal>

            <Reveal variant="calm">
              <section className="mt-16">
                <h2 className="label text-muted-foreground">Vision</h2>
                <p className="mt-6 text-base leading-relaxed">
                  My vision is to create captivating visual stories that go
                  beyond the surface. As one person behind the lens, I am
                  dedicated to capturing the unique essence of each subject with
                  authenticity, creativity, and a commitment to integrity,
                  crafting images that resonate and inspire.
                </p>
              </section>
            </Reveal>

            {/* What he is hired for, in his own order. A ruled list rather
                than prose: somebody deciding whether to brief him is
                scanning for one word, and six of them in a paragraph is six
                words to find. Two columns from `sm` so the set reads as a
                set rather than as a six-deep menu.

                Hard-coded, like the biography and the commission steps
                above and below it. The copy on this page is not in /admin. */}
            <section className="mt-16">
              <h2 className="label text-muted-foreground">Services</h2>
              <ul className="mt-6 grid gap-x-10 sm:grid-cols-2">
                {[
                  "Camera operating",
                  "Photography",
                  "Producing",
                  "Post production",
                  "Art direction",
                  "Creative direction",
                ].map((service) => (
                  <li
                    key={service}
                    className="label border-b border-border py-3.5"
                  >
                    {service}
                  </li>
                ))}
              </ul>
            </section>

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
                  clients={PRESS_STUDIO}
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
                <ol className="mt-6 flex flex-col gap-8">
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
                      <span className="label shrink-0 pt-2 text-muted-foreground tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        {/* The display face, at the size the section
                            headings use: Julian wanted the step names
                            large. */}
                        <h3 className="font-display text-2xl uppercase leading-none tracking-[0] sm:text-3xl">
                          {phase.step}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {phase.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </Reveal>
          </div>

          {shoots.length ? (
            <StudioReel
              shoots={shoots}
              className="lg:sticky lg:top-28 lg:self-start"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
