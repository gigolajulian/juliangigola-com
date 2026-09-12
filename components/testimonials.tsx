import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { TESTIMONIALS } from "@/lib/testimonials";

/**
 * Client quotes, or nothing at all.
 *
 * Returns null while `TESTIMONIALS` is empty, so this can sit in the page
 * today and start rendering the moment real quotes land in that file. An
 * empty state here would be worse than absence — a testimonials heading with
 * no testimonials under it actively costs trust.
 */
export function Testimonials() {
  if (!TESTIMONIALS.length) return null;

  return (
    <section aria-labelledby="testimonials" className="border-t border-border">
      <div className="mx-auto max-w-[100rem] px-6 py-20 sm:px-10 sm:py-28">
        <Reveal variant="calm">
          <h2 id="testimonials" className="label text-muted-foreground">
            What clients say
          </h2>
        </Reveal>

        <ul className="stagger mt-12 grid gap-x-12 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <li key={t.name + t.quote.slice(0, 16)}>
              {/* Inside the `<li>`, so the list item stays the grid cell. */}
              <Reveal variant="calm">
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
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
