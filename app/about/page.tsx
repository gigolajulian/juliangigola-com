import type { Metadata } from "next";
import Link from "next/link";
import { Strip } from "@/components/strip";
import { StripPage, StripHead, RisingTitle } from "@/components/strip-page";
import { PRESS_STUDIO, FEATURED, CONTACT, coverOf } from "@/lib/work";
import { ClientMarks } from "@/components/client-marks";
import { StudioReel } from "@/components/studio-reel";

/* ── about ────────────────────────────────────────────────
 * The old site split this across /about (real, and decent) and /rates
 * (never written — it still shipped the Format demo's biography, about a
 * New-Zealand-born photographer in New York represented by an agency that is
 * not his). One page, his own words only.
 *
 * Two screens. It was five, then four, and each pass found the same thing:
 * a page about one person does not have five things to say, and a screen
 * holding one of five reads as a page that failed to load.
 *
 *   1. Who he is, said in one line, what he is hired for under it, and the
 *      work running down the other half of the window edge to edge. A page
 *      about a photographer opens on photographs.
 *   2. Everything else at once: the biography, the vision, the four phases
 *      of a commission, the names that have been through them, and the ask.
 *      A visitor who has read the first screen is deciding, not browsing,
 *      so the second screen is the whole answer and the way to start.
 */

export const metadata: Metadata = {
  title: "About",
  description:
    "Julian Gigola is a Bay Area creative director and photographer working in editorial, commercial, and artist imagery. Published in WIRED.",
  alternates: { canonical: "/about" },
};

const SERVICES = [
  "Camera operating",
  "Photography",
  "Producing",
  "Post-production",
  "Art direction",
  "Creative direction",
];

const PHASES = [
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
];

