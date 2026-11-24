import * as React from "react";
import { matches } from "@/lib/device";

/** The picture's box and the area's own width (`vw`), for the neighbours' room either side. */
export type FitSize = { w: number; h: number; vw: number };

/* The picture's box, in pixels: as large as the area allows at the
   picture's own shape. Measured rather than left to CSS, because the trip
   is a transform of this box and it has to be exactly the picture, no
   letterbox inside it. */
export function useFit(
  area: React.RefObject<HTMLDivElement | null>,
  width: number,
  height: number,
) {
  const [size, setSize] = React.useState<FitSize | null>(null);
  React.useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    /* The content box, not the padding box. `clientWidth` and
       `clientHeight` count the padding as room, which would spend the
       stage's own margin on the picture and run a tall frame hard against
       the controls. The
       observer hands the content box straight over; the first
       measurement, before there is an entry, takes the padding off by
       hand. */
    const fit = (content?: DOMRectReadOnly) => {
      let w = content?.width;
      let h = content?.height;
      if (w === undefined || h === undefined) {
        const pad = window.getComputedStyle(el);
        w = el.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
        h = el.clientHeight - parseFloat(pad.paddingTop) - parseFloat(pad.paddingBottom);
      }
      /* A landscape frame a little short of the width, so the frames
         either side show past it (Julian: scale down slightly to show the
         next and before). Not on a phone, which has no sides. */
      if (width > height && matches("wide")) w *= 0.76;
      const s = Math.min(w / width, h / height);
      setSize({ w: Math.round(width * s), h: Math.round(height * s), vw: el.clientWidth });
    };
    fit();
    const ro = new ResizeObserver(([entry]) => fit(entry.contentRect));
    ro.observe(el);
    return () => ro.disconnect();
  }, [area, width, height]);
  return size;
}
