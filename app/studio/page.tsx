import type { Metadata } from "next";
import Link from "next/link";
import { Strip } from "@/components/strip";
import { StripPage, StripHead, TitleCell } from "@/components/strip-page";
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
 * Sideways, like the rest of the site: the positioning, the reel, the two
 * pieces of writing, what he is hired for, who has hired him, and the four
 * steps a commission runs through, each its own cell. The steps suit this
 * best of anything on the site — they are a sequence, and now they are read
 * as one.
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
        label="Studio: who he is, how a commission runs, left and right"
        next={CONTACT}
        className="mt-4 flex-1"
      >
        {[
          <TitleCell
            key="title"
            title="Bay Area creative director and photographer"
            hash="studio"
            className="sm:w-[min(34rem,82vw)]"
          />,

          shoots.length ? (
            <div
              key="reel"
              data-tick
              data-label="Reel"
              data-hash="reel"
              className="flex w-full shrink-0 flex-col sm:h-full sm:w-auto"
            >
              <StudioReel shoots={shoots} />
            </div>
          ) : null,

          <section
            key="biography"
            data-tick
            data-label="Biography"
            data-hash="biography"
            className="flex w-full shrink-0 flex-col justify-center gap-6 py-8 sm:h-full sm:w-[min(28rem,70vw)] sm:py-0"
          >
            <h2 className="label text-muted-foreground">Biography</h2>
            <div
              data-scroll
              className="min-h-0 overflow-y-auto overscroll-contain pr-2 text-base leading-relaxed"
            >
              <p>
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
          </section>,

          <section
            key="vision"
            data-tick
            data-label="Vision"
            data-hash="vision"
            className="flex w-full shrink-0 flex-col justify-center gap-6 py-8 sm:h-full sm:w-[min(28rem,70vw)] sm:py-0"
          >
            <h2 className="label text-muted-foreground">Vision</h2>
            <div
              data-scroll
              className="min-h-0 overflow-y-auto overscroll-contain pr-2 text-base leading-relaxed"
            >
              <p>
                My vision is to create captivating visual stories that go beyond
                the surface. As one person behind the lens, I am dedicated to
                capturing the unique essence of each subject with authenticity,
                creativity, and a commitment to integrity, crafting images that
                resonate and inspire.
              </p>
            </div>
          </section>,

          /* What he is hired for, in his own order. A ruled list rather than
             prose: somebody deciding whether to brief him is scanning for
             one word, and six of them in a paragraph is six words to find.
             Hard-coded, like the biography and the steps: the copy on this
             page is not in /admin. */
          <section
            key="services"
            data-tick
            data-label="Services"
            data-hash="services"
            className="flex w-full shrink-0 flex-col justify-center gap-6 py-8 sm:h-full sm:w-[min(24rem,60vw)] sm:py-0"
          >
            <h2 className="label text-muted-foreground">Services</h2>
            <ul className="flex min-h-0 flex-col overflow-y-auto" data-scroll>
              {SERVICES.map((service) => (
                <li key={service} className="label border-b border-border py-3">
                  {service}
                </li>
              ))}
            </ul>
          </section>,

          PRESS_STUDIO.length ? (
            <section
              key="clients"
              data-tick
              data-label="Clients"
              data-hash="clients"
              className="flex w-full shrink-0 flex-col justify-center gap-6 py-8 sm:h-full sm:w-[min(36rem,70vw)] sm:py-0"
            >
              <div>
                <h2 className="label text-muted-foreground">
                  Selected clients &amp; press
                </h2>
                <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
                  A few of the people who have trusted me with the work. Each
                  one goes to what we made.
                </p>
              </div>
              {/* A wall rather than a list of rows. Client logos are read as
                  a set — the eye is counting names it recognises, not
                  reading them in order. */}
              <ClientMarks clients={PRESS_STUDIO} layout="grid" />
            </section>
          ) : null,

          <div
            key="how"
            data-tick
            data-label="How a commission runs"
            data-hash="how"
            className="flex w-full shrink-0 flex-col justify-center gap-3 py-8 sm:h-full sm:w-[min(18rem,40vw)] sm:py-0"
          >
            <h2 className="label text-muted-foreground">
              How a commission runs
            </h2>
            <p className="font-display text-3xl uppercase leading-none tracking-[0] sm:text-4xl">
              Four steps
            </p>
          </div>,

          ...PHASES.map((phase, i) => (
            <div
              key={phase.step}
              data-tick
              data-label={phase.step}
              data-hash={phase.step.toLowerCase()}
              className="flex w-full shrink-0 flex-col justify-center gap-4 py-8 sm:h-full sm:w-[min(20rem,55vw)] sm:py-0"
            >
              <span className="label tabular-nums text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              {/* The display face, at the size Julian asked for: the step
                  names large. */}
              <h3 className="font-display text-4xl uppercase leading-none tracking-[0]">
                {phase.step}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {phase.body}
              </p>
            </div>
          )),

          <EnquiryCell
            key="enquire"
            title="Commission a shoot"
            body="Tell me what you have in mind and I'll come back with an approach and a quote."
            type="editorial"
            secondary={{ href: "/work", label: "See the work" }}
            next={CONTACT}
          />,
        ]}
      </Strip>
    </StripPage>
  );
}
