/* The `sizes` a strip's photographs are fetched by, in one place: the
   cells use them, and the discipline before reads them to fetch the same
   files ahead of the card (`warm` on `Lead`, `components/strip.tsx`).
   See the comments where they are used for the measurements behind them. */
type Box = { width: number; height: number };
const r = (f: Box, k = 1) => ((f.width / f.height) * k).toFixed(3);

/** A cover cell on a discipline: the strip's height, 10rem under the window. */
export const coverSizes = (f: Box) =>
  `(min-width: 640px) and (min-resolution: 2.5dppx) calc((100vh - 10rem) * ${r(f, 0.667)}), (min-width: 640px) calc((100vh - 10rem) * ${r(f)}), 100vw`;

/** A frame on a project or gallery strip: 8rem under the window. */
export const frameSizes = (f: Box) =>
  `(min-resolution: 2.5dppx) calc((100vh - 8rem) * ${r(f, 0.667)}), calc((100vh - 8rem) * ${r(f)})`;
