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

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-[100rem] px-6 py-16 sm:px-10 sm:py-24">
        <div className="flex flex-col gap-12 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label text-muted-foreground">
              Commissions and sessions
            </p>
            <h2 className="mt-4 title">
              <Link
                href="/contact"
                className="transition-opacity duration-200 hover:opacity-70"
              >
                Let&rsquo;s make something.
              </Link>
            </h2>
            <a
              href="mailto:hello@juliangigola.com"
              className="mt-4 inline-block text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors duration-200 hover:text-foreground hover:decoration-current"
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
                    className="label text-muted-foreground transition-colors duration-200 hover:text-foreground"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-16 flex flex-col gap-2 border-t border-border pt-6 sm:flex-row sm:justify-between">
          <p className="label text-muted-foreground">
            &copy; {new Date().getFullYear()} Julian Gigola
          </p>
          <p className="label text-muted-foreground">San Francisco Bay Area</p>
        </div>
      </div>
    </footer>
  );
}