export default function AboutPage() {
  /* Six of the shoots that lead the homepage, in the same order, each one
     linking into itself. A portrait frame where the project has one: the
     reel's column is the taller half of the window, so a landscape opener
     would be cropped to a band of its own middle. */
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
    <StripPage
      head={
        <StripHead
          crumb={
            <Link
              prefetch={false}
              href="/work"
              className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
            >
              &larr; The work
            </Link>
          }
          title="About"
          live
          aside="Julian Gigola"
        />
      }
    >
      <Strip
        label="About: who he is, what he is hired for, and how a commission runs. One screen at a time, left and right."
        next={CONTACT}
        paged
        bleed
        className="mt-4 flex-1"
      >
        {/* One: the line, what he is hired for, and the work down the other
            half of the window. */}
        <section
          data-tick
          data-label="About"
          data-hash="about"
          /* Julian: the picture and the words the other way round. The
             picture takes the left-hand column from sm up and the writing
             the rest of the window. Ordered rather than reordered: the
             title still comes first in the markup, which is the order it
             is read in and the order its words rise in, and on a phone
             where there is one column it is still the first thing on the
             screen. */
          className="grid w-full shrink-0 grid-cols-1 sm:h-full sm:grid-cols-[minmax(0,38vw)_1fr]"
        >
          <div className="flex flex-col justify-center gap-8 px-6 py-12 sm:order-2 sm:px-16 sm:py-0">
            <div className="flex flex-col gap-6">
              <RisingTitle text="Bay Area creative director and photographer" />
              <p className="title-rest max-w-prose text-sm leading-relaxed text-muted-foreground">
                Editorial, commercial, and artist imagery, shot in the studio
                and on location. One person behind the lens, from the treatment
                to the final files.
              </p>
            </div>

            {/* A ruled list rather than prose: somebody deciding whether to
                brief him is scanning for one word, and six of them in a
                paragraph is six words to find. On the opening screen because
                it is the other half of the answer to who he is — the line
                says what he does, this says what he is hired for. Two
                columns, so six rows are three deep. */}
            <div className="title-rest flex flex-col gap-3">
              <h2 className="label text-muted-foreground">Services</h2>
              <ul className="grid max-w-xl grid-cols-2 gap-x-10">
                {SERVICES.map((service) => (
                  <li
                    key={service}
                    className="label border-b border-border py-3"
                  >
                    {service}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {shoots.length ? (
            /* Edge to edge: the picture takes the column it is given and the
               name and ticks ride on the foot of it. Held to 4:5 only where
               the strip has stacked and there is no height to take. */
            <StudioReel
              shoots={shoots}
              fill
              className="min-h-0 max-sm:aspect-[4/5] sm:order-1 sm:h-full"
            />
          ) : null}
        </section>

        {/* Two: the writing, the sequence, the names, and the ask. */}
        <section
          data-tick
          data-label="Biography"
          data-hash="biography"
          className="flex w-full shrink-0 flex-col gap-8 px-6 py-12 sm:h-full sm:gap-0 sm:px-16 sm:py-0 sm:pt-12 short:sm:pt-8"
        >
          <div
            data-scroll
            className="grid min-h-0 flex-1 content-center gap-10 overflow-y-auto sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:gap-16 short:sm:gap-10"
          >
            {/* His words. The biography reads as a column. */}
            <div className="flex flex-col gap-8 short:gap-5">
              <div className="flex flex-col gap-3 short:gap-2">
                <h2 className="label text-muted-foreground">Biography</h2>
                <p className="text-sm leading-relaxed lg:text-base short:text-[0.8125rem] short:leading-snug">
                  Bay Area-based creative director and photographer,
                  specialising in editorial, commercial, and artist imagery. My
                  work blends creativity with a keen eye for detail, focusing on
                  everything from studio portraits to location shoots.
                  Photography allows me to explore the world through a unique
                  lens and I&rsquo;m dedicated to bringing out the beauty in
                  every subject I work with. Whether it&rsquo;s a personal
                  project or a collaboration, I strive to create images that
                  resonate and leave a lasting impression.
                </p>
              </div>
            </div>

            {/* How the work is bought, and the way to start it. */}
            <div className="flex flex-col gap-8 short:gap-5">
              <div className="flex flex-col gap-4 short:gap-2">
                <h2 className="label text-muted-foreground">
                  How a commission runs
                </h2>
                <ol className="grid gap-6 sm:grid-cols-2 sm:gap-x-10 short:gap-4">
                  {PHASES.map((phase, i) => (
                    <li key={phase.step} className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <span className="label shrink-0 tabular-nums text-muted-foreground">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {/* The rule carries on from each number to the next
                            step, so the four read as one line of work rather
                            than four cards. The last one has none: the job is
                            done. */}
                        <span
                          aria-hidden
                          className={
                            // Two to a row: the rule runs from a number to
                            // the step beside it, and stops at the end of
                            // the row rather than pointing off the edge.
                            i % 2 === 1 ? "hidden" : "h-px flex-1 bg-border"
                          }
                        />
                      </div>
                      <h3 className="font-display text-2xl uppercase leading-none tracking-[0] lg:text-3xl short:text-xl">
                        {phase.step}
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground short:text-xs">
                        {phase.body}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>

              {/* The ask, on the screen a visitor is on when they have
                  finished deciding, rather than one swipe further on where
                  it was its own page. */}
              <div
                data-hash="enquire"
                className="flex flex-wrap items-center gap-3 border-t border-border pt-6 short:pt-4"
              >
                <Link
                  href="/contact?type=editorial"
                  className="label action px-6 py-4 press active:scale-[0.97] short:py-3"
                >
                  Enquire
                </Link>
                <Link
                  prefetch={false}
                  href="/work"
                  className="label action-quiet px-6 py-4 press active:scale-[0.97] short:py-3"
                >
                  See the work
                </Link>
                <a
                  href="mailto:hello@juliangigola.com"
                  className="label ml-auto text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
                >
                  hello@juliangigola.com
                </a>
              </div>
            </div>
          </div>

          {PRESS_STUDIO.length ? (
            <section
              aria-labelledby="clients"
              className="flex shrink-0 flex-col items-center gap-4 border-t border-border py-5 sm:flex-row sm:justify-center sm:gap-10 short:py-3"
            >
              <h2 id="clients" className="label shrink-0 text-muted-foreground">
                Published &amp; commissioned by
              </h2>
              <ClientMarks clients={PRESS_STUDIO} layout="row" />
            </section>
          ) : null}
        </section>
      </Strip>
    </StripPage>
  );
}
