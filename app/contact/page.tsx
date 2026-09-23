import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { Strip } from "@/components/strip";
import { StripPage, StripHead, RisingTitle } from "@/components/strip-page";
import { BOOKING_URL } from "@/lib/site";

/* ── contact ──────────────────────────────────────────────────────
 * The page the whole site is judged on, so the form is on the first screen
 * beside the invitation rather than one swipe behind it. Nothing here is a
 * step before the ask.
 *
 * Two screens. The first is the enquiry: what to say, and the box to say it
 * in. The second is everything a person might want instead of a form —
 * the address, where he is, and where else he is. Nothing leads on from
 * here: a wheel past the end stretches the band and stops, because the
 * visitor has arrived.
 * ─────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Commission a shoot or book a session with Julian Gigola, San Francisco Bay Area photographer and creative director.",
  alternates: { canonical: "/contact" },
};

const ELSEWHERE = [
  {
    href: "https://instagram.com/juliangigola",
    label: "Instagram",
    at: "@juliangigola",
  },
  {
    href: "https://www.linkedin.com/in/juliangigola",
    label: "LinkedIn",
    at: "Julian Gigola",
  },
];

export default function ContactPage() {
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
          title="Contact"
          live
        />
      }
    >
      <Strip
        label="Contact: the ask, the details, and the form."
        paged
        bleed
        className="mt-4 flex-1"
      >
        {/* The ask and the details on one side, the form on the other. */}
        <section
          data-tick
          data-label="Enquire"
          data-hash="enquire"
          className="grid w-full shrink-0 grid-cols-1 gap-10 px-6 py-12 sm:h-full sm:grid-cols-2 sm:items-center sm:gap-16 sm:px-16 sm:py-0"
        >
          <div className="flex flex-col gap-6">
            <RisingTitle text="Get in touch" />
            <p className="title-rest max-w-prose text-sm leading-relaxed text-muted-foreground">
              Commissions, sessions, or a question about a project. Tell me what
              kind of shoot it is and I&rsquo;ll come back with an approach and
              a quote.
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
            <div className="border-t border-border pt-8">
              <dl className="grid gap-6 min-[56rem]:grid-cols-2">
                <div>
                  <dt className="label text-muted-foreground">Email</dt>
                  <dd className="mt-2 text-sm">
                    <a
                      href="mailto:hello@juliangigola.com"
                      className="underline decoration-border underline-offset-4 transition-colors duration-200 hoverable:hover:decoration-current"
                    >
                      hello@juliangigola.com
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="label text-muted-foreground">Based in</dt>
                  <dd className="mt-2 text-sm">
                    San Francisco Bay Area &middot; available to travel
                  </dd>
                </div>
                {/* The three that used to sit in the footer's ask. The footer is
                one quiet line under every strip now, so they live where
                somebody looking for them would go. */}
                <div>
                  <dt className="label text-muted-foreground">Elsewhere</dt>
                  <dd className="mt-2 flex flex-col gap-2 text-sm">
                    {ELSEWHERE.map((where) => (
                      <a
                        key={where.label}
                        href={where.href}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-border underline-offset-4 transition-colors duration-200 hoverable:hover:decoration-current"
                      >
                        {where.label}
                        <span className="ml-2 text-muted-foreground">
                          {where.at}
                        </span>
                      </a>
                    ))}
                  </dd>
                </div>
              </dl>
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
