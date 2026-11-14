"use client";

import * as React from "react";
import { startEngine } from "./engine";
import { heroDrivers } from "./hero";
import { rowsDrivers } from "./rows";
import { commissionsDrivers } from "./commissions";
import { aboutDrivers } from "./about";
import { quoteDrivers } from "./quote";
import { footDrivers } from "./foot";
import { depthDrivers } from "./depth";
import { startReveal } from "./reveal";
import { stepDrivers } from "./steps";
import "./motion.css";
import "./hero.css";
import "./rows.css";
import "./commissions.css";
import "./about.css";
import "./quote.css";
import "./foot.css";
import "./depth.css";
import "./reveal.css";
import "./flow.css";

/** The v4 home's motion, on top of the static screens. Mounted once, after them. */
export function MtMotionLayer() {
  React.useEffect(() => {
    const root = document.querySelector<HTMLElement>(".v3home.mt");
    if (!root || !("v3motion" in document.documentElement.dataset)) return;
    const stop = startEngine(root, [...heroDrivers, ...rowsDrivers, ...commissionsDrivers, ...aboutDrivers, ...quoteDrivers, ...footDrivers, ...depthDrivers, ...stepDrivers]);
    const hide = startReveal(root);
    return () => (stop(), hide());
  }, []);
  return null;
}
