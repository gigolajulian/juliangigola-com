# Client logos

One SVG per client, named for the project's slug:

    wired-magazine.svg
    oakley-x-nike.svg
    ukiyosunknown.svg
    jubo.svg
    sago.svg

Then run:

    node scripts/make-clients.mjs

The band under the cover and the wall on /studio draw the mark instead of the
name. A client with no file here keeps its wordmark, so the section is never
half-built and adding one is a two-minute job.

## What the file has to be

**One colour.** Every fill and stroke is rewritten to `currentColor`, so the
mark can sit muted in the row, come up to full contrast on hover, and work on
both the dark theme and the light one. A two-tone logo comes out flat; a logo
whose colours are the point of it wants a different design, not this pipeline.

**Flattened.** A `<style>` block, a gradient, an embedded raster, a `<script>`,
an event handler or a reference to another file is refused with an error
naming the file. Export it again as plain paths.

**With a `viewBox`.** Width comes from the viewBox and height from the layout,
so proportions are kept — logos are matched on cap height, never squeezed to a
common box.

Most brands publish exactly this under "press" or "brand assets". A single-colour
or "black" variant is the one to take.
