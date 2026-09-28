import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChromaWaves } from "@/components/chroma-waves";
import { ContactForm } from "@/components/contact-form";
import { PageDials } from "@/components/page-dials";
import { Strip } from "@/components/strip";
import { StripPage, StripHead, RisingTitle } from "@/components/strip-page";
import { BOOKING_URL } from "@/lib/site";
import { ABOUT_PAGE, SESSIONS_PAGE } from "@/lib/work";

/* ── contact ──────────────────────────────────────────────────────
 * The page the whole site is judged on, so the form is on the first screen
 * beside the invitation rather than one swipe behind it. Nothing here is a
 * step before the ask.
 *
 * Two screens. The first is the enquiry: what to say, and the box to say it
 * in. The second is everything a person might want instead of a form —
 * the address, where he is, and where else he is. A wheel past the end
 * goes on to About, the last page in the nav's order.
 * ─────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Commission a shoot or book a session with Julian Gigola, San Francisco Bay Area photographer and creative director.",
  alternates: { canonical: "/contact" },
};

/* Julian's own logo files, used as masks over currentColor like the
   client marks, so they sit muted and come up on hover in either theme. */
const ELSEWHERE = [
  {
    href: "https://instagram.com/juliangigola",
    label: "Instagram",
    at: "@juliangigola",
    mark: "/social/instagram.webp",
  },
  {
    href: "https://www.linkedin.com/in/juliangigola",
    label: "LinkedIn",
    at: "Julian Gigola",
    mark: "/social/linkedin.webp",
  },
];

/* How a commission runs, beside the form it starts: Julian moved it here
   from About. */
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

/* What DialKit's "Contact layout" panel moves (`page-dials.tsx`). */
const DIALS = {
  crumb: { sel: '[data-dial="crumb"]', text: true },
  pageTitle: { sel: '[data-dial="page-title"]', text: true },
  title: { sel: ".contact-title", text: true },
  intro: { sel: '[data-dial="intro"]', text: true },
  details: '[data-dial="details"]',
  steps: '[data-dial="steps"]',
  form: '[data-dial="form"]',
  sendButton: '[data-dial="send"]',
};

