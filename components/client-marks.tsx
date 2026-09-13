import Link from "next/link";
import { CLIENT_MARKS } from "@/lib/clients-data";
import { cn } from "@/lib/utils";

/* ── who he has worked with ───────────────────────────────────────
 * A client's logo where there is one, its name set in the display face where
 * there is not.
 *
 * Both are marks — a wordmark is what a logo is when the logo is the name,
 * which is what half of them are anyway — so they sit in the same grid at the
 * same cap height and neither reads as a placeholder for the other. A logo
 * arrives by dropping an SVG into `public/clients/<slug>.svg` and running
 * `scripts/make-clients.mjs`; the name keeps working until then, so the
 * section is never half-built.
 *
 * Inline SVG in `currentColor`, not `<img>`. Three things need that and an
 * image gives none of them: the marks sit muted so they read as a list rather
 * than competing with the work, each comes up to full contrast under the
 * pointer, and a black logo would be invisible on the dark theme — which is
 * the default here.
 *
 * Height is capped and width is left alone. Logos come in every proportion
 * and normalising the *width* is what makes a client wall look amateur: a
 * wide wordmark squeezed into the same box as a round badge. Equal cap height
 * is how a typographer would set them, and it is why a row of five reads as
 * one line rather than five boxes.
 * ─────────────────────────────────────────────────────────────── */

export type Client = { name: string; slug: string };

export function ClientMarks({
  clients,
  className,
  /**
   * `row` is the band under the cover: one line, wrapping, compact.
   * `grid` is the wall — even cells, five across where there is room.
   */
  layout = "row",
}: {
  clients: Client[];
  className?: string;
  layout?: "row" | "grid";
}) {
  if (!clients.length) return null;

  return (
    <ul
      className={cn(
        layout === "row"
          ? "flex flex-wrap items-center gap-x-8 gap-y-4"
          : /* Even cells, and the count comes from the width rather than from
               a breakpoint: two on a phone, three by 30rem, five by 60rem.
               `auto-fit` is right here and not in the video grid — an empty
               cell in a logo wall is a hole in a rhythm, so collapsing the
               spare tracks is what keeps a row of seven from leaving three
               gaps at the end. */
            "grid items-center justify-items-center gap-x-8 gap-y-12 [grid-template-columns:repeat(auto-fit,minmax(min(9rem,45%),1fr))]",
        className,
      )}
    >
      {clients.map((client) => (
        <li
          key={client.slug}
          className={cn("flex items-center", layout === "grid" && "w-full justify-center")}
        >
          <Link
            href={`/work/${client.slug}`}
            aria-label={client.name}
            className={cn(
              "flex items-center justify-center text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground",
              // A whole cell to aim at in the wall, so the target is the
              // logo's space rather than its ink — a wordmark's letterforms
              // are mostly holes.
              layout === "grid" && "h-10 w-full",
            )}
          >
            <ClientMark client={client} layout={layout} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ClientMark({
  client,
  layout,
}: {
  client: Client;
  layout: "row" | "grid";
}) {
  const mark = CLIENT_MARKS[client.slug];

  if (!mark) {
    return (
      <span
        className={cn(
          "font-display text-center uppercase tracking-[0]",
          layout === "row" ? "text-lg sm:text-xl" : "text-xl sm:text-2xl",
        )}
      >
        {client.name}
      </span>
    );
  }

  /* The cap height is matched to the wordmark beside it rather than chosen:
     `text-xl` in this face caps at about 15px, and a mark reads level with
     type when their caps agree — not when their boxes do. */
  return (
    <svg
      viewBox={mark.viewBox}
      role="img"
      aria-hidden
      focusable="false"
      /* Measured against the wordmarks beside them rather than picked: the
         display face at `text-2xl` caps around 17px, so a mark in a 24px box
         reads a size larger than the names it shares a row with. These sit
         level. Worth re-measuring once real logos are in — a mark with
         descenders or a lot of air in its viewBox will want another pass. */
      className={cn("w-auto max-w-full", layout === "row" ? "h-4 sm:h-[1.1rem]" : "h-5 sm:h-6")}
      // Width comes from the viewBox and `preserveAspectRatio` is the
      // default, so a wide mark stays wide.
      fill="currentColor"
      /* The markup is generated at build from files in this repository, and
         the generator refuses script, event handlers and anything that
         reaches outside the file. See `scripts/make-clients.mjs`. */
      dangerouslySetInnerHTML={{ __html: mark.body }}
    />
  );
}
