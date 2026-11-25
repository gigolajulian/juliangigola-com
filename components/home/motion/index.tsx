"use client";

import * as React from "react";
import { matches } from "@/lib/device";
import { startEngine } from "./engine";
import { heroDrivers, heroStill } from "./hero";
import { rowsDrivers } from "./rows";
import { commissionsDrivers } from "./commissions";
import { quoteDrivers } from "./quote";
import { footDrivers } from "./foot";
import { depthDrivers } from "./depth";
import { startReveal } from "./reveal";
import { barDrivers } from "./bars";
import "./motion.css";
import "./hero.css";
import "./rows.css";
import "./commissions.css";
import "./quote.css";
import "./foot.css";
import "./depth.css";
import "./touch-parity.css";
import "./reveal.css";
import "./flow.css";

/** The v4 home's motion, on top of the static screens. Mounted once, after them. */
export function MotionLayer() {
  React.useEffect(() => {
    const root = document.querySelector<HTMLElement>(".v3home.mt");
    if (!root) return;
    const stop = startEngine(root, [
      ...heroDrivers,
      ...rowsDrivers,
      ...commissionsDrivers,
      ...quoteDrivers,
      ...footDrivers,
      ...depthDrivers,
      ...barDrivers,
    ]);
    const stopReveal = startReveal(root);
    const still = matches("calm") ? heroStill(root) : null;
    return () => (stop(), stopReveal(), still?.());
  }, []);
  // Safari on a foldable, rotated with its tab strip on the left: the page is left scrolled sideways by the strip's
  // width, after both resize events (measured on the Duo, #1062). The page never scrolls sideways, so put it back.
  // shortcut: the cause on this page is not found, drop this once it is.
  React.useEffect(() => {
    const vv = window.visualViewport;
    const fix = () => {
      if (scrollX) scrollTo(0, scrollY);
    };
    vv?.addEventListener("scroll", fix);
    return () => vv?.removeEventListener("scroll", fix);
  }, []);
  return null;
}
