import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { Strip } from "@/components/strip";
import { StripPage, StripHead, TitleCell } from "@/components/strip-page";
import { RESPONSE_TIME, BOOKING_URL } from "@/lib/site";

/* ── contact ──────────────────────────────────────────────────────
 * The page the whole site is judged on, so it is three cells and the third
 * is the form: the title, the details, and the enquiry. There is no
 * enquiry cell at the end because the form is the enquiry, and nothing
 * leads on from here — a wheel past the end stretches the band and stops.
 * ─────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Commission a shoot or book a session with Julian Gigola, San Francisco Bay Area photographer and creative director.",
  alternates: { canonical: "/contact" },
};

const ELSEWHERE = [
  { href: "https://instagram.com/juliangigola", label: "Instagram", at: "@juliangigola" },
  { href: "https://vimeo.com/filmedbyjulian", label: "Vimeo", at: "filmedbyjulian" },
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
          aside={RESPONSE_TIME ? `Replies ${RESPONSE_TIME}` : undefined}
        />
      }
    >
      <Strip
        label="Contact: the details and the enquiry form, left and right"
        className="mt-4 flex-1"
      >
        <TitleCell title="Get in touch" hash="contact">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Commissions, sessions, or a question about a project. Tell me what
            kind of shoot it is and I&rsquo;ll come back with an approach and a
            quote.
          </p>
          {/* Answers "will this actually go anywhere?" before they decide
              whether to fill anything in, which is where most enquiries are
              abandoned. */}
          {RESPONSE_TIME ? (
            <p className="text-sm text-foreground">Replies {RESPONSE_TIME}.</p>
          ) : null}
        </TitleCell>

        <section
          data-tick
          data-label="Details"
          data-hash="details"
          className="flex w-full shrink-0 flex-col justify-center gap-6 py-8 sm:h-full sm:w-[min(22rem,60vw)] sm:py-0"
        >
          {/* Self-serve booking, once the calendar exists. Beside the form
              rather than instead of it — a session client wants a slot, a
              commissioning client wants a conversation. */}
          {BOOKING_URL ? (
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noreferrer"
              data-ring="Book"
              className="label inline-block self-start action rounded-full px-6 py-4 press active:scale-[0.97] hoverable:cursor-none"
            >
              Check availability
            </a>
          ) : null}

          <dl
            data-scroll
            className="flex min-h-0 flex-col gap-6 overflow-y-auto overscroll-contain border-t border-border pr-2 pt-6"
          >
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
            {ELSEWHERE.map((where) => (
              <div key={where.label}>
                <dt className="label text-muted-foreground">{where.label}</dt>
                <dd className="mt-2 text-sm">
                  <a
                    href={where.href}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-border underline-offset-4 transition-colors duration-200 hoverable:hover:decoration-current"
                  >
                    {where.at}
                  </a>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* The last cell is the form itself, and it is this page's ask.
            The wheel over it scrolls the form to its end and then the
            strip; a wheel over a field never moves either. `useSearchParams`
            in the form needs a boundary, so the shell can still be
            prerendered while the pre-filled type resolves. */}
        <div
          data-tick
          data-label="Enquire"
          data-hash="form"
          className="w-full shrink-0 sm:h-full sm:w-[min(36rem,85vw)]"
        >
          <div
            data-scroll
            className="h-full overflow-y-auto overscroll-contain pr-3"
          >
            <Suspense fallback={null}>
              <ContactForm />
            </Suspense>
          </div>
        </div>
      </Strip>
    </StripPage>
  );
}
