import type { Metadata } from "next";
import Link from "next/link";
import { Strip } from "@/components/strip";
import { StripPage, StripHead, RisingTitle } from "@/components/strip-page";
import { PRESS_STUDIO, CONTACT } from "@/lib/work";
import { ClientMarks } from "@/components/client-marks";
import { AboutHero } from "@/components/about-hero";
import { PageDials } from "@/components/page-dials";

/* ── about ────────────────────────────────────────────────
 * The old site split this across /about (real, and decent) and /rates
 * (never written — it still shipped the Format demo's biography, about a
 * New-Zealand-born photographer in New York represented by an agency that is
 * not his). One page, his own words only.
 *
 * One screen. It was five, then four, then three, then two; Julian: one.
 * Lights in a grain of pixels and his name, the pointer playing over both
 * (`about-hero.tsx`), with the line, the biography, the services and the
 * ask beside, and the client marks along the foot. How a commission runs
 * is on Contact, beside the form it leads to.
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

/* What DialKit's "About layout" panel moves (`page-dials.tsx`). */
const DIALS = {
  crumb: { sel: '[data-dial="crumb"]', text: true },
  pageTitle: { sel: '[data-dial="page-title"]', text: true },
  title: { sel: ".about-hero-title", text: true },
  intro: { sel: ".about-hero-intro", text: true },
  services: ".about-hero-services",
  servicesHeading: { sel: ".about-hero-services > h2", text: true },
  servicesList: ".about-hero-services > ul",
  buttons: ".about-hero-ask",
  inquireButton: { sel: ".about-hero-ask > a:first-child", text: true },
  workButton: { sel: ".about-hero-ask > a:last-child", text: true },
  name: ".about-hero-name",
  facts: ".about-hero-facts",
  clients: ".about-hero-clients",
  clientsHeading: { sel: "#clients", text: true },
  logos: ".about-marquee",
};

export default function AboutPage() {
  return (
    <StripPage
      head={
        <StripHead
          crumb={
            <Link
              prefetch={false}
              href={CONTACT.href}
              className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
            >
              &larr; {CONTACT.name}
            </Link>
          }
          title="About"
          live
          aside="Julian Gigola"
        />
      }
    >
      <PageDials title="About layout" id="about-layout" parts={DIALS} />
      <Strip
        label="About: who he is, what he is hired for, and who has hired him."
        /* The site's own order, as the nav has it: Sessions, Contact,
           About. A push back past the start goes to Contact (Julian). No
           `next`: this is where the order ends. */
        prev={CONTACT}
        paged
        bleed
        // The two screens dealt as a deck, as on the homepage (`lib/deck.ts`).
        deck="screens"
        className="mt-4 flex-1"
      >
        {/* One: the name, the line, and the services. */}
        <section
          data-tick
          data-label="About"
          data-hash="about"
          className="w-full shrink-0 sm:h-full"
        >
          <AboutHero
            foot={
              PRESS_STUDIO.length ? (
                <section aria-labelledby="clients" className="about-hero-clients">
                  <h2 id="clients" className="label shrink-0 text-muted-foreground">
                    Published &amp; commissioned by
                  </h2>
                  {/* Julian: the marks loop sideways on one line. The list
                      twice, the second out of reach of keys and readers,
                      the track moving by one list's width. */}
                  <div className="about-marquee">
                    <div className="about-marquee-track">
                      <ClientMarks clients={PRESS_STUDIO} layout="row" className="about-marquee-list" />
                      <div inert aria-hidden>
                        <ClientMarks clients={PRESS_STUDIO} layout="row" className="about-marquee-list" />
                      </div>
                    </div>
                  </div>
                </section>
              ) : null
            }
          >
            {/* Julian: the line, what he is hired for under it. */}
            <RisingTitle
              /* Julian: three lines, "SF Bay Area / Creative Director /
                 & Photographer". Each line's words held together by
                 no-break spaces, so each line rises as one piece and the
                 stylesheet sets one to a line (`.about-hero-title`). */
              text={"SF Bay Area Creative Director & Photographer"}
              className="about-hero-title"
            />
            {/* Julian's words, as he wrote them. */}
            <p className="title-rest about-hero-intro">
              San Francisco Bay Area based Photographer and Creative Director
              operating at the intersection of Editorial Fashion, Commercial
              Campaigns and Artist Development. Trusted by emerging Fashion
              Brands, Musicians and Technology Brands. Available to travel
              Worldwide.
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
            {/* The ask, under the services: About is one screen now
                (Julian). */}
            <div
              className="title-rest about-hero-ask flex flex-wrap items-center gap-3"
            >
              <Link
                href="/contact?type=editorial"
                className="label action px-5 py-3 press active:scale-[0.97] short:py-2.5"
              >
                Inquire
              </Link>
              <Link
                prefetch={false}
                href="/portfolio"
                className="label action-quiet px-5 py-3 press active:scale-[0.97] short:py-2.5"
              >
                See the work
              </Link>
            </div>
          </AboutHero>
        </section>
      </Strip>
    </StripPage>
  );
}
