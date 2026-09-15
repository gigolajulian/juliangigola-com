import type { Metadata } from "next";
import Link from "next/link";
import { Strip } from "@/components/strip";
import { StripPage, StripHead, RisingTitle } from "@/components/strip-page";
import { EnquiryCell } from "@/components/enquiry-cell";
import { PRESS_STUDIO, FEATURED, CONTACT, coverOf } from "@/lib/work";
import { ClientMarks } from "@/components/client-marks";
import { StudioReel } from "@/components/studio-reel";

/* ── studio ────────────────────────────────────────────────
 * The old site split this across /about (real, and decent) and /rates
 * (never written — it still shipped the Format demo's biography, about a
 * New-Zealand-born photographer in New York represented by an agency that is
 * not his). One page, his own words only.
 *
 * Four screens, each one composed to fill the screen it is on. The first
 * pass was five screens of a small block of type floating in the middle of
 * an empty page: the words were right and the pages were mostly paper.
 *
 *   1. Who he is, said in one line, with the work running down the other
 *      half of the window — the picture edge to edge, not a column with
 *      air above and below it. A page about a photographer opens on
 *      photographs.
 *   2. His words and what he is hired for, on one screen: the biography
 *      read as a column, the vision set as the statement it is, and the
 *      six services ruled under it. These were two screens and neither
 *      filled itself.
 *   3. How a commission runs: four steps laid along the screen with a rule
 *      running through them, and the client marks in a line at the foot.
 *      This is the one thing on the site that is a sequence by nature, and
 *      a sideways page finally draws it as one. The marks used to be a
 *      wall beside the services; a line under the sequence is read in the
 *      second it takes to pass it, which is all a logo needs.
 *   4. The ask.
 * ─────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Studio",
  description:
    "Julian Gigola is a Bay Area creative director and photographer working in editorial, commercial, and artist imagery. Published in WIRED.",
  alternates: { canonical: "/studio" },
};

const SERVICES = [
  "Camera operating",
  "Photography",
  "Producing",
  "Post production",
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

/** Every screen of words sits in the same column and on the same margins. */
const SCREEN =
  "flex w-full shrink-0 flex-col justify-center gap-8 px-6 py-12 sm:h-full sm:px-16 sm:py-0";

