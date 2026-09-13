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
        /* `--mark-box` is the box every mark is fitted into — height first,
           width as the cap. See the note in `ClientMark` for why both. */
        layout === "row"
          ? "flex flex-wrap items-center gap-x-8 gap-y-4 [--mark-box:1.45rem] [--mark-cap:7rem]"
          : /* Even cells, and the count comes from the width rather than from
               a breakpoint: two on a phone, three by 30rem, five by 60rem.
               `auto-fit` is right here and not in the video grid — an empty
               cell in a logo wall is a hole in a rhythm, so collapsing the
               spare tracks is what keeps a row of seven from leaving three
               gaps at the end. */
            "grid items-center justify-items-center gap-x-8 gap-y-12 [--mark-box:2.75rem] [--mark-cap:9rem] [grid-template-columns:repeat(auto-fit,minmax(min(9rem,45%),1fr))]",
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
              layout === "grid" && "h-12 w-full",
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
      /* A size down from where it was in the wall, and `leading-none`.

         `text-2xl` put LADERA GRANOLA at 165x64 — two lines, and half again
         the width of every logo beside it. A wordmark is a mark here, not a
         heading, so it takes the same band as the rest. */
      <span
        className={cn(
          "font-display max-w-full text-center uppercase leading-none tracking-[0]",
          layout === "row" ? "text-lg sm:text-xl" : "text-lg sm:text-xl",
        )}
      >
        {client.name}
      </span>
    );
  }

  /* Every mark is fitted into one box: as tall as the box allows, and no
     wider than the cap.

     Sizing by height alone was wrong, and measurably so. In the wall, WIRED
     came out 94x19 while the Pear mark — which is nearly square — came out
     39x31 and Ukiyo 41x21, against wordmarks running 117px and 165px wide.
     Equal height gives a narrow logo a fraction of the *area* of a long
     wordmark, so the marks read as thumbnails dropped in among type.

     A cap on the width is what fixes it, and it is what makes a client wall
     on any other site look even: a wide mark hits the width and loses height,
     a squarish one takes the full height and stays narrow, and both end up
     occupying a similar amount of the cell. `aspect-ratio` keeps the
     proportions while both limits apply — nothing is ever stretched.

     `scale` then nudges the optical weight, which no rule gets right: see the
     note on `Client.scale`. */
  const size = {
    /* The box, times the mark's own evening factor, times any hand nudge.
    
       The evening factor is measured rather than chosen: the generator sums
       each mark's alpha to get how much of its box is ink and levels the ink
       *area* across the set. Equal height was the bug Julian caught — LADERA
       came out 112x23 against Pear VC's 28x22, the same height and four times
       the area, because the eye judges area and a wide wordmark has far more
       of it than a compact glyph.
       
       `client.scale` survives as an override for a judgement the pixels
       cannot make — a logo that should dominate, or one whose trademark has
       rules about size. Nothing sets it now. */
    height: `calc(var(--mark-box) * ${mark.scale} * ${client.scale ?? 1})`,
    maxWidth: "var(--mark-cap)",
    width: "auto",
  } as const;

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
        className="block max-w-full bg-current"
        style={{
          ...size,
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
      className="max-w-full"
      style={size}
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
