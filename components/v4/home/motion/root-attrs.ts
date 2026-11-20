/* Typed readers for the attributes the motion layer sets on <html>. Every root attribute, its writer, its readers
   and when it is set and removed: the "Root attributes (html)" table in ../MOTION-HOOKS.md. */

/** The idle wall's card turn in ms (motion/hero.ts writes data-mt-flip). 0 when it is missing: the hero driver is not running. */
export const flipMs = () => Number(document.documentElement.getAttribute("data-mt-flip")) || 0;
