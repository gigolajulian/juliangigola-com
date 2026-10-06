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

/* Once the page has loaded and gone quiet. Every item measures its target
 * as it mounts and the engine goes on measuring for thirty frames, which
 * on a phone was a full restyle of the page in the middle of hydration
 * (optimize pass, 2026-10-05). The drops that only decorate (a hover's
 * ground, the rail's ink, the lit chip) wait for this; nobody points at
 * them in the first second. Once true it stays true for the visit, so a
 * page reached later has them at once. */
let quiet = false;
export function useQuiet() {
  const [on, setOn] = React.useState(quiet);
  React.useEffect(() => {
    if (on) return;
    const go = () => {
      quiet = true;
      setOn(true);
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(go, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(go, 1200);
    return () => window.clearTimeout(t);
  }, [on]);
  return on;
}
