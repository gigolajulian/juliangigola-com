import Image from "next/image";
import Link from "next/link";
import { RisingTitle } from "@/components/strip-page";
import { LiquidPair } from "@/components/liquid-pair";

/* ── about ────────────────────────────────────────────────
 * A screen of the homepage (Julian: About and Contact on the home page,
 * /about redirects to /#about), laid out from Julian's mockup
 * (2026-09-29): the words, the facts, the services and the ask on the
 * left; a photograph from a set in the middle; how a commission runs on
 * the right, a step a row. The client marks along the foot are gone
 * (Julian, 2026-09-29). His own words only.
 */

const FACTS = [
  ["Shooting", "12 years"],
  ["Based in", "SF Bay Area"],
  ["Travel", "Worldwide"],
];

const SERVICES = [
  "Camera operating",
  "Photography",
  "Producing",
  "Post-production",
  "Art direction",
  "Creative direction",
];

/* How a commission runs: Julian moved it back here from Contact. */
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
    body: "Studio or location, Bay Area or traveling. Art direction on request.",
  },
  {
    step: "Delivery",
    body: "Selects for approval, then final retouched files in the crops and color spaces you need.",
  },
];

/* The photograph in the middle: Julian's own pick (2026-09-29), him on
   stone steps under a tree. The column is narrower than the frame, so
   the crop holds on him, right of centre. */
const PHOTO = {
  src: "/about/julian-steps.jpg",
  width: 960,
  height: 1280,
  alt: "Julian Gigola sitting on stone steps under a tree",
  position: "58% 50%",
  caption: "Julian Gigola",
  tag: "Portrait",
};

export function AboutScreen() {
  return (
    <section
      data-tick
      data-label="About"
      data-hash="about"
      className="relative flex w-full shrink-0 flex-col sm:h-full"
    >
      {/* Scrolls inside itself where a short window cannot hold it all,
          the strip yielding the wheel to it (as the contact form does). */}
      <div
        data-scroll
        className="grid min-h-0 flex-1 grid-cols-1 gap-12 px-6 pb-10 pt-12 sm:overflow-y-auto sm:overscroll-contain sm:px-10 sm:content-start sm:pb-6 sm:pt-[var(--screen-title-y)] md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-x-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.66fr)_minmax(0,1fr)] lg:gap-x-16"
      >
        <div className="flex flex-col">
          <RisingTitle
            /* One line: a no-break space, so it rises as one piece. */
            text={"About me"}
          />
          {/* Julian's words (2026-09-29). */}
          {/* Set left, as the mockup has it: justified mono opens up. */}
          {/* Julian: on a phone, smaller and more inviting, in sentence
              case; the capitals stay from `sm` up. */}
          <p className="title-rest mt-6 text-left text-[0.875rem] normal-case leading-[1.7] max-sm:hyphens-none text-foreground/80 sm:mt-[clamp(1.25rem,3vh,2rem)] sm:text-[clamp(0.8rem,1.6vh,0.95rem)] sm:uppercase sm:leading-[1.75] sm:tracking-[0.04em] sm:text-muted-foreground">
            Photographer and creative director based in the San Francisco
            Bay Area with 12+ years of experience. As an Assyrian American, I grew up between cultures,
            and that sense of being slightly outside the frame shapes how I
            see. I work across editorial fashion, commercial campaigns and
            artist development, helping emerging labels, musicians and
            technology brands find the image that feels most like them.
          </p>
          <dl className="title-rest mt-8 sm:mt-[clamp(1.25rem,3vh,2rem)] grid grid-cols-3 gap-4 border-t border-border pt-6">
            {FACTS.map(([term, value]) => (
              <div key={term}>
                <dt className="label text-muted-foreground">{term}</dt>
                <dd className="label mt-2 text-sm text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="title-rest mt-8 sm:mt-[clamp(1.25rem,3vh,2rem)]">
            <h2 className="label text-muted-foreground">Services</h2>
            {/* Boxes, not pills: pills are the buttons (Julian). Set tight
                so the six hold one line on a wide screen (Julian). */}
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {SERVICES.map((service) => (
                <li
                  key={service}
                  className="label border border-border px-2 py-3 tracking-[0.05em] text-foreground sm:py-[clamp(0.5rem,1.2vh,0.75rem)]"
                >
                  {service}
                </li>
              ))}
            </ul>
          </div>
          <LiquidPair className="title-rest mt-auto flex flex-wrap items-center gap-4 pt-10 sm:pt-[clamp(1.25rem,3vh,2.5rem)]">
            <Link
              href="/?type=editorial#contact"
              className="label action px-7 py-4 press active:scale-[0.97] short:py-2.5"
            >
              Inquire
            </Link>
            <Link
              prefetch={false}
              href="/portfolio"
              className="label action-quiet px-7 py-4 press active:scale-[0.97] short:py-2.5"
            >
              See the work
            </Link>
          </LiquidPair>
        </div>

        <figure className="title-rest flex min-h-0 flex-col gap-3 max-lg:hidden">
          <div className="photo-corner relative min-h-0 flex-1 overflow-hidden rounded-[16px] bg-card">
            <Image
              src={PHOTO.src}
              alt={PHOTO.alt}
              width={PHOTO.width}
              height={PHOTO.height}
              sizes="(min-width: 64rem) 25vw, 100vw"
              data-fade=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: PHOTO.position }}
            />
          </div>
          <figcaption className="label flex justify-between gap-4 text-muted-foreground">
            <span>{PHOTO.caption}</span>
            <span>{PHOTO.tag}</span>
          </figcaption>
        </figure>

        <div className="title-rest flex flex-col">
          <h2 className="label text-muted-foreground">How a commission runs</h2>
          <ol className="mt-4 flex flex-1 flex-col border-b border-border">
            {PHASES.map((phase, i) => (
              <li
                key={phase.step}
                className="grid flex-1 grid-cols-[3.25rem_minmax(0,1fr)] gap-x-5 border-t border-border py-5 sm:grid-cols-[4rem_minmax(0,1fr)] sm:py-[clamp(0.75rem,2vh,1.25rem)]"
              >
                <span className="font-display text-3xl leading-none tabular-nums text-muted-foreground/60 sm:text-[clamp(1.75rem,min(3.6vh,3.4vw),2.6rem)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-display text-3xl uppercase leading-none sm:text-[clamp(1.75rem,min(3.6vh,3.4vw),2.6rem)]">
                    {phase.step}
                  </h3>
                  <p className="label mt-3 max-w-[48ch] text-left sm:mt-[clamp(0.5rem,1.2vh,0.75rem)] leading-relaxed text-muted-foreground">
                    {phase.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

    </section>
  );
}
