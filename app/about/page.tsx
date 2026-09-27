import type { Metadata } from "next";
import Link from "next/link";
import { Strip } from "@/components/strip";
import { StripPage, StripHead, RisingTitle } from "@/components/strip-page";
import { PRESS_STUDIO, CONTACT, SESSIONS_PAGE } from "@/lib/work";
import { ClientMarks } from "@/components/client-marks";
import { AboutHero } from "@/components/about-hero";

/* ── about ────────────────────────────────────────────────
 * The old site split this across /about (real, and decent) and /rates
 * (never written — it still shipped the Format demo's biography, about a
 * New-Zealand-born photographer in New York represented by an agency that is
 * not his). One page, his own words only.
 *
 * Two screens. It was five, then four, then three; Julian: two.
 *
 *   1. Who he is: his portrait as pixels and his name, the pointer playing
 *      over both (`about-hero.tsx`), with the line and the services beside.
 *   2. Everything else at once: the biography, the four phases of a
 *      commission, the names that have been through them, and the ask.
 *      A visitor who has read the first screen is deciding, not browsing,
 *      so the second screen is the whole answer and the way to start.
 */

export const metadata: Metadata = {
  title: "About",
  description:
    "Julian Gigola, photographer and creative director in the San Francisco Bay Area. Editorial, campaigns and artists, in the studio and on location. Published in WIRED.",
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
    body: "Selects for approval, then final retouched files in the crops and color spaces you need.",
  },
];

export default function AboutPage() {
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
              &larr; Portfolio
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
        /* The site's own order, walked both ways: Sessions, About, Contact.
           Julian asked for the way back from Contact to land here, and for
           a push back past the start of this page to go on to Sessions. */
        prev={SESSIONS_PAGE}
        paged
        bleed
        // The two screens dealt as a deck, as on the homepage (`lib/deck.ts`).
        deck="screens"
        className="mt-4 flex-1"
      >
        {/* One: the portrait, the name, the line, and the services. */}
        <section
          data-tick
          data-label="About"
          data-hash="about"
          className="w-full shrink-0 sm:h-full"
        >
          <AboutHero>
            {/* Julian: the line, what he is hired for under it, fitted
                beside the portrait. */}
            <RisingTitle
              /* The ampersand kept with Photographer, so it opens the
                 second line rather than hanging off the first. */
              text={"Bay Area Creative Director & Photographer"}
              className="about-hero-title"
            />
            <p className="title-rest about-hero-intro">
              Photographer and Creative Director based in the San Francisco Bay
              Area. Operating at the intersection of editorial fashion,
              commercial campaigns, and artist development. Trusted by emerging
              musicians, tech brands, and WIRED. Available worldwide.
            </p>
            {/* A ruled list rather than prose: somebody deciding whether to
                brief him is scanning for one word, and six of them in a
                paragraph is six words to find. */}
            <div className="title-rest about-hero-services">
              <h2 className="label">Services</h2>
              <ul>
                {SERVICES.map((service) => (
                  <li key={service} className="label">
                    {service}
                  </li>
                ))}
              </ul>
            </div>
          </AboutHero>
        </section>

        {/* Two: the biography, the sequence, the names, and the ask. */}
        <section
          data-tick
          data-label="Biography"
          data-hash="biography"
          className="flex w-full shrink-0 flex-col gap-8 px-6 py-12 sm:h-full sm:gap-0 sm:px-16 sm:py-0 sm:pt-12 short:sm:pt-8"
        >
          <div
            data-scroll
            className="grid min-h-0 flex-1 content-center gap-10 overflow-y-auto sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-16 short:sm:gap-10"
          >
            {/* His words. The biography reads as a column. */}
            <div className="flex flex-col gap-3 short:gap-2">
              <h2 className="label text-muted-foreground">Biography</h2>
              {/* The first sentence as a lead, the rest under it in the
                  muted body size. Justified, and set close: Julian picked
                  this and asked for less space. No auto hyphenation, so a
                  justified line never breaks a word with a dash. */}
              <div className="flex flex-col gap-2.5 text-justify short:gap-1.5">
                <p className="text-[clamp(1rem,1.15vw,1.125rem)] leading-[1.4] short:text-base short:leading-snug">
                  As a photographer and creative director based in the San
                  Francisco Bay Area, my work sits between the worlds of
                  editorial fashion, commercial campaigns, and artist
                  development.
                </p>
                <p className="text-[0.9375rem] leading-[1.6] text-muted-foreground short:text-sm short:leading-normal">
                  On the commercial side my work includes commissions for tech
                  and consumer brands and features from WIRED. I&rsquo;ve been
                  instrumental in shaping the visual identities of musicians and
                  independent artists locally. While rooted in the Bay Area, I
                  collaborate with clients worldwide.
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
                        {/* A rule runs from every number to the edge of its
                            column, so each step carries the same line.
                            Julian asked for it on 02 and 04 too. */}
                        <span aria-hidden className="h-px flex-1 bg-border" />
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
                data-hash="inquire"
                className="flex flex-wrap items-center gap-3 border-t border-border pt-6 short:pt-4"
              >
                <Link
                  href="/contact?type=editorial"
                  className="label action px-6 py-4 press active:scale-[0.97] short:py-3"
                >
                  Inquire
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
