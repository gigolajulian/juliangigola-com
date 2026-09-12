import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactForm } from "@/components/contact-form";
import { RESPONSE_TIME, BOOKING_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Commission a shoot or book a session with Julian Gigola, San Francisco Bay Area photographer and creative director.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="pb-24 pt-28 sm:pt-36">
      <div className="mx-auto grid max-w-[100rem] gap-16 px-6 sm:px-10 lg:grid-cols-[0.8fr_1fr] lg:gap-24">
        <header>
          <h1 className="title">Get in touch</h1>
          <p className="mt-6 max-w-prose text-base leading-relaxed text-muted-foreground">
            Commissions, sessions, or a question about a project. Tell me what
            kind of shoot it is and I&rsquo;ll come back with an approach and a
            quote.
          </p>

          {/* Answers "will this actually go anywhere?" before they decide
              whether to fill anything in, which is where most enquiries are
              abandoned. */}
          {RESPONSE_TIME ? (
            <p className="mt-4 text-sm text-foreground">
              Replies {RESPONSE_TIME}.
            </p>
          ) : null}

          {/* Self-serve booking, once the calendar exists. Shown alongside
              the form rather than instead of it — a session client wants a
              slot, a commissioning client wants a conversation. */}
          {BOOKING_URL ? (
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noreferrer"
              className="label mt-8 inline-block border border-foreground bg-foreground px-6 py-4 text-background press hoverable:hover:opacity-90 active:scale-[0.98]"
            >
              Check availability
            </a>
          ) : null}

          <dl className="mt-12 flex flex-col gap-8 border-t border-border pt-8">
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
            <div>
              <dt className="label text-muted-foreground">Instagram</dt>
              <dd className="mt-2 text-sm">
                <a
                  href="https://instagram.com/juliangigola"
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-border underline-offset-4 transition-colors duration-200 hoverable:hover:decoration-current"
                >
                  @juliangigola
                </a>
              </dd>
            </div>
          </dl>
        </header>

        {/* `useSearchParams` in the form needs a boundary, so the shell can
            still be prerendered while the pre-filled type resolves. */}
        <Suspense fallback={null}>
          <ContactForm />
        </Suspense>
      </div>
    </div>
  );
}
