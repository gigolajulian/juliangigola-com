import Link from "next/link";
import { CLIENT_MARKS } from "@/lib/clients-data";
import type { Client } from "@/lib/work";
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
          className={cn(
            "flex items-center",
            layout === "grid" && "w-full justify-center",
          )}
        >
          <Link
            href={client.href}
            aria-label={client.name}
            className={cn(
              "group relative flex items-center justify-center text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground",
              // A whole cell to aim at in the wall, so the target is the
              // logo's space rather than its ink — a wordmark's letterforms
              // are mostly holes.
              layout === "grid" && "h-10 w-full",
            )}
          >
            <ClientMark client={client} layout={layout} />

            {/* The name, on hover.
              
                A logo asks the viewer to recognise it, and a viewer who does
                not is left looking at an abstract shape with no way to find
                out whose it is. So the name arrives under the mark when the
                pointer does — and on keyboard focus, which is the same
                question asked a different way.

                Absolutely positioned, so nothing in the row moves when it
                appears: the grid's row gap is what reserves the space. Only
                where there *is* a logo — under a wordmark the name would be
                the name printed twice. */}
            {layout === "grid" && CLIENT_MARKS[client.slug] ? (
              <span
                aria-hidden
                className="label pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-muted-foreground opacity-0 transition-opacity duration-200 ease-[var(--ease-out-strong)] group-focus-visible:opacity-100 hoverable:group-hover:opacity-100 motion-reduce:transition-none"
              >
                {client.name}
              </span>
            ) : null}
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

  /* One height for both kinds, measured against the wordmarks rather than
     picked: the display face at `text-2xl` caps around 17px, so a mark in a
     24px box reads a size larger than the names it shares a row with. These
     sit level. Width is never set — logos come in every proportion, and
     squeezing a wide wordmark into the same box as a round badge is the thing
     that makes a client wall look amateur. */
  const height = cn(layout === "row" ? "h-4 sm:h-[1.1rem]" : "h-5 sm:h-6");

  /* A PNG whose alpha channel is the mark, used as a mask over
     `currentColor`. That is what lets a raster logo behave like type: muted in
     the row, full contrast on hover, and legible on either theme — none of
     which an `<img>` can do with a black PNG on a near-black ground.

     The aspect ratio comes from the trimmed file, so the width follows the
     height with no second measurement and nothing to keep in step by hand. */
  if (mark.kind === "mask") {
    return (
      <span
        aria-hidden
        className={cn("block w-auto bg-current", height)}
        style={{
          aspectRatio: `${mark.width} / ${mark.height}`,
          maskImage: `url(${mark.src})`,
          WebkitMaskImage: `url(${mark.src})`,
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
        }}
      />
    );
  }

  return (
    <svg
      viewBox={mark.viewBox}
      role="img"
      aria-hidden
      focusable="false"
      className={cn("w-auto max-w-full", height)}
      // Width comes from the viewBox and `preserveAspectRatio` is the
      // default, so a wide mark stays wide.
      fill="currentColor"
      /* The markup is generated from files in this repository, and the
         generator refuses script, event handlers and anything that reaches
         outside the file. See `scripts/make-clients.mjs`. */
      dangerouslySetInnerHTML={{ __html: mark.body }}
    />
  );
}
