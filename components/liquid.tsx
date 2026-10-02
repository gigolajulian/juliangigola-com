"use client";

import * as React from "react";
import { Liquid as Base, type LiquidProps } from "liquid-gooey";

/* `liquid-gooey`'s root, out of the tab order where it should never have
 * been. The library renders its items into `<g>`s through React portals,
 * React hangs its event listeners on every portal container, and Chrome
 * makes an SVG element with focus listeners keyboard focusable: a Tab
 * through the hero's buttons stopped on an invisible group with no name
 * and no ring after "See the work" (UI/UX review, 2026-10-02). Every
 * Liquid on the site comes through here.
 */
const Root = React.forwardRef<HTMLDivElement, LiquidProps>(function Liquid(props, ref) {
  const own = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => own.current!, []);
  React.useEffect(() => {
    // Its own two layers only, not an icon inside a button.
    for (const g of own.current?.querySelectorAll(":scope > svg g") ?? [])
      g.setAttribute("tabindex", "-1");
  }, []);
  return <Base ref={own} {...props} />;
});

export const Liquid = Object.assign(Root, { Item: Base.Item });
