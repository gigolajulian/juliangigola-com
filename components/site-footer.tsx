import Link from "next/link";

/**
 * The old footer was a copyright line and three social icons in a sidebar.
 * This one does the one job a portfolio footer has: catch someone who reached
 * the bottom and is still interested. So the booking line comes first and the
 * housekeeping goes underneath it.
 */

const SOCIAL = [
  { href: "https://instagram.com/juliangigola", label: "Instagram" },
  { href: "https://vimeo.com/filmedbyjulian", label: "Vimeo" },
  { href: "https://www.linkedin.com/in/juliangigola", label: "LinkedIn" },
] as const;

/** The page every commercial site owes its visitors — terms and privacy,
    side by side — and the one line on it that says the photographs are
    not training data. One link, at Julian's ask. */
const LEGAL = [{ href: "/legal", label: "Legal" }] as const;

/** The cities in the region, read out but not shown: Julian wanted
    the footer back to the region alone, with the cities still on the
    page for a search engine. Every one, and the South Bay towns, are
    also in the structured data (`areaServed`, `lib/seo.ts`). */
const AREA_CITIES = ["San Francisco", "San Jose", "Oakland", "Santa Cruz"];

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      {/* A page that sets `data-quiet-footer` (the project strips) gets the
          housekeeping row only; see `globals.css`. */}
      <div className="site-footer-body mx-auto max-w-[100rem] px-6 py-12 sm:px-10 sm:py-16 lying:py-2">
        <div className="site-footer-ask flex flex-col gap-12 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {/* No label over the heading: the heading carries
                itself. */}
            <h2 className="title">
              <Link
                href="/#contact"
                className="transition-opacity duration-200 hoverable:hover:opacity-70"
              >
                Let&rsquo;s make something.
              </Link>
            </h2>
            <a
              href="mailto:hello@juliangigola.com"
              data-ring="Email"
              className="mt-4 inline-block text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors duration-200 hoverable:hover:text-foreground hoverable:hover:decoration-current"
            >
              hello@juliangigola.com
            </a>
          </div>

          <nav aria-label="Elsewhere">
            <ul className="flex flex-wrap gap-x-8 gap-y-3">
              {SOCIAL.map((s) => (
                <li key={s.href}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="me noreferrer"
                    data-ring={s.label}
                    className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="site-footer-row mt-12 flex flex-col gap-2 max-sm:flex-col-reverse max-sm:gap-8 border-t border-border pt-5 sm:flex-row sm:justify-between lying:mt-0 lying:border-t-0 lying:pt-0">
          <p className="label text-muted-foreground">
            <strong className="font-semibold text-foreground">
              &copy; {new Date().getFullYear()} Julian Gigola.
            </strong>{" "}
            All rights reserved.
          </p>
          {/* On a phone both lines start on the left, the legal one
              first. */}
          <nav aria-label="Legal" className="label text-muted-foreground">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="transition-colors duration-200 hoverable:hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              {/* The region, and the cities in it said to a screen reader
                  and a search engine (the Bay Area as Julian means it runs
                  to Santa Cruz). */}
              {/* On a phone, at the line's right end. */}
              <li className="font-bold text-foreground max-sm:ml-auto">
                San Francisco Bay Area
                <span className="sr-only">
                  : {AREA_CITIES.slice(0, -1).join(", ")} and {AREA_CITIES.at(-1)}
                </span>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
