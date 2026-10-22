import type * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { RisingTitle } from "@/components/strip-page";
import { LiquidPair } from "@/components/liquid-pair";
import { PendingLabel } from "@/components/pending-label";

/* ── about ────────────────────────────────────────────────
 * A screen of the homepage (Julian: About and Contact on the home page,
 * /about redirects to /#about), laid out from Julian's mockup: the
 * words, the facts, the services and the ask on the left; a photograph
 * from a set in the middle; how a commission runs on the right, a step
 * a row. The client marks along the foot are gone. His own words only.
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
    body: "References, usage, deliverables and dates. A deck is welcome but not required.",
  },
  {
    step: "Treatment",
    body: "A lighting and location approach, a shot list and a quote covering crew and licensing.",
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

/* The photograph in the middle: Julian's own pick, him on stone
   steps under a tree. The column is narrower than the frame, so the
   crop holds on him, right of centre. */
const PHOTO = {
  src: "/about/julian-steps.jpg",
  width: 960,
  height: 1280,
  alt: "Julian Gigola sitting on stone steps under a tree",
  position: "58% 50%",
  caption: "Julian Gigola",
};

/* Julian: a way from the biography to the BTS page. Under the photograph
   where it shows, under the buttons where it does not. */
const BTS_LINK =
  "label text-muted-foreground underline decoration-border underline-offset-4 transition-colors duration-200 hoverable:hover:text-foreground";

