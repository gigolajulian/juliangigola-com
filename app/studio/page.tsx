import type { Metadata } from "next";
import Link from "next/link";
import { Strip } from "@/components/strip";
import { StripPage, StripHead, RisingTitle } from "@/components/strip-page";
import { EnquiryCell } from "@/components/enquiry-cell";
import { PRESS_STUDIO, FEATURED, CONTACT, coverOf } from "@/lib/work";
import { ClientMarks } from "@/components/client-marks";
import { StudioReel } from "@/components/studio-reel";

/* ── studio ───────────────────────────────────────────────────────
 * The old site split this across /about (real, and decent) and /rates
 * (never written — it still shipped the Format demo's biography, about a
 * New-Zealand-born photographer in New York represented by an agency that is
 * not his). One page, his own words only.
 *
 * Five screens, one thing each, and a gesture moves exactly one of them:
 *
 *   1. Who he is, said in one line, with the work running beside it.
 *   2. The writing — the biography and the vision, two columns of one
 *      screen, because they are one thought and swiping for the second half
 *      of it would be worse than the column this replaced.
 *   3. What he is hired for, and who has hired him.
 *   4. How a commission runs: four steps laid along the screen with a rule
 *      running through them. This is the one thing on the site that is a
 *      sequence by nature, and a sideways page finally draws it as one.
 *   5. The ask.
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
        {/* One: the line, with the work beside it. A page about a
            photographer opens on photographs. */}
        <section
          data-tick
          data-label="Studio"
          data-hash="studio"
          className="grid w-full shrink-0 grid-cols-1 sm:h-full sm:grid-cols-[1fr_auto]"
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
            <div className="min-h-0 px-6 pb-12 sm:px-0 sm:pb-0">
              <StudioReel shoots={shoots} className="h-full" />
            </div>
          ) : null}
        </section>

        {/* Two: the writing, both pieces at once. */}
        <section
          data-tick
          data-label="Biography"
          data-hash="biography"
          className={SCREEN}
        >
          <div className="grid gap-10 sm:grid-cols-2 sm:gap-16">
            <div className="flex flex-col gap-4">
              <h2 className="label text-muted-foreground">Biography</h2>
              <p className="text-base leading-relaxed">
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
            <div className="flex flex-col gap-4">
              <h2 className="label text-muted-foreground">Vision</h2>
              <p className="text-base leading-relaxed">
                My vision is to create captivating visual stories that go beyond
                the surface. As one person behind the lens, I am dedicated to
                capturing the unique essence of each subject with authenticity,
                creativity, and a commitment to integrity, crafting images that
                resonate and inspire.
              </p>
            </div>
          </div>
        </section>

        {/* Three: what he is hired for, and who has hired him. A ruled list
            rather than prose — somebody deciding whether to brief him is
            scanning for one word, and six of them in a paragraph is six
            words to find. */}
        <section
          data-tick
          data-label="Services"
          data-hash="services"
          className={SCREEN}
        >
          <div className="grid gap-10 sm:grid-cols-[minmax(0,20rem)_1fr] sm:gap-16">
            <div className="flex flex-col gap-4">
              <h2 className="label text-muted-foreground">Services</h2>
              <ul className="flex flex-col">
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

            {PRESS_STUDIO.length ? (
              <div className="flex min-w-0 flex-col gap-4">
                <h2 className="label text-muted-foreground">
                  Selected clients &amp; press
                </h2>
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                  A few of the people who have trusted me with the work. Each
                  one goes to what we made.
                </p>
                {/* A wall rather than a list of rows: the eye is counting
                    names it recognises, not reading them in order. */}
                <ClientMarks clients={PRESS_STUDIO} layout="grid" />
              </div>
            ) : null}
          </div>
        </section>

        {/* Four: the four steps, drawn as the sequence they are. */}
        <section
          data-tick
          data-label="How a commission runs"
          data-hash="how"
          className={SCREEN}
        >
          <h2 className="label text-muted-foreground">How a commission runs</h2>
          <ol className="grid gap-8 sm:grid-cols-4 sm:gap-10">
            {PHASES.map((phase, i) => (
              <li key={phase.step} className="flex flex-col gap-3">
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
                <h3 className="font-display text-3xl uppercase leading-none tracking-[0]">
                  {phase.step}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {phase.body}
                </p>
              </li>
            ))}
          </ol>
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
