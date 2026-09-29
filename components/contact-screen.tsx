import { Suspense } from "react";
import { ContactBeam } from "@/components/contact-beam";
import { ContactForm } from "@/components/contact-form";
import { RisingTitle } from "@/components/strip-page";
import { BOOKING_URL } from "@/lib/site";

/* ── contact ──────────────────────────────────────────────────────
 * A screen of the homepage, before the ask (Julian: About and Contact on
 * the home page, /contact redirects to /#contact with its query, so a
 * `?type=` still fills the form in). The form beside the invitation, the
 * address, and where he is.
 * ─────────────────────────────────────────────────────────────── */

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

export function ContactScreen() {
  /* Julian: two columns. The ask and the details in the left third,
     scrolling inside itself if a short window cannot hold them; the form
     in the middle of the right two, where the eye lands. One column on a
     phone. How a commission runs moved to About. */
  return (
    <section
      data-tick
      data-label="Contact"
      data-hash="contact"
      className="contact-inquire relative isolate grid w-full shrink-0 grid-cols-1 gap-10 px-6 py-12 sm:h-full sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:grid-rows-[minmax(0,1fr)] sm:items-center sm:gap-x-12 sm:pb-6 sm:pl-10 sm:pr-10 sm:pt-24 lg:gap-x-16"
    >
      <div
        data-scroll
        className="flex min-h-0 flex-col gap-8 overflow-y-auto overscroll-contain sm:max-h-full short:gap-5"
      >
        <div className="flex flex-col gap-5">
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
              className="label inline-block self-start action px-6 py-4 press active:scale-[0.97]"
            >
              Check availability
            </a>
          ) : null}
        </div>

        {/* Everything a person might want instead of the form. It had
            a screen of its own, which was a screen to swipe past on
            the way to nothing: the address and the handles are two
            lines and belong beside the ask. */}
        <div data-dial="details" className="border-t border-border pt-8 short:pt-5">
          {/* Side by side where the column has the room for both, by its
              own width rather than the window's. */}
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6">
            <div>
              <dt className="label text-muted-foreground">Email</dt>
              <dd className="mt-2 text-sm">
                <a
                  href="mailto:hello@juliangigola.com"
                  data-ring="Email"
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
                data-ring={where.label}
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
      </div>

      {/* The form keeps its own height and scrolls inside itself on a
          short window, so the send button is never below the fold of
          its own box. The strip yields the wheel to it and takes it
          back once it has run out. `useSearchParams` in the form needs
          a boundary, so the shell can still be prerendered while the
          pre-filled type resolves.

          Julian: the form as a card with a beam running round its
          edge (`contact-beam.tsx`), on the header's glass. */}
      <ContactBeam className="flex min-h-0 w-full max-w-[40rem] justify-self-center sm:max-h-full">
        <div
          data-scroll
          data-dial="form"
          className="glass-surface min-h-0 flex-1 rounded-[16px] overflow-y-auto overscroll-contain border border-border p-6 sm:max-h-full sm:px-8 sm:py-6"
        >
          <Suspense fallback={null}>
            <ContactForm />
          </Suspense>
        </div>
      </ContactBeam>
    </section>
  );
}
