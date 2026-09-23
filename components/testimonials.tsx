import Link from "next/link";
import { TESTIMONIALS } from "@/lib/testimonials";

/**
 * Client quotes, or nothing at all.
 *
 * Returns null while `TESTIMONIALS` is empty, so this can sit in the page
 * today and start rendering the moment real quotes land in that file. An
 * empty state here would be worse than absence — a testimonials heading with
 * no testimonials under it actively costs trust.
 */
export function Testimonials({ cells = false }: { cells?: boolean }) {
  if (!TESTIMONIALS.length) return null;

  /* Along a strip each quote is a cell of its own, in the order they were
     written, with no heading above them: the ruler says where they are. */
  if (cells) {
    return (
      <>
        {TESTIMONIALS.map((t, i) => (
          <figure
            key={t.name + t.quote.slice(0, 16)}
            data-tick
            data-label={i === 0 ? "What clients say" : t.name}
            data-hash={i === 0 ? "clients" : undefined}
            className="flex w-full shrink-0 flex-col justify-center gap-5 py-6 sm:h-full sm:w-[min(28rem,70vw)] sm:py-0"
          >
            <blockquote className="font-display text-xl leading-snug sm:text-2xl">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <figcaption className="label text-muted-foreground">
              {t.project ? (
                <Link
                  prefetch={false}
                  href={`/work/${t.project}`}
                  className="transition-colors duration-200 hoverable:hover:text-foreground"
                >
                  {t.name}
                  {t.role ? ` · ${t.role}` : ""}
                </Link>
              ) : (
                <>
                  {t.name}
                  {t.role ? ` · ${t.role}` : ""}
                </>
              )}
            </figcaption>
          </figure>
        ))}
      </>
    );
  }

  return (
    <section aria-labelledby="testimonials" className="border-t border-border">
      <div className="mx-auto max-w-[100rem] px-6 py-20 sm:px-10 sm:py-28">
        <h2 id="testimonials" className="label text-muted-foreground">
          What clients say
        </h2>

        <ul className="mt-12 grid gap-x-12 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <li key={t.name + t.quote.slice(0, 16)}>
              <blockquote className="font-display text-xl leading-snug sm:text-2xl">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <p className="label mt-5 text-muted-foreground">
                  {t.project ? (
                    <Link
                      href={`/work/${t.project}`}
                      className="transition-colors duration-200 hoverable:hover:text-foreground"
                    >
                      {t.name}
                      {t.role ? ` · ${t.role}` : ""}
                    </Link>
                  ) : (
                    <>
                      {t.name}
                      {t.role ? ` · ${t.role}` : ""}
                    </>
                  )}
                </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