export default function ContactPage() {
  return (
    <StripPage
      head={
        <StripHead
          crumb={
            <Link
              prefetch={false}
              href={SESSIONS_PAGE.href}
              className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
            >
              &larr; {SESSIONS_PAGE.name}
            </Link>
          }
          title="Contact"
          live
        />
      }
    >
      {/* Julian: waves behind the page, the site's own shader. */}
      <ChromaWaves className="pointer-events-none fixed inset-0 -z-10" />
      <PageDials title="Contact layout" id="contact-layout" parts={DIALS} />
      <Strip
        label="Contact: the ask, the details, and the form."
        /* The site's order, as the nav has it: Sessions, Contact, About.
           Back past the start goes to Sessions, on past the end to About
           (Julian). */
        prev={SESSIONS_PAGE}
        next={ABOUT_PAGE}
        paged
        bleed
        className="mt-4 flex-1"
      >
        {/* The ask and the details on one side, the form on the other. */}
        <section
          data-tick
          data-label="Inquire"
          data-hash="inquire"
          className="grid w-full shrink-0 grid-cols-1 gap-10 px-6 py-12 sm:h-full sm:grid-cols-2 sm:items-center sm:gap-16 sm:px-16 sm:py-0"
        >
          {/* Scrolls inside itself if a short window still cannot hold
              it, as the form beside it does. */}
          <div
            data-scroll
            className="flex min-h-0 flex-col gap-6 overflow-y-auto overscroll-contain sm:max-h-full short:gap-4"
          >
            <RisingTitle text="Get in Touch" className="contact-title" />
            {/* 1.02 as a zoom: Julian's DialKit size for the intro, the same
                `zoom` the panel's Size writes (`page-dials.tsx`). */}
            <p data-dial="intro" className="title-rest max-w-prose text-sm leading-relaxed text-muted-foreground [zoom:1.02]">
              {/* A sentence to a line, where there is room: Julian asked
                  for two lines rather than a wrap mid sentence. */}
              Commissions, sessions, or a question about a project.
              <br className="max-sm:hidden" /> Tell me what kind of shoot it
              is and I&rsquo;ll come back with an approach and a quote.
            </p>
            {/* Answers "will this actually go anywhere?" before they decide
                whether to fill anything in, which is where most enquiries
                are abandoned. */}
            {/* The promise sits in the head aside; twice on one screen read
                as a tic on a phone. */}
            {/* Self-serve booking, once the calendar exists. Beside the form
                rather than instead of it — a session client wants a slot, a
                commissioning client wants a conversation. */}
            {BOOKING_URL ? (
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noreferrer"
                data-ring="Book"
                className="label inline-block self-start action px-6 py-4 press active:scale-[0.97]"
              >
                Check availability
              </a>
            ) : null}
            {/* Everything a person might want instead of the form. It had
                a screen of its own, which was a screen to swipe past on
                the way to nothing: the address and the handles are two
                lines and belong beside the ask. */}
            <div data-dial="details" className="border-t border-border pt-8 short:pt-5">
              <dl className="grid gap-6 min-[56rem]:grid-cols-2">
                <div>
                  <dt className="label text-muted-foreground">Email</dt>
                  <dd className="mt-2 text-sm">
                    <a
                      href="mailto:hello@juliangigola.com"
                      /* In capitals, sitting on its rule: Julian asked for
                         both. A border rather than an underline, which
                         vanishes when it is brought this close. */
                      className="inline-block border-b border-border pb-0 uppercase leading-none tracking-[0.04em] transition-colors duration-200 hoverable:hover:border-current"
                    >
                      hello@juliangigola.com
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="label text-muted-foreground">Based in</dt>
                  <dd className="mt-2 text-sm">
                    San Francisco Bay Area &middot; Available to travel
                  </dd>
                </div>
              </dl>
              {/* Instagram and LinkedIn as their marks alone: Julian asked
                  for the logos in place of the names, then for the handles
                  to go too. The name is still read out, and shown on hover.
                  The link is the padded box, so a thumb has more than the
                  glyph to aim at. */}
              <div className="-ml-2 mt-5 flex gap-2 short:mt-3">
                {ELSEWHERE.map((where) => (
                  <a
                    key={where.href}
                    href={where.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${where.label}, ${where.at}`}
                    title={`${where.label}, ${where.at}`}
                    className="p-2 text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
                  >
                    <span
                      aria-hidden
                      className="block size-6 shrink-0 bg-current"
                      style={{
                        maskImage: `url(${where.mark})`,
                        WebkitMaskImage: `url(${where.mark})`,
                        maskSize: "contain",
                        WebkitMaskSize: "contain",
                      }}
                    />
                  </a>
                ))}
              </div>
            </div>
            {/* The four steps, compact: a name and a line each, the lines
                giving way on a short window so the column still fits. */}
            <div data-dial="steps" className="border-t border-border pt-6 short:pt-4">
              <h2 className="label text-muted-foreground">
                How a commission runs
              </h2>
              <ol className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 short:mt-3 short:grid-cols-4 short:gap-x-4">
                {PHASES.map((phase, i) => (
                  <li key={phase.step} className="flex flex-col gap-1">
                    <span className="label tabular-nums text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="font-display text-lg uppercase leading-none tracking-[0] short:text-base">
                      {phase.step}
                    </h3>
                    <p className="text-xs leading-relaxed text-muted-foreground short:hidden">
                      {phase.body}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* The form keeps its own height and scrolls inside itself on a
              short window, so the send button is never below the fold of
              its own box. The strip yields the wheel to it and takes it
              back once it has run out. `useSearchParams` in the form needs
              a boundary, so the shell can still be prerendered while the
              pre-filled type resolves. */}
          <div
            data-scroll
            data-dial="form"
            className="min-h-0 overflow-y-auto overscroll-contain sm:max-h-full sm:pr-3"
          >
            <Suspense fallback={null}>
              <ContactForm />
            </Suspense>
          </div>
        </section>
      </Strip>
    </StripPage>
  );
}