export default function StudioPage() {
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
          title="Studio"
          live
          aside="Julian Gigola"
        />
      }
    >
      <Strip
        label="Studio: who he is, what he is hired for, and how a commission runs. One screen at a time, left and right."
        next={CONTACT}
        paged
        bleed
        className="mt-4 flex-1"
      >
        {/* One: the line, and the work down the other half of the window. */}
        <section
          data-tick
          data-label="Studio"
          data-hash="studio"
          className="grid w-full shrink-0 grid-cols-1 sm:h-full sm:grid-cols-[1fr_minmax(0,38vw)]"
        >
          <div className="flex flex-col justify-center gap-6 px-6 py-12 sm:px-16 sm:py-0">
            <RisingTitle text="Bay Area creative director and photographer" />
            <p className="title-rest max-w-prose text-sm leading-relaxed text-muted-foreground">
              Editorial, commercial, and artist imagery, shot in the studio and
              on location. One person behind the lens, from the treatment to the
              final files.
            </p>
          </div>
          {shoots.length ? (
            /* Edge to edge: the picture takes the half window it is given
               and the name and ticks ride on the foot of it. Held to 4:5
               only where the strip has stacked and there is no height to
               take. */
            <StudioReel
              shoots={shoots}
              fill
              className="min-h-0 max-sm:aspect-[4/5] sm:h-full"
            />
          ) : null}
        </section>

        {/* Two: his words, and what he is hired for. */}
        <section
          data-tick
          data-label="Biography"
          data-hash="biography"
          className={SCREEN}
        >
          <div className="grid gap-10 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] sm:items-start sm:gap-16">
            <div className="flex flex-col gap-4">
              <h2 className="label text-muted-foreground">Biography</h2>
              <p className="text-base leading-relaxed sm:text-lg">
                Bay Area based creative director and photographer, specializing
                in editorial, commercial, and artist imagery. My work blends
                creativity with a keen eye for detail, focusing on everything
                from studio portraits to location shoots. Photography allows me
                to explore the world through a unique lens and I&rsquo;m
                dedicated to bringing out the beauty in every subject I work
                with. Whether it&rsquo;s a personal project or a collaboration,
                I strive to create images that resonate and leave a lasting
                impression.
              </p>
            </div>

            <div className="flex flex-col gap-10 sm:gap-12">
              {/* The vision is a statement, not a second paragraph. Set in
                  the display face it reads as the one thing he would say if
                  he could only say one, which is what it is. */}
              <div className="flex flex-col gap-4">
                <h2 className="label text-muted-foreground">Vision</h2>
                <p className="font-display text-2xl uppercase leading-[1.08] tracking-[0] sm:text-[1.75rem] lg:text-[2rem]">
                  My vision is to create captivating visual stories that go
                  beyond the surface. As one person behind the lens, I am
                  dedicated to capturing the unique essence of each subject with
                  authenticity, creativity, and a commitment to integrity,
                  crafting images that resonate and inspire.
                </p>
              </div>

              {/* A ruled list rather than prose: somebody deciding whether
                  to brief him is scanning for one word, and six of them in a
                  paragraph is six words to find. Two columns, so the list
                  sits under the statement rather than running past it. */}
              <div className="flex flex-col gap-4">
                <h2 className="label text-muted-foreground">Services</h2>
                <ul className="grid sm:grid-cols-2 sm:gap-x-12">
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
          </div>
        </section>

        {/* Three: the four steps, drawn as the sequence they are, and the
            names that have been through them. */}
        <section
          data-tick
          data-label="How a commission runs"
          data-hash="how"
          className="flex w-full shrink-0 flex-col px-6 py-12 sm:h-full sm:px-16 sm:py-0 sm:pt-12"
        >
          {/* The running head over the strip is already saying these
              words, and the same four on one screen is the screen telling
              you twice. Kept for anything reading the page rather than
              looking at it. */}
          <h2 className="sr-only">How a commission runs</h2>
          <ol className="grid min-h-0 flex-1 content-center gap-10 py-10 sm:grid-cols-4 sm:gap-12">
            {PHASES.map((phase, i) => (
              <li key={phase.step} className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="label shrink-0 tabular-nums text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {/* The rule carries on from each number to the next step,
                      so the four read as one line of work rather than four
                      cards. The last one has none: the job is done. */}
                  <span
                    aria-hidden
                    className={
                      i === PHASES.length - 1
                        ? "hidden"
                        : "h-px flex-1 bg-border"
                    }
                  />
                </div>
                {/* The display face, at the size Julian asked for: the step
                    names large. */}
                <h3 className="font-display text-4xl uppercase leading-none tracking-[0] lg:text-5xl">
                  {phase.step}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {phase.body}
                </p>
              </li>
            ))}
          </ol>

          {PRESS_STUDIO.length ? (
            <div
              aria-labelledby="clients"
              className="flex shrink-0 flex-col items-center gap-4 border-t border-border py-6 sm:flex-row sm:justify-center sm:gap-10"
            >
              <h2 id="clients" className="label shrink-0 text-muted-foreground">
                Trusted with the work by
              </h2>
              <ClientMarks clients={PRESS_STUDIO} layout="row" />
            </div>
          ) : null}
        </section>

        <EnquiryCell
          title="Commission a shoot"
          body="Tell me what you have in mind and I'll come back with an approach and a quote."
          type="editorial"
          secondary={{ href: "/work", label: "See the work" }}
          next={CONTACT}
          className="px-6 sm:w-full sm:px-16"
        />
      </Strip>
    </StripPage>
  );
}