export function AboutScreen() {
  return (
    <section
      data-tick
      data-label="Biography"
      data-hash="about"
      className="relative flex w-full shrink-0 flex-col sm:h-full"
    >
      {/* Scrolls inside itself where a short window cannot hold it all,
          the strip yielding the wheel to it (as the contact form does). */}
      <div
        data-scroll
        className="about-grid screen-measure grid min-h-0 flex-1 grid-cols-1 gap-12 px-6 pb-10 pt-12 sm:overflow-y-auto sm:overscroll-contain sm:px-10 sm:content-start sm:grid-rows-[minmax(0,1fr)] sm:pb-6 sm:pt-[var(--screen-title-y)] md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-x-12 lying:grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)] lying:gap-x-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.66fr)_minmax(0,1fr)] lg:gap-x-16 lg:max-xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.5fr)_minmax(0,1fr)] lg:max-xl:gap-x-12"
      >
        <div className="flex flex-col sm:min-h-0 sm:portrait:justify-center">
          <RisingTitle
            text="Biography"
            className="lying:text-3xl"
          />
          {/* Julian's words, cut down by him (2026-10-18). I&nbsp;: an
              "I" never ends a line. */}
          {/* Set left, as the mockup has it: justified mono opens up. */}
          {/* Julian: on a phone, smaller and more inviting, in sentence
              case; the capitals stay from `sm` up. */}
          {/* Julian: the words in full, never a scroll of their own
              (its bar clipped the last line). A window too short for
              it all scrolls the screen instead. */}
          <p className="about-bio title-rest mt-6 text-left text-[0.9375rem] normal-case leading-[1.7] text-foreground/80 sm:mt-[clamp(0.75rem,2.5cqh,2rem)] sm:text-[clamp(0.8125rem,1.8vh,1.0625rem)] sm:leading-[clamp(1.25rem,3.1cqh,1.8rem)] sm:text-muted-foreground">
            As an Assyrian American, I&nbsp;grew up between cultures, and
            that sense of being slightly outside the frame shapes how
            I&nbsp;see. I&nbsp;shoot editorial fashion and campaigns for
            brands, and shape the image of labels and musicians. I&nbsp;also
            photograph people&apos;s milestones: headshots, portraits,
            graduations and weddings across San&nbsp;Francisco, San&nbsp;Jose
            and the Bay&nbsp;Area.
          </p>
          <dl className="title-rest mt-8 sm:mt-[clamp(0.75rem,2.5cqh,2rem)] grid grid-cols-3 gap-4 border-t border-border pt-6 sm:pt-[clamp(0.75rem,2.5cqh,1.5rem)]">
            {FACTS.map(([term, value]) => (
              <div key={term}>
                <dt className="label text-muted-foreground">{term}</dt>
                <dd className="label mt-2 text-sm text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="title-rest mt-8 sm:mt-[clamp(0.75rem,2.5cqh,2rem)] lying:hidden">
            <h2 className="label text-muted-foreground">Services</h2>
            {/* Boxes, not pills: pills are the buttons (Julian). Set tight
                so the six hold one line on a wide screen (Julian). */}
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {SERVICES.map((service) => (
                <li
                  key={service}
                  className="label border border-border font-medium px-2 py-3 tracking-[0.05em] text-foreground sm:py-[clamp(0.375rem,1.1cqh,0.75rem)]"
                >
                  {service}
                </li>
              ))}
            </ul>
          </div>
          <LiquidPair className="title-rest mt-auto sm:portrait:mt-0 flex flex-wrap items-center gap-4 pt-10 sm:pt-[clamp(1rem,3cqh,2.5rem)]">
            <Link prefetch={false}
              href="/?type=editorial#contact"
              className="label action px-7 py-4 press active:scale-[0.97] sm:py-[clamp(0.625rem,1.8cqh,1rem)] lying:px-5 lying:!py-2.5"
            >
              <PendingLabel state="composing">Inquire</PendingLabel>
            </Link>
            <Link
              prefetch={false}
              href="/portfolio"
              className="label action-quiet px-7 py-4 press active:scale-[0.97] sm:py-[clamp(0.625rem,1.8cqh,1rem)] lying:px-5 lying:!py-2.5"
            >
              See the work
            </Link>
          </LiquidPair>
          <Link
            prefetch={false}
            href="/bts"
            className={`${BTS_LINK} title-rest mt-5 self-start py-1.5 lg:hidden lying:hidden`}
          >
            Behind the scenes &rarr;
          </Link>
        </div>

        {/* A phone on its side shows him here, not the steps. */}
        <figure className="title-rest flex min-h-0 flex-col gap-3 max-lg:hidden lying:!flex">
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
            <Link prefetch={false} href="/bts" className={`${BTS_LINK} -my-1.5 py-1.5`}>
              Behind the scenes &rarr;
            </Link>
          </figcaption>
        </figure>

        <div className="title-rest flex flex-col sm:min-h-0 sm:portrait:justify-center lying:hidden">
          <h2 className="label text-muted-foreground">How a commission runs</h2>
          {/* And the steps, likewise. */}
          <ol data-scroll className="mt-4 flex flex-1 sm:portrait:flex-none flex-col border-b border-border sm:min-h-0 sm:overflow-x-hidden sm:overflow-y-auto sm:overscroll-contain">
            {PHASES.map((phase, i) => (
              <li
                key={phase.step}
                // The four steps appear in order as About arrives
                // (`.about-step`, globals.css).
                style={{ "--i": i } as React.CSSProperties}
                className="about-step grid flex-1 sm:portrait:flex-none grid-cols-[3.25rem_minmax(0,1fr)] gap-x-5 border-t border-border py-5 sm:grid-cols-[4rem_minmax(0,1fr)] sm:py-[clamp(0.75rem,2vh,1.25rem)]"
              >
                <span className="font-display text-3xl leading-none tabular-nums text-muted-foreground/80 sm:text-[clamp(1.5rem,min(3.6vh,3.4vw),2.6rem)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-display text-3xl uppercase leading-none sm:text-[clamp(1.5rem,min(3.6vh,3.4vw),2.6rem)]">
                    {phase.step}
                  </h3>
                  {/* Sentences in the text face, as the biography beside them:
                      in the labels' caps they ran three and four lines of
                      11px uppercase (audit, 2026-10-14). */}
                  <p className="mt-3 max-w-[48ch] lying:hidden text-left text-[0.8125rem] normal-case sm:mt-[clamp(0.5rem,1.2vh,0.75rem)] leading-relaxed text-muted-foreground">
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
